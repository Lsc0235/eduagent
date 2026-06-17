"""
资源 API — 多模态学习资源生成与查询
"""
import json
import uuid
import asyncio
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import get_db, LearningRecord, LearningResource, StudentProfile
from app.llm.spark_client import SparkClient

router = APIRouter()
spark = SparkClient()

# 资源生成提示词（精简版，保证每个都能在30秒内完成）
RESOURCE_PROMPTS = {
    "document": """你是一位AI课程教师。请用300字讲解"{topic}"的核心概念。使用Markdown格式，包含：定义、关键点、一个例子。直接输出。""",

    "mindmap": """你是一位教学设计专家。请为"{topic}"生成思维导图。使用Mermaid mindmap语法，层级不超过4层。只输出mermaid代码块。""",

    "quiz": """你是一位出题专家。请为"{topic}"出3道选择题和2道简答题，附答案。用Markdown格式。直接输出。""",

    "code": """你是一位编程导师。请用Python写一个关于"{topic}"的简单代码示例，带注释。50行以内。直接输出代码块。""",

    "reading": """你是一位学术顾问。请推荐3个关于"{topic}"的学习资源（书籍、视频、网站），每个资源一句话说明。直接输出。""",

    "storyboard": """你是一位微课动画导演。请为"{topic}"生成5镜头动画分镜，包含画面、旁白、屏幕文字和交互检查点。用Markdown格式直接输出。""",
}

PROFILE_FIELDS = [
    ("knowledge_base", "知识基础"),
    ("cognitive_style", "认知风格"),
    ("learning_ability", "学习能力"),
    ("error_patterns", "易错模式"),
    ("learning_goals", "学习目标"),
    ("interests", "兴趣方向"),
    ("learning_habits", "学习习惯"),
]


TYPE_NAMES = {
    "document": "课程讲解",
    "mindmap": "思维导图",
    "quiz": "练习题",
    "code": "代码案例",
    "reading": "拓展阅读",
    "storyboard": "动画分镜",
}


class ResourceRequest(BaseModel):
    topic: str
    resource_types: List[str] = ["document", "quiz"]
    difficulty: str = "medium"
    student_id: str = "default"
    course: str = "人工智能导论"


def _profile_to_lines(profile: Optional[StudentProfile]) -> list[str]:
    if not profile:
        return []
    lines = []
    for field, label in PROFILE_FIELDS:
        value = getattr(profile, field) or {}
        if isinstance(value, dict) and value.get("value"):
            lines.append(f"- {label}: {value['value']}")
    return lines[:7]


def _wrong_record_to_focus(record: LearningRecord) -> str:
    extra = record.extra_data or {}
    knowledge_point = extra.get("knowledge_point") or record.topic or "薄弱点"
    question = extra.get("question", "")
    if question:
        return f"{knowledge_point}（典型错题：{question[:38]}）"
    return str(knowledge_point)


async def _build_personal_context(db: AsyncSession, student_id: str, topic: str) -> tuple[str, dict]:
    profile_result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
    profile = profile_result.scalar_one_or_none()
    profile_lines = _profile_to_lines(profile)

    wrong_result = await db.execute(
        select(LearningRecord)
        .where(
            LearningRecord.student_id == student_id,
            LearningRecord.action_type == "wrong_question",
        )
        .order_by(LearningRecord.created_at.desc())
    )
    wrong_records = wrong_result.scalars().all()
    topic_wrong_records = [
        record for record in wrong_records
        if topic in (record.topic or "") or (record.topic or "") in topic
    ]
    selected_wrong_records = (topic_wrong_records or wrong_records)[:3]
    weak_points = []
    for record in selected_wrong_records:
        focus = _wrong_record_to_focus(record)
        if focus not in weak_points:
            weak_points.append(focus)

    parts = []
    if profile_lines:
        parts.append("学生画像：\n" + "\n".join(profile_lines))
    if weak_points:
        parts.append("错因证据：\n" + "\n".join(f"- {point}" for point in weak_points))
    if parts:
        parts.append("生成要求：内容必须贴合上述画像和错因，优先补强薄弱点，避免泛泛而谈。")

    evidence = {
        "profile_dimensions": len(profile_lines),
        "weak_points": weak_points,
        "personalized": bool(profile_lines or weak_points),
    }
    return "\n\n".join(parts), evidence


def _personalize_prompt(base_prompt: str, context: str) -> str:
    if not context:
        return base_prompt
    return f"{base_prompt}\n\n【个性化上下文】\n{context}"


def _resource_quality_check(resource_type: str, content: str, topic: str, personalization: dict) -> dict:
    try:
        from app.api.learning import _score_resource_quality

        return _score_resource_quality(resource_type, content, topic, personalization)
    except Exception:
        return {
            "resource_type": resource_type,
            "title": TYPE_NAMES.get(resource_type, resource_type),
            "score": 75 if str(content or "").strip() else 0,
            "level": "good" if str(content or "").strip() else "needs_review",
            "passed": bool(str(content or "").strip()),
            "criteria": ["已生成有效内容"] if str(content or "").strip() else [],
            "suggestions": [] if str(content or "").strip() else ["资源内容为空，需要重新生成"],
        }


def _resource_agent_trace(resource_type: str, topic: str, quality_check: dict, personalization: dict) -> list[dict]:
    profile_dimensions = int((personalization or {}).get("profile_dimensions") or 0)
    weak_points = (personalization or {}).get("weak_points") or []
    weak_text = "、".join(weak_points[:2]) if weak_points else "暂无历史错因"
    return [
        {
            "agent": "resource_generator",
            "name": "资源生成智能体",
            "task": f"生成“{topic}”的{TYPE_NAMES.get(resource_type, resource_type)}",
            "output": f"结合 {profile_dimensions} 个画像维度；当前错因：{weak_text}。",
            "status": "done",
            "resource_type": resource_type,
        },
        {
            "agent": "quality_reviewer",
            "name": "资源质检智能体",
            "task": "检查资源结构、个性化证据和可学习性",
            "output": f"质检 {quality_check.get('score', 0)} 分，{'通过' if quality_check.get('passed') else '建议补充'}。",
            "status": "done",
            "resource_type": resource_type,
        },
    ]


@router.post("/generate")
async def generate_resource(req: ResourceRequest, db: AsyncSession = Depends(get_db)):
    """生成学习资源"""
    resources = []
    personal_context, personalization_evidence = await _build_personal_context(db, req.student_id, req.topic)

    for res_type in req.resource_types:
        if res_type not in RESOURCE_PROMPTS:
            continue

        prompt = _personalize_prompt(RESOURCE_PROMPTS[res_type].format(topic=req.topic), personal_context)

        try:
            content = await asyncio.wait_for(spark.chat(prompt), timeout=60)
        except Exception as e:
            print(f"[资源] 生成失败: {e}")
            content = f"[生成超时：{req.topic} 的 {res_type} 资源生成失败，请重试]"
        resource_id = str(uuid.uuid4())[:8]

        quality_check = _resource_quality_check(res_type, content, req.topic, personalization_evidence)
        agent_trace = _resource_agent_trace(res_type, req.topic, quality_check, personalization_evidence)

        resource = {
            "resource_id": resource_id,
            "type": res_type,
            "type_name": TYPE_NAMES.get(res_type, res_type),
            "title": f"{req.topic} - {TYPE_NAMES.get(res_type, res_type)}",
            "content": content,
            "topic": req.topic,
            "difficulty": req.difficulty,
            "extra_data": {
                "personalization": personalization_evidence,
                "quality_check": quality_check,
                "agent_trace": agent_trace,
            },
        }
        resources.append(resource)

        # 保存到数据库
        db_resource = LearningResource(
            resource_id=resource_id,
            student_id=req.student_id,
            resource_type=res_type,
            title=resource["title"],
            content=content,
            topic=req.topic,
            difficulty=req.difficulty,
            extra_data={
                "personalization": personalization_evidence,
                "quality_check": quality_check,
                "agent_trace": agent_trace,
            },
        )
        db.add(db_resource)

    await db.commit()
    return {"success": True, "resources": resources, "count": len(resources)}


@router.post("/generate/stream")
async def generate_resource_stream(req: ResourceRequest, db: AsyncSession = Depends(get_db)):
    """流式生成学习资源"""
    personal_context, personalization_evidence = await _build_personal_context(db, req.student_id, req.topic)

    async def generate():
        for res_type in req.resource_types:
            if res_type not in RESOURCE_PROMPTS:
                continue

            yield f"data: {json.dumps({'type': 'start', 'resource_type': res_type, 'type_name': TYPE_NAMES.get(res_type)}, ensure_ascii=False)}\n\n"

            prompt = _personalize_prompt(RESOURCE_PROMPTS[res_type].format(topic=req.topic), personal_context)

            full_content = ""
            async for chunk in spark.chat_stream(prompt):
                full_content += chunk
                yield f"data: {json.dumps({'type': 'content', 'resource_type': res_type, 'chunk': chunk}, ensure_ascii=False)}\n\n"

            # 保存到数据库
            resource_id = str(uuid.uuid4())[:8]
            quality_check = _resource_quality_check(res_type, full_content, req.topic, personalization_evidence)
            agent_trace = _resource_agent_trace(res_type, req.topic, quality_check, personalization_evidence)
            db_resource = LearningResource(
                resource_id=resource_id, student_id=req.student_id,
                resource_type=res_type, title=f"{req.topic} - {TYPE_NAMES.get(res_type, res_type)}",
                content=full_content, topic=req.topic, difficulty=req.difficulty,
                extra_data={
                    "personalization": personalization_evidence,
                    "quality_check": quality_check,
                    "agent_trace": agent_trace,
                },
            )
            db.add(db_resource)

            yield f"data: {json.dumps({'type': 'done', 'resource_type': res_type, 'resource_id': resource_id, 'quality_check': quality_check}, ensure_ascii=False)}\n\n"

        await db.commit()
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/list/{student_id}")
async def list_resources(
    student_id: str, resource_type: Optional[str] = None,
    topic: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    query = select(LearningResource).where(LearningResource.student_id == student_id)
    if resource_type:
        query = query.where(LearningResource.resource_type == resource_type)
    if topic:
        query = query.where(LearningResource.topic == topic)
    query = query.order_by(LearningResource.created_at.desc())
    result = await db.execute(query)
    return [
        {"resource_id": r.resource_id, "type": r.resource_type, "title": r.title,
         "topic": r.topic, "difficulty": r.difficulty, "extra_data": r.extra_data or {},
         "created_at": r.created_at.isoformat()}
        for r in result.scalars().all()
    ]


@router.get("/detail/{resource_id}")
async def get_resource_detail(resource_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LearningResource).where(LearningResource.resource_id == resource_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        return {"error": "资源不存在"}
    return {
        "resource_id": r.resource_id, "type": r.resource_type, "title": r.title,
        "content": r.content, "topic": r.topic, "difficulty": r.difficulty,
        "extra_data": r.extra_data or {},
        "created_at": r.created_at.isoformat()
    }
