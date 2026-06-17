"""
对话 API — 智能学习助手核心接口（完整版）
"""
import json
import uuid
import asyncio
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.database import get_db, ChatSession, ChatMessage, Student, StudentProfile
from app.llm.spark_client import SparkClient
from app.agents.orchestrator_v2 import orchestrator as multi_orchestrator
from app.knowledge.rag import rag_engine
from app.llm.safety import check_content_safety, verify_against_knowledge_base

router = APIRouter()
spark = SparkClient()

LEARNING_SYSTEM_PROMPT = """你是"智学通"的 AI 学习助手，专注于高等教育个性化学习辅导。

## 核心能力
1. 了解学生专业、基础、目标，提供个性化建议
2. 解答专业知识问题，讲解知识点
3. 生成学习资料（文档、练习题、代码案例等）
4. 规划学习路径

## 回复规范
- 使用 Markdown 格式，结构清晰
- 语气亲切专业，像耐心的老师
- 适当使用 emoji
- 篇幅适中，重点突出

## 学生信息
{profile_text}

## 当前课程: 人工智能导论

请提供个性化学习帮助。"""


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    student_id: str = "default"


class CreateSessionRequest(BaseModel):
    student_id: str = "default"
    title: Optional[str] = "新对话"


class RenameSessionRequest(BaseModel):
    title: str


# ─── 会话管理 ───

@router.post("/sessions")
async def create_session(req: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    try:
        session_id = str(uuid.uuid4())[:8]
        result = await db.execute(select(Student).where(Student.student_id == req.student_id))
        if not result.scalar_one_or_none():
            db.add(Student(student_id=req.student_id))
            await db.flush()
        session = ChatSession(session_id=session_id, student_id=req.student_id, title=req.title or "新对话")
        db.add(session)
        await db.commit()
        return {"session_id": session_id, "title": session.title}
    except Exception as e:
        print(f"[会话创建失败] {e}")
        return {"session_id": str(uuid.uuid4())[:8], "title": req.title or "新对话"}


@router.get("/sessions/{student_id}")
async def list_sessions(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession).where(ChatSession.student_id == student_id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {"session_id": s.session_id, "title": s.title,
         "created_at": s.created_at.isoformat(),
         "updated_at": s.updated_at.isoformat() if s.updated_at else None}
        for s in sessions
    ]


@router.put("/sessions/{session_id}/rename")
async def rename_session(session_id: str, req: RenameSessionRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(ChatSession).where(ChatSession.session_id == session_id).values(title=req.title)
    )
    await db.commit()
    return {"success": True}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    # 先删消息
    await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
    )
    from sqlalchemy import delete
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    await db.execute(delete(ChatSession).where(ChatSession.session_id == session_id))
    await db.commit()
    return {"success": True}


@router.get("/messages/{session_id}")
async def get_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    )
    return [
        {"id": m.id, "role": m.role, "content": m.content,
         "message_type": m.message_type, "extra_data": m.extra_data,
         "created_at": m.created_at.isoformat()}
        for m in result.scalars().all()
    ]


# ─── 辅助函数 ───

async def _get_profile_text(student_id: str, db: AsyncSession) -> str:
    result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
    profile = result.scalar_one_or_none()
    if not profile:
        return "暂无学生信息"
    parts = []
    for field, label in [
        (profile.knowledge_base, "知识基础"), (profile.cognitive_style, "认知风格"),
        (profile.learning_goals, "学习目标"), (profile.interests, "兴趣方向"),
    ]:
        if field:
            val = field.get("value", json.dumps(field, ensure_ascii=False)) if isinstance(field, dict) else str(field)
            parts.append(f"{label}: {val}")
    return "\n".join(parts) if parts else "暂无学生信息"


async def _update_profile(user_msg: str, ai_reply: str, student_id: str, db: AsyncSession):
    """后台自动更新学生画像"""
    try:
        prompt = f"""从对话中提取学生信息，返回JSON。只返回能确定的字段：

用户: {user_msg}
AI回复: {ai_reply[:200]}

返回格式（只返回确定的字段）：
{{"knowledge_base":{{"value":"...","confidence":0.8}},"learning_goals":{{"value":"...","confidence":0.8}},"interests":{{"value":"...","confidence":0.8}},"cognitive_style":{{"value":"...","confidence":0.5}}}}

只返回JSON，不要其他内容。"""

        response = await spark.chat(prompt)
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        updates = json.loads(response)

        result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
        profile = result.scalar_one_or_none()
        if not profile:
            profile = StudentProfile(student_id=student_id)
            db.add(profile)

        for dim, data in updates.items():
            if hasattr(profile, dim) and isinstance(data, dict):
                current = getattr(profile, dim) or {}
                if "value" in data:
                    current["value"] = data["value"]
                    current["confidence"] = data.get("confidence", 0.5)
                setattr(profile, dim, current)

        profile.profile_version = (profile.profile_version or 0) + 1
        await db.commit()
    except Exception as e:
        print(f"[画像更新失败] {e}")


# ─── 核心对话 ───

@router.post("/send")
async def send_message(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    # 确保会话
    if not req.session_id:
        req.session_id = str(uuid.uuid4())[:8]
        db.add(ChatSession(session_id=req.session_id, student_id=req.student_id))
        await db.commit()

    # 保存用户消息
    db.add(ChatMessage(session_id=req.session_id, role="user", content=req.message))
    await db.commit()

    # 获取画像
    profile_text = await _get_profile_text(req.student_id, db)

    # 获取上下文
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == req.session_id)
        .order_by(ChatMessage.created_at.desc()).limit(10)
    )
    recent = list(reversed(result.scalars().all()))
    history = [{"role": m.role, "content": m.content[:300]} for m in recent]

    system_prompt = LEARNING_SYSTEM_PROMPT.format(profile_text=profile_text)

    # 判断是否需要多智能体（复杂度判断+关键词）
    multi_keywords = ["生成", "资料", "文档", "练习题", "思维导图", "代码案例", "讲解",
                      "搜索", "资源", "路径", "出题", "测试", "评估", "分析", "帮我",
                      "推荐", "规划", "比较", "区别", "总结", "步骤", "方法", "原理",
                      "什么是", "如何", "怎么", "为什么", "教我", "解释"]
    is_complex = len(req.message) > 30  # 长消息默认需要多智能体
    has_keyword = any(kw in req.message for kw in multi_keywords)
    use_multi_agent = is_complex or has_keyword

    async def generate():
        full = ""
        agents_used = []

        try:
            if use_multi_agent:
                # ── 多智能体协作模式 ──
                yield f"data: {json.dumps({'type': 'agent_start', 'agent': 'planner', 'task': '分析需求中...'}, ensure_ascii=False)}\n\n"

                multi_result = await multi_orchestrator.run(req.message, profile_text)
                full = multi_result.get("content", "")
                agents_used = multi_result.get("agents_used", [])

                # 通知前端用了哪些智能体
                for agent in agents_used:
                    yield f"data: {json.dumps({'type': 'agent_done', 'agent': agent}, ensure_ascii=False)}\n\n"

                # 流式输出聚合结果
                for i in range(0, len(full), 3):
                    chunk = full[i:i+3]
                    yield f"data: {json.dumps({'type': 'stream', 'content': chunk}, ensure_ascii=False)}\n\n"

            else:
                # ── 简单对话模式（快） ──
                # RAG: 先检索知识库
                rag_result = rag_engine.retrieve(req.message, top_k=3)
                rag_context = rag_engine.format_context(rag_result)

                rag_system = system_prompt
                if rag_context:
                    rag_system += f"\n\n【知识库参考】\n{rag_context}\n\n请优先使用知识库内容回答，如知识库无相关内容可基于你的知识补充。"

                async for chunk in spark.chat_stream(req.message, system_prompt=rag_system, history=history[:-1]):
                    full += chunk
                    yield f"data: {json.dumps({'type': 'stream', 'content': chunk}, ensure_ascii=False)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

        if full:
            # ── 防幻觉验证 ──
            rag_result = rag_engine.retrieve(req.message, top_k=3)
            rag_context = rag_engine.format_context(rag_result)
            safety_ok = await verify_against_knowledge_base(full, rag_context)

            extra = json.dumps({
                "agents": agents_used,
                "rag_sources": [d.get("source", "") for d in rag_result],
                "verification": safety_ok,
            })
            db.add(ChatMessage(session_id=req.session_id, role="assistant", content=full,
                               message_type="text", extra_data=json.loads(extra)))
            sess_result = await db.execute(select(ChatSession).where(ChatSession.session_id == req.session_id))
            sess = sess_result.scalar_one_or_none()
            if sess and sess.title == "新对话":
                title = req.message[:15].replace("\n", " ")
                await db.execute(update(ChatSession).where(ChatSession.session_id == req.session_id).values(title=title))
            await db.commit()

        yield f"data: {json.dumps({'type': 'agents_used', 'agents': agents_used}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'session_id', 'session_id': req.session_id}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

        asyncio.create_task(_update_profile(req.message, full, req.student_id, db))

    return StreamingResponse(
        generate(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
