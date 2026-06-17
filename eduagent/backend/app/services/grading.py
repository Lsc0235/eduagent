"""
统一判分服务。

核心原则：选择题按选项字母归一化，填空题允许合理包含关系，简答题按语义和得分点评分，
避免把开放性回答做成机械的逐字匹配。
"""
import asyncio
import json
import re
from typing import Any, List, Optional, Set

from app.llm.spark_client import SparkClient


spark = SparkClient()
PASS_SCORE = 70

_CHOICE_RE = re.compile(r"^\s*([A-Da-d])(?:[\.．、:：\)\] ]|$)")
_NON_CONTENT_RE = re.compile(r"[^0-9a-zA-Z\u4e00-\u9fff]+")
_STOP_CHARS = set("的是了和与及或在把被对中里为以其该这个一个一种可以进行通过主要相关")


def _clamp_score(value: Any) -> int:
    try:
        score = int(round(float(value)))
    except Exception:
        score = 0
    return max(0, min(100, score))


def _grade_payload(
    *,
    score: int,
    feedback: str,
    matched_points: Optional[List[str]] = None,
    missing_points: Optional[List[str]] = None,
    normalized_user_answer: Optional[str] = None,
    normalized_correct_answer: Optional[str] = None,
    grading_method: str = "rule",
    grading_basis: str = "规则判分",
) -> dict:
    score = _clamp_score(score)
    return {
        "is_correct": score >= PASS_SCORE,
        "score": score,
        "pass_score": PASS_SCORE,
        "grading_method": grading_method,
        "grading_basis": grading_basis,
        "feedback": feedback,
        "matched_points": matched_points or [],
        "missing_points": missing_points or [],
        "normalized_user_answer": normalized_user_answer,
        "normalized_correct_answer": normalized_correct_answer,
    }


def normalize_choice_answer(value: Any) -> str:
    text = str(value or "").strip()
    match = _CHOICE_RE.match(text)
    if match:
        return match.group(1).upper()
    return text[:1].upper() if len(text) == 1 else text.upper()


def normalize_text(value: Any) -> str:
    return _NON_CONTENT_RE.sub("", str(value or "").strip().lower())


def grade_choice_answer(user_answer: Any, correct_answer: Any) -> dict:
    user = normalize_choice_answer(user_answer)
    correct = normalize_choice_answer(correct_answer)
    is_correct = bool(user and correct and user == correct)
    return _grade_payload(
        score=100 if is_correct else 0,
        feedback="选择题已按选项字母归一化判分。" if is_correct else "选择题答案与正确选项不一致。",
        normalized_user_answer=user,
        normalized_correct_answer=correct,
        grading_method="choice_normalized",
        grading_basis="选项字母归一化",
    )


def _meaningful_units(text: str) -> Set[str]:
    text = normalize_text(text)
    units = set(re.findall(r"[a-z0-9]+", text))
    units.update(ch for ch in text if "\u4e00" <= ch <= "\u9fff" and ch not in _STOP_CHARS)
    return units


def grade_fill_answer(user_answer: Any, correct_answer: Any) -> dict:
    user = normalize_text(user_answer)
    correct = normalize_text(correct_answer)
    if not user:
        return _grade_payload(score=0, feedback="未填写答案。", normalized_user_answer=user, normalized_correct_answer=correct)
    if not correct:
        return _grade_payload(
            score=60,
            feedback="本题缺少标准答案，已按有效作答给部分分。",
            normalized_user_answer=user,
            normalized_correct_answer=correct,
            grading_method="fill_fallback",
            grading_basis="有效作答兜底",
        )
    if user == correct or user in correct or correct in user:
        return _grade_payload(
            score=100,
            feedback="填空题答案与参考答案语义一致。",
            normalized_user_answer=user,
            normalized_correct_answer=correct,
            grading_method="fill_semantic",
            grading_basis="规范化文本与包含关系",
        )

    correct_units = _meaningful_units(correct)
    user_units = _meaningful_units(user)
    overlap = len(correct_units & user_units) / max(len(correct_units), 1)
    if overlap >= 0.65:
        score = 80
        feedback = "填空题命中多数关键内容，判为正确。"
    elif overlap >= 0.4:
        score = 55
        feedback = "填空题命中部分关键内容，但还不够完整。"
    else:
        score = 0
        feedback = "填空题与参考答案差异较大。"
    return _grade_payload(
        score=score,
        feedback=feedback,
        normalized_user_answer=user,
        normalized_correct_answer=correct,
        grading_method="fill_key_overlap",
        grading_basis="关键词重合度",
    )


def _extract_json_object(raw: str) -> dict:
    text = str(raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text.strip(), flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    match = re.search(r"\{.*\}", text, flags=re.S)
    if match:
        text = match.group(0)
    return json.loads(text)


def _fallback_short_answer(question: str, reference_answer: str, user_answer: str) -> dict:
    user = normalize_text(user_answer)
    reference = normalize_text(reference_answer)
    if len(user) < 4:
        return _grade_payload(
            score=0,
            feedback="回答过短，无法体现有效理解。",
            grading_method="short_answer_local",
            grading_basis="本地语义兜底",
        )

    if not reference or reference in {"开放性问题", "请基于所学知识回答"}:
        if len(user) >= 18:
            return _grade_payload(
                score=70,
                feedback="参考答案较开放，回答有明确内容，暂按基本达标处理。",
                grading_method="short_answer_local",
                grading_basis="开放题有效内容",
            )
        if len(user) >= 8:
            return _grade_payload(
                score=55,
                feedback="回答有一定内容，但展开不够。",
                grading_method="short_answer_local",
                grading_basis="开放题有效内容",
            )
        return _grade_payload(
            score=25,
            feedback="回答过于简单。",
            grading_method="short_answer_local",
            grading_basis="开放题有效内容",
        )

    if user == reference or reference in user:
        return _grade_payload(
            score=90,
            feedback="回答覆盖参考答案的核心含义。",
            grading_method="short_answer_local",
            grading_basis="语义包含关系",
        )

    reference_units = _meaningful_units(reference)
    user_units = _meaningful_units(user)
    overlap = len(reference_units & user_units) / max(len(reference_units), 1)
    if overlap >= 0.7:
        score = 80
        feedback = "回答覆盖多数关键含义，语义上可以接受。"
    elif overlap >= 0.45:
        score = 60
        feedback = "回答命中部分关键点，但不够完整。"
    elif overlap >= 0.25:
        score = 40
        feedback = "回答有少量相关内容，需要补充关键点。"
    else:
        score = 20
        feedback = "回答与参考要点差距较大。"
    return _grade_payload(
        score=score,
        feedback=feedback,
        grading_method="short_answer_local",
        grading_basis="关键语义单元重合度",
    )


async def grade_short_answer(
    *,
    question: str,
    reference_answer: str,
    user_answer: str,
    explanation: str = "",
    timeout: int = 20,
) -> dict:
    user_answer = str(user_answer or "").strip()
    reference_answer = str(reference_answer or "").strip()
    if len(normalize_text(user_answer)) < 4:
        return _grade_payload(
            score=0,
            feedback="回答过短，无法体现有效理解。",
            grading_method="short_answer_local",
            grading_basis="回答长度与有效内容",
        )

    prompt = f"""请批改一道简答题。注意：不要逐字匹配，不要因为措辞不同就判错；请按语义、关键得分点和是否能解决题目来评分。

评分规则：
- 90-100：核心含义完整，表达可与参考答案不同。
- 70-89：主要意思正确，允许少量遗漏。
- 40-69：部分正确，但关键点不完整。
- 0-39：偏题、错误或内容太少。

请只返回 JSON，不要输出 Markdown：
{{
  "score": 0,
  "matched_points": ["已经答到的要点"],
  "missing_points": ["还缺少的要点"],
  "feedback": "一句话说明为什么这样判"
}}

题目：{question}
参考答案：{reference_answer or "开放性问题，可依据题目和解析判断"}
参考解析：{explanation or "无"}
学生回答：{user_answer}
"""

    try:
        raw = await asyncio.wait_for(
            spark.chat(prompt, system_prompt="你是严格但不死板的教学批改老师，只返回 JSON。"),
            timeout=timeout,
        )
        data = _extract_json_object(raw)
        score = _clamp_score(data.get("score", 0))
        return _grade_payload(
            score=score,
            feedback=str(data.get("feedback") or ("语义达标。" if score >= PASS_SCORE else "回答还不够完整。")),
            matched_points=[str(x) for x in data.get("matched_points", []) if str(x).strip()],
            missing_points=[str(x) for x in data.get("missing_points", []) if str(x).strip()],
            grading_method="short_answer_semantic",
            grading_basis="语义与关键得分点",
        )
    except Exception as exc:
        fallback = _fallback_short_answer(question, reference_answer, user_answer)
        fallback["feedback"] = f"{fallback['feedback']}（AI语义批改暂不可用，已启用本地兜底判分）"
        fallback["grading_error"] = str(exc)
        return fallback
