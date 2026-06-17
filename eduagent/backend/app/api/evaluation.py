"""
评估 API — 基于画像、资源、测验和学习记录的即时学习评估
"""
from fastapi import APIRouter, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import (
    ChatMessage,
    ChatSession,
    LearningRecord,
    LearningResource,
    StudentProfile,
    get_db,
)

router = APIRouter()


def _generate_fallback_report() -> dict:
    """默认报告"""
    return {
        "overall_score": 50,
        "dimensions": {
            "knowledge_mastery": {"score": 50, "comment": "尚未有足够的学习数据"},
            "learning_efficiency": {"score": 50, "comment": "建议开始使用系统学习"},
            "practice_ability": {"score": 45, "comment": "可以尝试生成练习题"},
            "consistency": {"score": 40, "comment": "建议保持规律学习"},
        },
        "strengths": ["已开始使用学习系统"],
        "weaknesses": ["学习数据较少"],
        "recommendations": ["去资源中心生成一些练习题", "在智能对话中多交流"],
        "next_focus": "从基础知识点开始学习",
        "evidence": {
            "profile_dimensions": 0,
            "resource_count": 0,
            "resource_types": [],
            "quality_resource_count": 0,
            "avg_resource_quality": None,
            "agent_trace_count": 0,
            "conversation_count": 0,
            "quiz_count": 0,
            "avg_quiz_score": None,
            "latest_quiz_score": None,
            "learning_minutes": 0,
            "weak_points": [],
        },
        "timeline": [],
    }


def _profile_dimensions(profile: Optional[StudentProfile]) -> list[str]:
    if not profile:
        return []
    fields = [
        "knowledge_base",
        "cognitive_style",
        "learning_ability",
        "error_patterns",
        "learning_goals",
        "interests",
        "learning_habits",
    ]
    filled = []
    for field in fields:
        value = getattr(profile, field) or {}
        if isinstance(value, dict) and value.get("value"):
            filled.append(field)
    return filled


def _collect_weak_points(records: list[LearningRecord], profile: Optional[StudentProfile]) -> list[str]:
    weak_points: list[str] = []
    if profile and isinstance(profile.error_patterns, dict) and profile.error_patterns.get("value"):
        weak_points.append(profile.error_patterns["value"])
    for record in records:
        extra = record.extra_data or {}
        weak = extra.get("weak") or extra.get("wrong_topics") or []
        if isinstance(weak, str):
            weak = [weak]
        if record.action_type == "wrong_question":
            kp = extra.get("knowledge_point") or record.topic
            if kp:
                weak = [*weak, kp]
        for item in weak:
            if item and item not in weak_points:
                weak_points.append(str(item))
    return weak_points[:5]


@router.get("/report/{student_id}")
async def get_evaluation_report(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取学习评估报告 — 基于真实数据，秒出结果"""
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = profile_result.scalar_one_or_none()

    # 统计资源
    res_result = await db.execute(
        select(LearningResource).where(LearningResource.student_id == student_id)
    )
    resources = res_result.scalars().all()

    record_result = await db.execute(
        select(LearningRecord)
        .where(LearningRecord.student_id == student_id)
        .order_by(LearningRecord.created_at.asc())
    )
    records = record_result.scalars().all()

    # 统计对话消息
    msg_result = await db.execute(
        select(ChatMessage).join(ChatSession).where(ChatSession.student_id == student_id)
    )
    messages = msg_result.scalars().all()

    res_count = len(resources)
    msg_count = len(messages)

    if res_count == 0 and msg_count == 0 and not records:
        return {"success": True, "report": _generate_fallback_report()}

    res_types = set(r.resource_type for r in resources)
    type_diversity = len(res_types)
    quality_checks = [
        (r.extra_data or {}).get("quality_check")
        for r in resources
        if isinstance((r.extra_data or {}).get("quality_check"), dict)
    ]
    quality_scores = [float(item.get("score", 0)) for item in quality_checks if item.get("score") is not None]
    avg_quality_score = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else None
    passed_quality_count = len([item for item in quality_checks if item.get("passed")])
    resource_agent_traces = [
        step
        for r in resources
        for step in ((r.extra_data or {}).get("agent_trace") or [])
        if isinstance(step, dict)
    ]
    user_msgs = [m for m in messages if m.role == "user"]
    conversation_count = len(user_msgs)
    chat_agent_traces = [
        agent
        for m in messages
        for agent in ((m.extra_data or {}).get("agents") or [])
    ]
    profile_filled = _profile_dimensions(profile)
    learning_records = [r for r in records if r.action_type in {"study", "quiz", "reinforce"}]
    record_agent_traces = [
        step
        for r in learning_records
        for step in ((r.extra_data or {}).get("agent_trace") or [])
        if isinstance(step, dict)
    ]
    quiz_records = [r for r in learning_records if r.action_type == "quiz" and r.score is not None]
    scores = [float(r.score) for r in quiz_records]
    avg_score = round(sum(scores) / len(scores), 1) if scores else None
    latest_score = scores[-1] if scores else None
    learning_minutes = sum(r.duration or 0 for r in learning_records)
    weak_points = _collect_weak_points(records, profile)
    improved = len(scores) >= 2 and scores[-1] > scores[0]

    # 评分算法：画像完整度、资源覆盖、测验表现、闭环行为共同决定
    profile_score = min(35 + len(profile_filled) * 9, 98)
    knowledge_score = min(45 + res_count * 4 + type_diversity * 5 + (8 if avg_quality_score and avg_quality_score >= 75 else 0), 96)
    practice_score = int(min(45 + len(quiz_records) * 10 + (avg_score or 0) * 0.35, 96))
    adaptation_score = min(
        40
        + (20 if weak_points else 0)
        + (18 if any(r.action_type == "reinforce" for r in learning_records) else 0)
        + (12 if improved else 0),
        96,
    )
    consistency_score = min(35 + conversation_count * 3 + len(learning_records) * 5 + learning_minutes // 8, 94)

    overall = int((profile_score + knowledge_score + practice_score + adaptation_score + consistency_score) / 5)

    strengths = []
    weaknesses = []
    recs = []

    if len(profile_filled) >= 6:
        strengths.append(f"学生画像覆盖 {len(profile_filled)} 个维度，可支撑个性化推荐")
    else:
        weaknesses.append("画像维度不足，建议通过对话补充基础、目标、习惯等信息")

    if res_count > 0:
        strengths.append(f"已沉淀 {res_count} 份学习资源，覆盖 {len(res_types)} 种类型")
    else:
        weaknesses.append("尚未生成学习资源")

    if quality_scores:
        strengths.append(f"{len(quality_scores)} 份资源带有质检结果，平均质检 {avg_quality_score} 分")
        if passed_quality_count < len(quality_scores):
            weaknesses.append("部分资源质检未达通过线，需要补充例子、结构或可运行性")
    else:
        weaknesses.append("资源尚缺少自动质检证据")
        recs.append("生成或更新学习资源，让系统自动完成资源质检")

    if scores:
        strengths.append(f"完成 {len(scores)} 次测验，平均分 {avg_score}")
    else:
        weaknesses.append("缺少测验成绩，无法验证掌握程度")

    if improved:
        strengths.append(f"补强后分数从 {scores[0]:.0f} 提升到 {scores[-1]:.0f}")

    if weak_points:
        weaknesses.append(f"当前薄弱点集中在：{'、'.join(weak_points[:3])}")

    if "quiz" not in res_types:
        recs.append("生成练习题并完成一次在线测评，补齐掌握度证据")

    if "code" not in res_types:
        recs.append("生成代码案例，验证概念能否迁移到实践任务")

    if "storyboard" not in res_types:
        recs.append("生成动画分镜或微课脚本，补齐多模态资源展示能力")

    if len(profile_filled) < 7:
        recs.append("继续通过智能对话补齐学习习惯、兴趣方向和易错点画像")

    if conversation_count < 3:
        recs.append("多在智能对话中提出学习问题，让画像动态更新")

    if weak_points:
        recs.append(f"围绕“{weak_points[0]}”生成补强资料并再次测试")

    if not recs:
        recs.append("保持现有学习节奏，下一步挑战更高阶综合项目")

    timeline = []
    for record in learning_records[-6:]:
        labels = {"study": "学习资料", "quiz": "在线测评", "reinforce": "补强学习"}
        timeline.append({
            "type": record.action_type,
            "title": labels.get(record.action_type, record.action_type),
            "topic": record.topic,
            "score": record.score,
            "duration": record.duration,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        })

    report = {
        "overall_score": overall,
        "dimensions": {
            "profile_quality": {"score": profile_score, "comment": f"画像覆盖 {len(profile_filled)}/7 维"},
            "knowledge_mastery": {"score": knowledge_score, "comment": f"{res_count} 份资源，{type_diversity} 类"},
            "practice_ability": {"score": practice_score, "comment": f"{len(scores)} 次测验" if scores else "暂无测验"},
            "adaptive_closure": {"score": adaptation_score, "comment": "已形成补强闭环" if improved else "建议补强再测"},
            "consistency": {"score": consistency_score, "comment": f"{learning_minutes} 分钟学习记录"},
        },
        "strengths": strengths[:4] if strengths else ["开始使用学习系统"],
        "weaknesses": weaknesses[:4] if weaknesses else ["暂无显著薄弱项"],
        "recommendations": recs[:5],
        "next_focus": weak_points[0] if weak_points else "继续深化学习",
        "evidence": {
            "profile_dimensions": len(profile_filled),
            "resource_count": res_count,
            "resource_types": sorted(res_types),
            "quality_resource_count": len(quality_scores),
            "quality_passed_count": passed_quality_count,
            "avg_resource_quality": avg_quality_score,
            "agent_trace_count": len(resource_agent_traces) + len(record_agent_traces) + len(chat_agent_traces),
            "conversation_count": conversation_count,
            "quiz_count": len(scores),
            "avg_quiz_score": avg_score,
            "latest_quiz_score": latest_score,
            "learning_minutes": learning_minutes,
            "weak_points": weak_points,
        },
        "timeline": timeline,
    }

    return {"success": True, "report": report}
