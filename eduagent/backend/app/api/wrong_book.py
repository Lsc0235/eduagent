"""
智能错题本 API - 自动收集错题，按知识点分类，支持复习和变式练习。

错题持久化复用 LearningRecord，避免增加迁移成本：
action_type = "wrong_question"，resource_id = question_id，extra_data 存题目细节。
"""
import asyncio
import json
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.spark_client import SparkClient
from app.models.database import LearningRecord, get_db

router = APIRouter()
spark = SparkClient()

WRONG_ACTION_TYPE = "wrong_question"


class WrongQuestionItem(BaseModel):
    question_id: str
    question: str
    question_type: str = "choice"
    options: Optional[List[str]] = None
    correct_answer: str
    user_answer: str
    explanation: str = ""
    topic: str
    knowledge_point: str = ""
    is_mastered: bool = False
    practice_count: int = 0
    correct_practice_count: int = 0


class ReviewRequest(BaseModel):
    question_id: str
    is_correct: bool


class MarkMasteredRequest(BaseModel):
    question_ids: List[str]


def _normalize_options(options) -> list[str]:
    if not options:
        return []
    if isinstance(options, list):
        return [str(option) for option in options]
    return [str(options)]


def _record_to_question(record: LearningRecord) -> dict:
    extra = record.extra_data or {}
    question_id = str(extra.get("question_id") or record.resource_id)
    return {
        "question_id": question_id,
        "question": extra.get("question", ""),
        "question_type": extra.get("question_type", "choice"),
        "options": _normalize_options(extra.get("options")),
        "correct_answer": extra.get("correct_answer", ""),
        "user_answer": extra.get("user_answer", ""),
        "explanation": extra.get("explanation", ""),
        "topic": extra.get("topic") or record.topic or "未分类",
        "knowledge_point": extra.get("knowledge_point") or record.topic or "未分类",
        "is_mastered": bool(extra.get("is_mastered", False)),
        "practice_count": int(extra.get("practice_count", 0) or 0),
        "correct_practice_count": int(extra.get("correct_practice_count", 0) or 0),
        "consecutive_correct_count": int(extra.get("consecutive_correct_count", 0) or 0),
        "wrong_count": int(extra.get("wrong_count", 1) or 1),
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


async def _get_wrong_record(db: AsyncSession, student_id: str, question_id: str) -> Optional[LearningRecord]:
    result = await db.execute(
        select(LearningRecord)
        .where(
            LearningRecord.student_id == student_id,
            LearningRecord.action_type == WRONG_ACTION_TYPE,
            LearningRecord.resource_id == question_id,
        )
        .order_by(LearningRecord.created_at.desc())
    )
    return result.scalars().first()


async def _load_wrong_questions(
    db: AsyncSession,
    student_id: str,
    topic: Optional[str] = None,
    only_unmastered: bool = False,
) -> list[dict]:
    stmt = (
        select(LearningRecord)
        .where(
            LearningRecord.student_id == student_id,
            LearningRecord.action_type == WRONG_ACTION_TYPE,
        )
        .order_by(LearningRecord.created_at.desc())
    )
    if topic:
        stmt = stmt.where(LearningRecord.topic == topic)

    result = await db.execute(stmt)
    questions = [_record_to_question(record) for record in result.scalars().all()]
    if only_unmastered:
        questions = [q for q in questions if not q.get("is_mastered")]
    return questions


async def save_wrong_question(db: AsyncSession, student_id: str, item: dict) -> None:
    """保存或更新一道错题；调用方负责 commit。"""
    question_id = str(item["question_id"])
    topic = item.get("topic") or item.get("knowledge_point") or "未分类"
    knowledge_point = item.get("knowledge_point") or topic
    record = await _get_wrong_record(db, student_id, question_id)

    current = record.extra_data if record else {}
    wrong_count = int(current.get("wrong_count", 0) or 0) + (0 if item.get("is_mastered") else 1)
    data = {
        **current,
        "question_id": question_id,
        "question": item.get("question", current.get("question", "")),
        "question_type": item.get("question_type", current.get("question_type", "choice")),
        "options": _normalize_options(item.get("options", current.get("options", []))),
        "correct_answer": item.get("correct_answer", current.get("correct_answer", "")),
        "user_answer": item.get("user_answer", current.get("user_answer", "")),
        "explanation": item.get("explanation", current.get("explanation", "")),
        "topic": topic,
        "knowledge_point": knowledge_point,
        "is_mastered": bool(item.get("is_mastered", current.get("is_mastered", False))),
        "practice_count": int(current.get("practice_count", item.get("practice_count", 0)) or 0),
        "correct_practice_count": int(
            current.get("correct_practice_count", item.get("correct_practice_count", 0)) or 0
        ),
        "consecutive_correct_count": int(current.get("consecutive_correct_count", 0) or 0),
        "wrong_count": max(wrong_count, 1),
    }

    if record:
        record.topic = topic
        record.extra_data = data
    else:
        db.add(
            LearningRecord(
                student_id=student_id,
                resource_id=question_id,
                action_type=WRONG_ACTION_TYPE,
                topic=topic,
                duration=0,
                extra_data=data,
            )
        )


def _group_questions(questions: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for question in questions:
        key = question.get("knowledge_point") or "未分类"
        if key not in grouped:
            grouped[key] = {
                "knowledge_point": key,
                "questions": [],
                "total": 0,
                "mastered": 0,
            }
        grouped[key]["questions"].append(question)
        grouped[key]["total"] += 1
        if question.get("is_mastered"):
            grouped[key]["mastered"] += 1
    return list(grouped.values())


def _build_fallback_variant(original: dict) -> dict:
    answer = str(original.get("correct_answer") or "A").strip()[:1].upper() or "A"
    options = original.get("options") or [
        "A. 正确理解核心概念",
        "B. 忽略关键条件",
        "C. 只记忆表面结论",
        "D. 与题目无关",
    ]
    return {
        "question": f"换一个场景判断：关于“{original.get('knowledge_point') or original.get('topic')}”，下面哪项最符合原题考查的核心概念？",
        "options": options,
        "answer": answer,
        "explanation": original.get("explanation") or "请回到原错题的关键概念，先判断条件，再匹配正确结论。",
    }


@router.post("/save_batch")
async def save_wrong_questions_batch(
    items: List[WrongQuestionItem],
    student_id: str = "default",
    db: AsyncSession = Depends(get_db),
):
    """批量保存错题。"""
    saved_count = 0
    for item in items:
        if item.is_mastered:
            continue
        await save_wrong_question(
            db,
            student_id,
            {
                "question_id": item.question_id,
                "question": item.question,
                "question_type": item.question_type,
                "options": item.options,
                "correct_answer": item.correct_answer,
                "user_answer": item.user_answer,
                "explanation": item.explanation,
                "topic": item.topic,
                "knowledge_point": item.knowledge_point or item.topic,
                "is_mastered": False,
            },
        )
        saved_count += 1

    await db.commit()
    return {"success": True, "saved_count": saved_count}


@router.get("/list/{student_id}")
async def get_wrong_questions(
    student_id: str,
    topic: Optional[str] = None,
    only_unmastered: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """获取错题列表，按知识点分组。"""
    questions = await _load_wrong_questions(db, student_id, topic=topic, only_unmastered=only_unmastered)
    topics = sorted({q.get("topic", "") for q in questions if q.get("topic")})
    return {
        "success": True,
        "total": len(questions),
        "topics": topics,
        "grouped_questions": _group_questions(questions),
        "questions": questions,
    }


@router.get("/stats/{student_id}")
async def get_wrong_question_stats(student_id: str, db: AsyncSession = Depends(get_db)):
    """获取错题统计信息。"""
    questions = await _load_wrong_questions(db, student_id)
    total = len(questions)
    mastered = sum(1 for q in questions if q.get("is_mastered"))
    unmastered = total - mastered

    topic_stats: dict[str, dict] = {}
    for question in questions:
        topic = question.get("topic") or "未知"
        if topic not in topic_stats:
            topic_stats[topic] = {"total": 0, "mastered": 0}
        topic_stats[topic]["total"] += 1
        if question.get("is_mastered"):
            topic_stats[topic]["mastered"] += 1

    mastery_rate = (mastered / total * 100) if total else 0
    return {
        "success": True,
        "total": total,
        "mastered": mastered,
        "unmastered": unmastered,
        "mastery_rate": round(mastery_rate, 1),
        "topic_stats": topic_stats,
    }


@router.post("/mark_mastered")
async def mark_questions_mastered(
    req: MarkMasteredRequest,
    student_id: str = "default",
    db: AsyncSession = Depends(get_db),
):
    """标记题目为已掌握。"""
    updated = 0
    for question_id in req.question_ids:
        record = await _get_wrong_record(db, student_id, question_id)
        if not record:
            continue
        extra = dict(record.extra_data or {})
        extra["is_mastered"] = True
        record.extra_data = extra
        updated += 1

    await db.commit()
    return {"success": True, "updated_count": updated}


@router.post("/practice")
async def practice_wrong_question(student_id: str = "default", db: AsyncSession = Depends(get_db)):
    """抽取一道未掌握的错题进行复习。"""
    unmastered = await _load_wrong_questions(db, student_id, only_unmastered=True)
    if not unmastered:
        return {"success": True, "message": "没有需要复习的错题，全部掌握了！", "question": None}

    unmastered.sort(key=lambda q: (q.get("practice_count", 0), -q.get("wrong_count", 1)))
    selected = unmastered[0]
    return {"success": True, "question": selected, "remaining": len(unmastered) - 1}


@router.post("/generate_variant")
async def generate_variant_question(student_id: str = "default", db: AsyncSession = Depends(get_db)):
    """基于错题生成变式题目。"""
    unmastered = await _load_wrong_questions(db, student_id, only_unmastered=True)
    if not unmastered:
        return {"success": True, "message": "没有需要练习的错题", "variant": None}

    original = unmastered[0]
    prompt = f"""你是一位出题专家。请基于以下错题，生成一道变式题目（类似但不同）。

原始题目：{original['question']}
正确答案：{original['correct_answer']}
学生错误答案：{original.get('user_answer', '未知')}
知识点：{original.get('knowledge_point', original.get('topic', ''))}

要求：
1. 保持相同的知识点和难度
2. 换一个角度或场景出题
3. 考查相同的核心概念

返回JSON：
{{
    "question": "变式题目",
    "options": ["A.选项1", "B.选项2", "C.选项3", "D.选项4"],
    "answer": "A",
    "explanation": "解析"
}}

只返回JSON。"""

    try:
        response = await asyncio.wait_for(
            spark.chat(prompt, system_prompt="你是出题专家，只返回JSON。"),
            timeout=30,
        )
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1].replace("json", "", 1)
        variant = json.loads(response)
    except Exception as e:
        print(f"[变式题生成失败] {e}")
        variant = _build_fallback_variant(original)

    return {"success": True, "original": original, "variant": variant}


@router.post("/clear")
async def clear_wrong_questions(
    student_id: str = "default",
    topic: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """清空错题本。"""
    stmt = delete(LearningRecord).where(
        LearningRecord.student_id == student_id,
        LearningRecord.action_type == WRONG_ACTION_TYPE,
    )
    if topic:
        stmt = stmt.where(LearningRecord.topic == topic)
    await db.execute(stmt)
    await db.commit()
    return {"success": True, "message": "错题本已清空"}


@router.post("/review")
async def review_wrong_question(
    req: ReviewRequest,
    student_id: str = "default",
    db: AsyncSession = Depends(get_db),
):
    """复习错题：记录复习结果，连续答对 3 次后自动标记掌握。"""
    record = await _get_wrong_record(db, student_id, req.question_id)
    if not record:
        return {"success": False, "message": "题目不存在"}

    extra = dict(record.extra_data or {})
    extra["practice_count"] = int(extra.get("practice_count", 0) or 0) + 1
    if req.is_correct:
        extra["correct_practice_count"] = int(extra.get("correct_practice_count", 0) or 0) + 1
        extra["consecutive_correct_count"] = int(extra.get("consecutive_correct_count", 0) or 0) + 1
    else:
        extra["consecutive_correct_count"] = 0

    auto_mastered = extra.get("consecutive_correct_count", 0) >= 3
    if auto_mastered:
        extra["is_mastered"] = True

    record.extra_data = extra
    await db.commit()

    return {
        "success": True,
        "auto_mastered": auto_mastered,
        "message": "连续答对 3 次，已自动标记为掌握！" if auto_mastered else "复习结果已记录",
    }
