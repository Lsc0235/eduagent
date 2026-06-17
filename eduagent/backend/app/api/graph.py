"""
知识图谱 API — 返回课程知识点和关系数据
"""
from fastapi import APIRouter, Depends
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import LearningRecord, StudentProfile, get_db

router = APIRouter()

KNOWLEDGE_GRAPH = {
    "course": "人工智能导论",
    "nodes": [
        {"id": "ai_overview", "name": "AI概述", "level": 1, "color": "#4F46E5"},
        {"id": "search", "name": "搜索算法", "level": 2, "color": "#7C3AED"},
        {"id": "knowledge_rep", "name": "知识表示", "level": 2, "color": "#7C3AED"},
        {"id": "ml_basics", "name": "机器学习基础", "level": 2, "color": "#2563EB"},
        {"id": "supervised", "name": "监督学习", "level": 3, "color": "#059669"},
        {"id": "unsupervised", "name": "无监督学习", "level": 3, "color": "#059669"},
        {"id": "linear_reg", "name": "线性回归", "level": 4, "color": "#D97706"},
        {"id": "decision_tree", "name": "决策树", "level": 4, "color": "#D97706"},
        {"id": "svm", "name": "SVM", "level": 4, "color": "#D97706"},
        {"id": "neural_network", "name": "神经网络", "level": 3, "color": "#DC2626"},
        {"id": "deep_learning", "name": "深度学习", "level": 4, "color": "#DC2626"},
        {"id": "cnn", "name": "CNN", "level": 5, "color": "#7C3AED"},
        {"id": "rnn", "name": "RNN", "level": 5, "color": "#7C3AED"},
        {"id": "nlp", "name": "NLP", "level": 5, "color": "#0891B2"},
        {"id": "cv", "name": "计算机视觉", "level": 5, "color": "#0891B2"},
        {"id": "rl", "name": "强化学习", "level": 5, "color": "#D97706"},
    ],
    "edges": [
        {"from": "ai_overview", "to": "search"},
        {"from": "ai_overview", "to": "knowledge_rep"},
        {"from": "ai_overview", "to": "ml_basics"},
        {"from": "ml_basics", "to": "supervised"},
        {"from": "ml_basics", "to": "unsupervised"},
        {"from": "supervised", "to": "linear_reg"},
        {"from": "supervised", "to": "decision_tree"},
        {"from": "supervised", "to": "svm"},
        {"from": "supervised", "to": "neural_network"},
        {"from": "neural_network", "to": "deep_learning"},
        {"from": "deep_learning", "to": "cnn"},
        {"from": "deep_learning", "to": "rnn"},
        {"from": "rnn", "to": "nlp"},
        {"from": "cnn", "to": "cv"},
        {"from": "neural_network", "to": "rl"},
    ]
}


@router.get("/graph")
async def get_knowledge_graph():
    return {"success": True, "graph": KNOWLEDGE_GRAPH}


def _profile_text(profile: Optional[StudentProfile]) -> str:
    if not profile:
        return ""
    parts = []
    for field in [
        profile.knowledge_base,
        profile.cognitive_style,
        profile.learning_ability,
        profile.error_patterns,
        profile.learning_goals,
        profile.interests,
        profile.learning_habits,
    ]:
        if isinstance(field, dict) and field.get("value"):
            parts.append(str(field["value"]))
    return "；".join(parts)


@router.get("/recommend/{student_id}")
async def recommend_learning_path(student_id: str, db: AsyncSession = Depends(get_db)):
    """基于画像和学习记录推荐个性化学习路径。"""
    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = profile_result.scalar_one_or_none()
    record_result = await db.execute(
        select(LearningRecord)
        .where(LearningRecord.student_id == student_id)
        .order_by(LearningRecord.created_at.asc())
    )
    records = record_result.scalars().all()

    text = _profile_text(profile)
    weak_text = ""
    if profile and isinstance(profile.error_patterns, dict):
        weak_text = profile.error_patterns.get("value", "")
    for record in records:
        extra = record.extra_data or {}
        weak = extra.get("weak") or extra.get("wrong_topics") or []
        if isinstance(weak, list):
            weak_text += "；" + "；".join(str(item) for item in weak)
        elif weak:
            weak_text += "；" + str(weak)

    score_by_topic = {r.topic: r.score for r in records if r.score is not None}

    base_order = [
        "ai_overview",
        "ml_basics",
        "supervised",
        "neural_network",
        "deep_learning",
        "cnn",
        "rnn",
        "nlp",
    ]
    if "决策树" in text or "过拟合" in weak_text:
        base_order.insert(3, "decision_tree")
    if "线性" in text or "回归" in text:
        base_order.insert(3, "linear_reg")
    if "计算机视觉" in text or "图像" in text:
        base_order.append("cv")
    if "强化学习" in text:
        base_order.append("rl")

    node_map = {node["id"]: node for node in KNOWLEDGE_GRAPH["nodes"]}
    seen = set()
    path = []
    for node_id in base_order:
        if node_id in seen or node_id not in node_map:
            continue
        seen.add(node_id)
        node = node_map[node_id]
        status = "recommended"
        if any(node["name"] in topic for topic in score_by_topic):
            score = next(score for topic, score in score_by_topic.items() if node["name"] in topic)
            status = "mastered" if score and score >= 80 else "weak"
        reason = "符合知识先修关系"
        if node["name"] in weak_text:
            reason = "测验或画像显示该知识点需要补强"
        elif node["name"] in text:
            reason = "与学生目标或兴趣高度相关"
        elif node["level"] <= 2:
            reason = "作为后续算法学习的基础"
        path.append({
            "id": node["id"],
            "name": node["name"],
            "level": node["level"],
            "color": node["color"],
            "status": status,
            "reason": reason,
            "estimated_time": "1.5小时" if node["level"] <= 2 else "2小时" if node["level"] <= 4 else "2.5小时",
        })

    return {
        "success": True,
        "student_id": student_id,
        "profile_used": bool(text),
        "weak_points": [item for item in weak_text.split("；") if item][:5],
        "path": path,
        "strategy": "先补基础与错因，再进入目标相关的高阶应用模块",
    }
