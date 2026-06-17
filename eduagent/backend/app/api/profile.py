"""
画像 API — 学生画像查询与更新
"""
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import get_db, StudentProfile, Student

router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    student_id: str = "default"
    conversation: str  # 用户的最新对话内容


class ProfileQuickSetupRequest(BaseModel):
    student_id: str = "default"
    major: str = ""
    grade: str = ""
    knowledge_base: str = ""
    cognitive_style: str = ""
    learning_ability: str = ""
    error_patterns: str = ""
    learning_goals: str = ""
    interests: str = ""
    learning_habits: str = ""


PROFILE_LABELS = {
    "knowledge_base": "知识基础",
    "cognitive_style": "认知风格",
    "learning_ability": "学习能力",
    "error_patterns": "易错模式",
    "learning_goals": "学习目标",
    "interests": "兴趣方向",
    "learning_habits": "学习习惯",
}


def _dimension(value: str, source: str, confidence: float = 0.86) -> dict:
    return {
        "value": value.strip(),
        "confidence": confidence,
        "source": source,
    } if value and value.strip() else {}


@router.get("/{student_id}")
async def get_profile(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取学生画像"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return {
            "student_id": student_id,
            "exists": False,
            "dimensions": {}
        }

    return {
        "student_id": student_id,
        "exists": True,
        "dimensions": {
            "knowledge_base": profile.knowledge_base or {},
            "cognitive_style": profile.cognitive_style or {},
            "learning_ability": profile.learning_ability or {},
            "error_patterns": profile.error_patterns or {},
            "learning_goals": profile.learning_goals or {},
            "interests": profile.interests or {},
            "learning_habits": profile.learning_habits or {},
        },
        "profile_version": profile.profile_version,
        "raw_text": profile.raw_text,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


@router.post("/quick_setup")
async def quick_setup_profile(req: ProfileQuickSetupRequest, db: AsyncSession = Depends(get_db)):
    """快速建档：不依赖大模型，直接生成可被资源生成链路读取的 7 维画像。"""
    result = await db.execute(select(Student).where(Student.student_id == req.student_id))
    student = result.scalar_one_or_none()
    if not student:
        student = Student(student_id=req.student_id, name=req.major or "默认学生")
        db.add(student)
        await db.flush()

    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == req.student_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        profile = StudentProfile(student_id=req.student_id)
        db.add(profile)

    identity = "、".join([item for item in [req.major.strip(), req.grade.strip()] if item])
    source = "快速画像建档"
    values = {
        "knowledge_base": req.knowledge_base or (f"{identity}，已具备基础课程背景，待进一步识别具体薄弱点。" if identity else ""),
        "cognitive_style": req.cognitive_style,
        "learning_ability": req.learning_ability,
        "error_patterns": req.error_patterns,
        "learning_goals": req.learning_goals,
        "interests": req.interests,
        "learning_habits": req.learning_habits,
    }

    filled = 0
    for field, label in PROFILE_LABELS.items():
        value = values.get(field, "")
        dim = _dimension(value, source)
        if dim:
            filled += 1
            setattr(profile, field, dim)

    profile.profile_version = (profile.profile_version or 0) + 1
    profile.raw_text = "\n".join([
        f"专业/年级：{identity or '未填写'}",
        *[f"{label}：{values.get(field, '')}" for field, label in PROFILE_LABELS.items() if values.get(field, "")],
    ])
    await db.commit()

    return {
        "success": True,
        "student_id": req.student_id,
        "profile_version": profile.profile_version,
        "filled_dimensions": filled,
        "summary": f"已完成 {filled}/7 个画像维度建档",
    }


@router.post("/update")
async def update_profile(req: ProfileUpdateRequest, db: AsyncSession = Depends(get_db)):
    """通过对话更新学生画像"""
    from app.agents.profiler import ProfilerAgent
    from app.agents.base import AgentMessage, MessageType

    # 获取当前画像
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == req.student_id)
    )
    profile = result.scalar_one_or_none()

    current_data = {}
    if profile:
        current_data = {
            "knowledge_base": profile.knowledge_base,
            "cognitive_style": profile.cognitive_style,
            "learning_ability": profile.learning_ability,
        }

    # 调用画像 Agent
    profiler = ProfilerAgent()
    agent_msg = AgentMessage(
        sender="api",
        receiver="profiler",
        message_type=MessageType.REQUEST,
        content={"user_message": req.conversation, "task": "更新画像"},
        context={"profile": current_data}
    )
    response = await profiler.safe_process(agent_msg)

    if not response.success:
        return {"success": False, "message": response.message}

    # 更新画像
    updates = response.content.get("profile", {})

    if not profile:
        # 创建新画像
        profile = StudentProfile(student_id=req.student_id)
        db.add(profile)

    # 应用更新
    for dim_name, dim_data in updates.items():
        if hasattr(profile, dim_name) and isinstance(dim_data, dict):
            current = getattr(profile, dim_name) or {}
            if isinstance(dim_data, dict) and "value" in dim_data:
                current["value"] = dim_data["value"]
                current["confidence"] = dim_data.get("confidence", 0.5)
            else:
                current.update(dim_data)
            setattr(profile, dim_name, current)

    profile.profile_version = (profile.profile_version or 0) + 1
    await db.commit()

    return {
        "success": True,
        "updates": updates,
        "summary": response.content.get("summary", ""),
        "version": profile.profile_version
    }
