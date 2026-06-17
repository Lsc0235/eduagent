"""
答题闭环 API — 出题→答题→批改→分析→补强
"""
import json
import asyncio
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, LearningRecord
from app.llm.spark_client import SparkClient
from app.services.grading import grade_choice_answer, grade_fill_answer, grade_short_answer

router = APIRouter()
spark = SparkClient()


# ─── 数据模型 ───

class QuizRequest(BaseModel):
    topic: str
    difficulty: str = "medium"
    count: int = 5
    student_id: str = "default"


class QuizAnswer(BaseModel):
    question_id: int
    answer: str
    student_id: str = "default"


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    answers: List[QuizAnswer]
    student_id: str = "default"


# ─── 题目存储（内存） ───
quiz_store = {}


# ─── 出题 ───

@router.post("/generate")
async def generate_quiz(req: QuizRequest):
    """AI 生成练习题"""

    prompt = f"""你是一位出题专家。请为"{req.topic}"生成{req.count}道练习题。

要求：
1. 难度: {req.difficulty}（easy=基础概念, medium=应用理解, hard=综合分析）
2. 题型：选择题{max(1, req.count // 2)}道 + 填空题{max(1, req.count // 4)}道 + 简答题{max(1, req.count // 4)}道
3. 每道题附正确答案和简要解析

请严格按以下JSON格式返回，不要其他内容：
[
    {{
        "id": 1,
        "type": "choice",
        "question": "题目内容",
        "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
        "answer": "A",
        "explanation": "解析说明"
    }},
    {{
        "id": 2,
        "type": "fill",
        "question": "_____是机器学习的核心概念",
        "answer": "特征",
        "explanation": "解析"
    }},
    {{
        "id": 3,
        "type": "short_answer",
        "question": "请解释什么是过拟合",
        "answer": "模型在训练集上表现好但泛化差的现象",
        "explanation": "解析"
    }}
]

只返回JSON数组。"""

    try:
        response = await asyncio.wait_for(spark.chat(prompt), timeout=60)
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1].replace("json", "", 1)
        questions = json.loads(response)
    except Exception as e:
        print(f"[出题失败] {e}")
        # 兜底：生成简单题目
        questions = [
            {"id": 1, "type": "choice", "question": f"以下关于{req.topic}的说法，哪个是正确的？",
             "options": ["A. 它是最基础的概念", "B. 它不属于人工智能范畴", "C. 它只用于理论研究", "D. 它无法实际应用"],
             "answer": "A", "explanation": f"{req.topic}是人工智能的基础概念之一"},
            {"id": 2, "type": "fill", "question": f"{req.topic}是_____领域的核心内容",
             "answer": "人工智能", "explanation": f"{req.topic}属于人工智能领域"},
            {"id": 3, "type": "short_answer", "question": f"请简要说明{req.topic}的基本原理",
             "answer": f"请基于所学知识回答", "explanation": "这是一个开放性问题"},
        ]

    quiz_id = str(uuid.uuid4())[:8]
    quiz_store[quiz_id] = {
        "questions": questions,
        "topic": req.topic,
        "difficulty": req.difficulty,
    }

    return {"success": True, "quiz_id": quiz_id, "questions": questions}


# ─── 提交批改 ───

@router.post("/submit")
async def submit_quiz(req: QuizSubmitRequest, db: AsyncSession = Depends(get_db)):
    """提交答案并批改"""
    quiz = quiz_store.get(req.quiz_id)
    if not quiz:
        return {"success": False, "message": "测验不存在"}

    questions = quiz["questions"]
    results = []
    correct_count = 0
    total_score = 0
    wrong_topics = []

    for ans in req.answers:
        q = next((q for q in questions if q["id"] == ans.question_id), None)
        if not q:
            continue

        user_answer = ans.answer.strip()
        correct_answer = str(q["answer"]).strip()

        if q["type"] == "choice":
            grade = grade_choice_answer(user_answer, correct_answer)
        elif q["type"] == "fill":
            grade = grade_fill_answer(user_answer, correct_answer)
        elif q["type"] == "short_answer":
            grade = await grade_short_answer(
                question=q["question"],
                reference_answer=correct_answer,
                user_answer=user_answer,
                explanation=q.get("explanation", ""),
            )
        else:
            grade = grade_fill_answer(user_answer, correct_answer)

        is_correct = bool(grade.get("is_correct"))
        grade_score = int(grade.get("score", 100 if is_correct else 0))
        total_score += grade_score

        if is_correct:
            correct_count += 1
        else:
            wrong_topics.append(q.get("question", "")[:50])

        results.append({
            "question_id": q["id"],
            "question": q["question"],
            "type": q["type"],
            "user_answer": ans.answer,
            "correct_answer": q["answer"],
            "is_correct": is_correct,
            "grade_score": grade_score,
            "pass_score": grade.get("pass_score"),
            "grading_method": grade.get("grading_method"),
            "grading_basis": grade.get("grading_basis"),
            "grade_feedback": grade.get("feedback", ""),
            "matched_points": grade.get("matched_points", []),
            "missing_points": grade.get("missing_points", []),
            "normalized_user_answer": grade.get("normalized_user_answer"),
            "normalized_correct_answer": grade.get("normalized_correct_answer"),
            "explanation": q.get("explanation", ""),
        })

    total = len(req.answers)
    score = int(total_score / max(total, 1))

    # 保存学习记录
    db.add(LearningRecord(
        student_id=req.student_id,
        action_type="quiz",
        topic=quiz.get("topic", ""),
        score=score,
        extra_data={"correct": correct_count, "total": total, "wrong_topics": wrong_topics, "grading": "semantic_short_answer_v1"}
    ))
    await db.commit()

    return {
        "success": True,
        "score": score,
        "correct_count": correct_count,
        "total": total,
        "results": results,
        "wrong_topics": wrong_topics,
    }


# ─── 薄弱分析 ───

@router.get("/analysis/{student_id}")
async def quiz_analysis(student_id: str, db: AsyncSession = Depends(get_db)):
    """分析学生答题数据，找出薄弱环节"""
    result = await db.execute(
        select(LearningRecord).where(LearningRecord.student_id == student_id, LearningRecord.action_type == "quiz")
        .order_by(LearningRecord.created_at.desc()).limit(20)
    )
    records = result.scalars().all()

    if not records:
        return {"success": True, "analysis": {
            "total_quizzes": 0, "avg_score": 0,
            "weak_topics": [], "strong_topics": [],
            "recommendation": "还没有答题记录，开始第一次练习吧！"
        }}

    scores = [r.score for r in records if r.score is not None]
    avg_score = sum(scores) / len(scores) if scores else 0
    all_wrong = []
    for r in records:
        ed = r.extra_data or {}
        all_wrong.extend(ed.get("wrong_topics", []))

    # 统计高频错误
    topic_freq = {}
    for t in all_wrong:
        topic_freq[t] = topic_freq.get(t, 0) + 1
    weak_topics = sorted(topic_freq.items(), key=lambda x: x[1], reverse=True)[:5]

    # 生成补强建议
    prompt = f"""分析学生答题情况并给出补强建议：
    平均分: {avg_score:.0f}
    总练习次数: {len(records)}
    常错知识点: {weak_topics[:3]}

    请返回JSON：
    {{"recommendation": "一段话的学习建议", "focus_areas": ["需要重点补强的知识点1", "知识点2"]}}
    只返回JSON。"""

    try:
        ai_response = await asyncio.wait_for(spark.chat(prompt), timeout=30)
        ai_response = ai_response.strip()
        if "```" in ai_response:
            ai_response = ai_response.split("```")[1].replace("json", "", 1)
        ai_analysis = json.loads(ai_response)
    except Exception:
        ai_analysis = {
            "recommendation": f"平均分 {avg_score:.0f}，建议多练习薄弱知识点",
            "focus_areas": [t[0][:30] for t in weak_topics[:3]]
        }

    return {"success": True, "analysis": {
        "total_quizzes": len(records),
        "avg_score": round(avg_score, 1),
        "recent_scores": [r.score for r in records[:5]],
        "weak_topics": [t[0][:50] for t in weak_topics],
        **ai_analysis
    }}
