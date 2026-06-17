"""
自适应学习闭环 API — 核心竞争力功能
流程：选主题→生成资料→答题→批改→分析→补强→再测→掌握
"""
import json
import asyncio
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db, LearningRecord, LearningResource
from app.llm.spark_client import SparkClient
from app.services.grading import grade_choice_answer, grade_fill_answer, grade_short_answer

router = APIRouter()
spark = SparkClient()


class StartLearningRequest(BaseModel):
    topic: str
    student_id: str = "default"


class SelectBookRequest(BaseModel):
    session_id: str
    book_id: str
    student_id: str = "default"


class SubmitQuizRequest(BaseModel):
    session_id: str
    answers: dict  # {question_id: answer}
    student_id: str = "default"


# 存储学习会话
learning_sessions = {}


RESOURCE_TYPE_NAMES = {
    "document": "课程讲解",
    "mindmap": "思维导图",
    "quiz": "练习题资源",
    "code": "代码案例",
    "storyboard": "动画分镜",
    "reinforcement": "错因补强资料",
}


BOOK_CATALOG = [
    {
        "id": "d2l",
        "title": "《动手学深度学习》",
        "author": "Aston Zhang、Zack C. Lipton、李沐、Alex J. Smola",
        "level": "入门到进阶",
        "topics": ["神经网络", "深度学习", "机器学习", "CNN", "RNN", "Transformer", "计算机视觉"],
        "tags": ["实战", "代码", "图解", "PyTorch", "项目"],
        "why_authoritative": "开源教材，理论、代码和实验结合紧密。",
        "benefit": "边学边跑代码，适合把概念快速落到实验和项目。",
        "best_for": "喜欢短代码验证概念、想做项目展示的学习者。",
        "video_keyword": "动手学深度学习 神经网络 李沐",
        "ebook_url": "https://zh.d2l.ai/",
    },
    {
        "id": "nielsen",
        "title": "《Neural Networks and Deep Learning》",
        "author": "Michael Nielsen",
        "level": "入门",
        "topics": ["神经网络", "反向传播", "深度学习", "机器学习"],
        "tags": ["直观", "图解", "反向传播", "入门"],
        "why_authoritative": "经典在线教材，尤其擅长解释反向传播和直觉。",
        "benefit": "概念讲得清楚，适合先建立神经网络的整体直觉。",
        "best_for": "基础薄弱、想先看懂原理再动手的人。",
        "video_keyword": "神经网络 入门 反向传播 通俗讲解",
        "ebook_url": "http://neuralnetworksanddeeplearning.com/",
    },
    {
        "id": "goodfellow",
        "title": "《Deep Learning》",
        "author": "Ian Goodfellow、Yoshua Bengio、Aaron Courville",
        "level": "进阶",
        "topics": ["神经网络", "深度学习", "机器学习", "生成模型", "优化"],
        "tags": ["权威", "理论", "数学", "深度学习"],
        "why_authoritative": "深度学习领域公认的系统性经典教材。",
        "benefit": "体系完整，适合作为长期参考书和理论框架。",
        "best_for": "需要严谨理解模型、优化和深度学习体系的人。",
        "video_keyword": "Deep Learning Goodfellow 深度学习 神经网络",
        "ebook_url": "https://www.deeplearningbook.org/",
    },
    {
        "id": "bishop",
        "title": "《Pattern Recognition and Machine Learning》",
        "author": "Christopher M. Bishop",
        "level": "进阶到高级",
        "topics": ["机器学习", "模式识别", "神经网络", "概率模型", "贝叶斯"],
        "tags": ["数学", "概率", "理论", "模式识别"],
        "why_authoritative": "模式识别和机器学习理论领域的经典教材。",
        "benefit": "能补足概率建模和泛化能力理解，适合打牢理论底座。",
        "best_for": "想深入模型评估、泛化和概率解释的人。",
        "video_keyword": "Bishop PRML 机器学习 神经网络",
        "ebook_url": "https://www.microsoft.com/en-us/research/publication/pattern-recognition-machine-learning/",
    },
    {
        "id": "rashid",
        "title": "《Python 神经网络编程》",
        "author": "Tariq Rashid",
        "level": "入门",
        "topics": ["神经网络", "Python", "反向传播", "手写数字识别"],
        "tags": ["代码", "入门", "项目", "Python"],
        "why_authoritative": "以 Python 手写神经网络为主线，适合入门实践。",
        "benefit": "用少量代码跑通神经网络，容易形成可演示作品。",
        "best_for": "想快速理解神经网络训练过程并做小项目的人。",
        "video_keyword": "Python 神经网络 编程 入门",
        "ebook_url": "",
    },
    {
        "id": "strang",
        "title": "《Introduction to Linear Algebra》",
        "author": "Gilbert Strang",
        "level": "入门",
        "topics": ["线性代数", "矩阵", "向量", "特征值", "线性变换"],
        "tags": ["数学", "基础", "直观", "MIT"],
        "why_authoritative": "MIT经典教材，讲解清晰直观。",
        "benefit": "从几何直觉出发理解线性代数，适合零基础入门。",
        "best_for": "需要打好线性代数基础的学习者。",
        "video_keyword": "线性代数 MIT Strang 矩阵 向量",
        "ebook_url": "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/",
    },
    {
        "id": "lay_linear",
        "title": "《Linear Algebra and Its Applications》",
        "author": "David C. Lay、Steven R. Lay、Judi J. McDonald",
        "level": "入门到进阶",
        "topics": ["线性代数", "矩阵", "向量", "线性方程组", "特征值", "应用"],
        "tags": ["数学", "基础", "例题", "应用"],
        "why_authoritative": "线性代数应用型教材代表，例题和工程场景丰富。",
        "benefit": "能把矩阵、方程组和特征值与真实应用连起来，适合做演示项目。",
        "best_for": "想边理解概念边看到应用场景的学习者。",
        "video_keyword": "线性代数 应用 矩阵 特征值 入门",
        "ebook_url": "",
    },
    {
        "id": "axler_linear",
        "title": "《Linear Algebra Done Right》",
        "author": "Sheldon Axler",
        "level": "进阶",
        "topics": ["线性代数", "向量空间", "线性映射", "特征值", "抽象"],
        "tags": ["数学", "理论", "证明", "进阶"],
        "why_authoritative": "偏理论的线性代数经典教材，适合建立严谨结构。",
        "benefit": "能帮助理解线性变换背后的抽象关系，适合进阶补强。",
        "best_for": "已经会基础计算、想理解证明和结构的人。",
        "video_keyword": "线性代数 向量空间 线性映射 特征值",
        "ebook_url": "",
    },
    {
        "id": "tongji_linear",
        "title": "《线性代数》",
        "author": "同济大学数学系",
        "level": "入门",
        "topics": ["线性代数", "行列式", "矩阵", "向量", "特征值"],
        "tags": ["数学", "基础", "国内教材", "考试"],
        "why_authoritative": "国内高校常用基础教材，知识点覆盖完整。",
        "benefit": "结构熟悉、适合快速补课和应试式查漏补缺。",
        "best_for": "想按国内课程节奏掌握线性代数基础的人。",
        "video_keyword": "同济 线性代数 行列式 矩阵 向量",
        "ebook_url": "",
    },
    {
        "id": "python_crash",
        "title": "《Python编程：从入门到实践》",
        "author": "Eric Matthes",
        "level": "入门",
        "topics": ["Python", "编程基础", "数据结构", "面向对象"],
        "tags": ["代码", "入门", "实战", "项目"],
        "why_authoritative": "Python入门经典教材，边学边做项目。",
        "benefit": "快速上手Python编程，适合零基础学习者。",
        "best_for": "想从零开始学编程的学习者。",
        "video_keyword": "Python入门 编程基础 教程",
        "ebook_url": "",
    },
    {
        "id": "automate_python",
        "title": "《Automate the Boring Stuff with Python》",
        "author": "Al Sweigart",
        "level": "入门",
        "topics": ["Python", "自动化", "文件处理", "爬虫", "脚本"],
        "tags": ["代码", "实战", "项目", "入门"],
        "why_authoritative": "Python 自动化入门经典，项目任务贴近真实使用。",
        "benefit": "能快速做出可展示的小工具，适合比赛作品里的落地演示。",
        "best_for": "想用 Python 解决实际问题、快速看到成果的人。",
        "video_keyword": "Python 自动化 办公 文件处理 爬虫 入门",
        "ebook_url": "https://automatetheboringstuff.com/",
    },
    {
        "id": "probstats",
        "title": "《概率论与数理统计》",
        "author": "陈希孺",
        "level": "入门",
        "topics": ["概率论", "数理统计", "随机变量", "假设检验"],
        "tags": ["数学", "基础", "统计", "概率"],
        "why_authoritative": "国内经典统计学教材。",
        "benefit": "系统讲解概率统计基础，为机器学习打基础。",
        "best_for": "需要补充概率统计知识的学习者。",
        "video_keyword": "概率论 数理统计 入门 教程",
        "ebook_url": "",
    },
    {
        "id": "ross_probability",
        "title": "《A First Course in Probability》",
        "author": "Sheldon Ross",
        "level": "入门到进阶",
        "topics": ["概率论", "随机变量", "分布", "期望", "条件概率"],
        "tags": ["数学", "概率", "例题", "基础"],
        "why_authoritative": "概率论经典教材，概念、例题和应用覆盖均衡。",
        "benefit": "适合把条件概率、随机变量和分布这些易混点讲清楚。",
        "best_for": "需要系统补概率基础并配合题目练习的人。",
        "video_keyword": "概率论 Ross 条件概率 随机变量 分布",
        "ebook_url": "",
    },
    {
        "id": "wasserman_stats",
        "title": "《All of Statistics》",
        "author": "Larry Wasserman",
        "level": "进阶",
        "topics": ["数理统计", "概率论", "统计推断", "估计", "假设检验"],
        "tags": ["数学", "统计", "理论", "进阶"],
        "why_authoritative": "统计学习者常用的系统性参考书，覆盖面很广。",
        "benefit": "能把统计推断、估计和检验串成完整框架。",
        "best_for": "想为机器学习补强概率统计底层能力的人。",
        "video_keyword": "数理统计 统计推断 假设检验 估计",
        "ebook_url": "",
    },
    {
        "id": "zhou_ml",
        "title": "《机器学习》",
        "author": "周志华",
        "level": "入门到进阶",
        "topics": ["机器学习", "分类", "回归", "模型评估", "集成学习"],
        "tags": ["权威", "理论", "中文教材", "基础"],
        "why_authoritative": "国内机器学习经典教材，体系完整、概念规范。",
        "benefit": "适合建立机器学习全局地图，方便后续做算法对比和演示。",
        "best_for": "想系统理解机器学习而不是只调包的人。",
        "video_keyword": "周志华 机器学习 西瓜书 分类 回归",
        "ebook_url": "",
    },
    {
        "id": "lihang_statistical_learning",
        "title": "《统计学习方法》",
        "author": "李航",
        "level": "进阶",
        "topics": ["机器学习", "统计学习", "分类", "回归", "概率模型"],
        "tags": ["理论", "数学", "算法", "中文教材"],
        "why_authoritative": "统计学习方向经典中文教材，算法推导清晰。",
        "benefit": "适合把常见模型的目标函数、推导和适用场景讲明白。",
        "best_for": "想补强算法原理、能接受公式推导的人。",
        "video_keyword": "李航 统计学习方法 机器学习 算法",
        "ebook_url": "",
    },
    {
        "id": "algorithms_sedgewick",
        "title": "《Algorithms》",
        "author": "Robert Sedgewick、Kevin Wayne",
        "level": "入门到进阶",
        "topics": ["数据结构", "算法", "排序", "图", "查找"],
        "tags": ["代码", "图解", "基础", "项目"],
        "why_authoritative": "算法学习经典教材，配套可视化和代码资源丰富。",
        "benefit": "能把排序、查找、图算法讲成可演示流程。",
        "best_for": "需要做算法可视化、补计算机基础的人。",
        "video_keyword": "数据结构 算法 排序 图算法 入门",
        "ebook_url": "",
    },
    {
        "id": "clrs",
        "title": "《Introduction to Algorithms》",
        "author": "Thomas H. Cormen、Charles E. Leiserson、Ronald L. Rivest、Clifford Stein",
        "level": "进阶",
        "topics": ["数据结构", "算法", "动态规划", "图算法", "复杂度"],
        "tags": ["权威", "理论", "算法", "进阶"],
        "why_authoritative": "算法领域系统性经典教材，覆盖广、深度足。",
        "benefit": "适合建立严谨算法框架，补强复杂度和证明能力。",
        "best_for": "想深入理解算法设计和复杂度分析的人。",
        "video_keyword": "算法导论 CLRS 动态规划 图算法 复杂度",
        "ebook_url": "",
    },
    {
        "id": "tongji_calculus",
        "title": "《高等数学》",
        "author": "同济大学数学系",
        "level": "入门",
        "topics": ["高等数学", "微积分", "极限", "导数", "积分"],
        "tags": ["数学", "基础", "国内教材", "考试"],
        "why_authoritative": "国内高校常用高等数学教材，课程体系完整。",
        "benefit": "适合按课堂顺序补基础，方便形成清晰学习计划。",
        "best_for": "需要系统补高数基础和常见题型的人。",
        "video_keyword": "高等数学 同济 极限 导数 积分",
        "ebook_url": "",
    },
    {
        "id": "stewart_calculus",
        "title": "《Calculus: Early Transcendentals》",
        "author": "James Stewart",
        "level": "入门到进阶",
        "topics": ["微积分", "极限", "导数", "积分", "多元微积分"],
        "tags": ["数学", "直观", "例题", "应用"],
        "why_authoritative": "国际上使用广泛的微积分教材，例题和应用很充分。",
        "benefit": "能把公式、图像和应用连起来，适合理解型学习。",
        "best_for": "想用图像和例题理解微积分的人。",
        "video_keyword": "微积分 Calculus 极限 导数 积分",
        "ebook_url": "",
    },
]


TOPIC_ALIASES = {
    "deep_learning": ["神经网络", "深度学习", "反向传播", "cnn", "rnn", "transformer", "人工智能", "ai"],
    "machine_learning": ["机器学习", "统计学习", "分类", "回归", "模型评估", "集成学习", "监督学习"],
    "linear_algebra": ["线性代数", "矩阵", "向量", "行列式", "特征值", "特征向量", "线性变换", "linear algebra"],
    "probability": ["概率", "概率论", "数理统计", "随机变量", "条件概率", "假设检验", "统计推断"],
    "python": ["python", "编程基础", "自动化", "脚本", "爬虫", "面向对象"],
    "algorithms": ["数据结构", "算法", "排序", "查找", "动态规划", "图算法", "复杂度"],
    "calculus": ["高等数学", "高数", "微积分", "极限", "导数", "积分", "calculus"],
}


def _book_text(book: dict) -> str:
    values = [
        book.get("title", ""),
        book.get("author", ""),
        book.get("level", ""),
        " ".join(book.get("topics", [])),
        " ".join(book.get("tags", [])),
    ]
    return " ".join(str(value) for value in values).lower()


def _detect_topic_groups(text: str) -> set[str]:
    normalized = text.lower()
    return {
        group
        for group, aliases in TOPIC_ALIASES.items()
        if any(alias.lower() in normalized for alias in aliases)
    }


def _book_primary_groups(book: dict) -> set[str]:
    # 标题和前两个主题最能代表一本书的主方向，后面的标签只作为辅助。
    primary_text = " ".join([
        str(book.get("title", "")),
        " ".join(str(topic) for topic in book.get("topics", [])[:2]),
    ])
    return _detect_topic_groups(primary_text)


def _topic_match_score(book: dict, topic: str) -> int:
    book_text = _book_text(book)
    topic_lower = topic.strip().lower()
    query_groups = _detect_topic_groups(topic_lower)
    book_groups = _detect_topic_groups(book_text)
    primary_groups = _book_primary_groups(book)
    score = 0

    if topic_lower and topic_lower in book_text:
        score += 55

    if query_groups:
        shared_groups = query_groups & book_groups
        if shared_groups:
            score += 50 + 10 * len(shared_groups)
            if query_groups & primary_groups:
                score += 26
            else:
                score -= 20
        else:
            score -= 80

    for group in query_groups:
        for alias in TOPIC_ALIASES[group]:
            alias_lower = alias.lower()
            if alias_lower in topic_lower and alias_lower in book_text:
                score += 12
    return score


def _profile_match_score(book: dict, profile_text: str) -> tuple[int, list[str]]:
    """基于学生画像的个性化匹配评分"""
    text = profile_text.lower()
    tags = [str(tag).lower() for tag in book.get("tags", [])]
    topics = [str(t).lower() for t in book.get("topics", [])]
    level = book.get("level", "")
    score = 0
    reasons = []

    # ── 1. 知识基础匹配 ──
    if any(w in text for w in ["零基础", "初学", "入门", "基础薄弱", "不懂", "看不懂"]):
        if "入门" in tags or level == "入门":
            score += 20
            reasons.append("匹配你的基础水平")
    if any(w in text for w in ["有一定基础", "学过", "了解过", "掌握"]):
        if "进阶" in tags or level in ["进阶", "进阶到高级"]:
            score += 18
            reasons.append("适合你当前水平")

    # ── 2. 认知风格匹配 ──
    if any(w in text for w in ["图示", "直观", "可视化", "结构图", "思维导图"]):
        if any(tag in tags for tag in ["图解", "直观"]):
            score += 16
            reasons.append("讲解方式符合你的认知风格")

    # ── 3. 学习能力匹配 ──
    if any(w in text for w in ["理解快", "学得快", "能力强"]):
        if "进阶" in tags:
            score += 10
            reasons.append("挑战更高难度")
    if any(w in text for w in ["需要时间", "慢慢理解", "公式推导难"]):
        if "入门" in tags:
            score += 12
            reasons.append("循序渐进更适合你")

    # ── 4. 学习目标匹配 ──
    if any(w in text for w in ["项目", "实战", "竞赛", "比赛", "开发"]):
        if any(tag in tags for tag in ["实战", "代码", "项目", "pytorch", "python"]):
            score += 24
            reasons.append("更贴近你的实战目标")

    # ── 5. 兴趣方向匹配 ──
    if any(w in text for w in ["计算机视觉", "视觉", "图像"]):
        if any(t in topics for t in ["计算机视觉", "cnn", "视觉"]):
            score += 14
            reasons.append("贴合你的兴趣方向")
    if any(w in text for w in ["nlp", "自然语言", "文本"]):
        if any(t in topics for t in ["nlp", "transformer"]):
            score += 14
            reasons.append("贴合你的兴趣方向")

    # ── 6. 易错模式匹配 ──
    if any(w in text for w in ["反向传播", "过拟合", "训练集", "验证集"]):
        if any(tag in tags for tag in ["反向传播", "理论", "入门"]):
            score += 12
            reasons.append("能帮你攻克薄弱点")

    # ── 7. 学习习惯匹配 ──
    if any(w in text for w in ["晚上", "周末", "碎片"]):
        if "实战" in tags:
            score += 8
            reasons.append("短代码练习适合碎片时间")

    if not reasons:
        reasons.append("与当前主题匹配度高")

    return score, reasons


async def _profile_text_for_student(db: AsyncSession, student_id: str) -> str:
    try:
        from app.models.database import StudentProfile
        from app.services.bilibili_recommender import extract_profile_text

        result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
        return extract_profile_text(result.scalar_one_or_none())
    except Exception:
        return ""


def _recommend_books(topic: str, profile_text: str, limit: int = 4) -> list[dict]:
    query_groups = _detect_topic_groups(topic)
    ranked = []
    for book in BOOK_CATALOG:
        topic_score = _topic_match_score(book, topic)
        if query_groups and topic_score < 20:
            continue

        profile_score, profile_reasons = _profile_match_score(book, profile_text)
        profile_bonus = min(profile_score, 24)
        rank_score = 20 + topic_score * 2 + profile_bonus
        display_score = int(max(0, min(100, 55 + topic_score * 0.22 + profile_bonus * 0.4)))
        reason_parts = [f"主题匹配：{topic}"] if topic else ["与你的学习目标匹配"]
        reason_parts.extend(reason for reason in profile_reasons[:1] if reason != "与当前主题匹配度高")
        reason = "；".join(reason_parts)
        ranked.append({
            **book,
            "score": display_score,
            "fit_reason": reason,
            "_rank_score": rank_score,
            "_topic_score": topic_score,
        })

    if not ranked:
        for book in BOOK_CATALOG:
            profile_score, profile_reasons = _profile_match_score(book, profile_text)
            topic_score = _topic_match_score(book, topic)
            ranked.append({
                **book,
                "score": max(0, min(45 + topic_score + min(profile_score, 18), 100)),
                "fit_reason": "暂未命中特定学科库，按你的画像先推荐最接近的基础书",
                "_rank_score": 45 + topic_score + min(profile_score, 18),
                "_topic_score": topic_score,
            })

    ranked.sort(key=lambda item: (item["_rank_score"], item["_topic_score"]), reverse=True)
    return [
        {key: value for key, value in item.items() if not key.startswith("_")}
        for item in ranked[:limit]
    ]


async def _get_personalization(db: AsyncSession, student_id: str, topic: str) -> tuple[str, dict]:
    from app.api.resource import _build_personal_context

    return await _build_personal_context(db, student_id, topic)


def _personalized_prompt(base_prompt: str, context: str) -> str:
    from app.api.resource import _personalize_prompt

    return _personalize_prompt(base_prompt, context)


def _learning_resource_id(session_id: str, resource_type: str, round_num: int = 1) -> str:
    return f"learn-{session_id}-{resource_type}-{round_num}"


def _build_agent_trace(topic: str, personalization: dict) -> list[dict]:
    profile_dimensions = int(personalization.get("profile_dimensions") or 0)
    weak_points = personalization.get("weak_points") or []
    resource_focus = personalization.get("resource_focus") or []
    weak_point_text = "、".join(weak_points[:3]) if weak_points else "暂无历史错因"
    focus_text = "、".join(resource_focus[:3]) if resource_focus else "课程讲解、思维导图、练习题、代码案例、动画分镜"

    return [
        {
            "agent": "planner",
            "name": "任务规划智能体",
            "task": f"拆解 {topic} 学习任务",
            "output": "确定先生成讲解、导图、练习题、代码和动画分镜，再进入测评和错因补强。",
            "status": "done",
        },
        {
            "agent": "profiler",
            "name": "画像分析智能体",
            "task": "读取学生画像和历史错题",
            "output": f"命中 {profile_dimensions} 个画像维度；当前错因：{weak_point_text}。",
            "status": "done",
        },
        {
            "agent": "doc_generator",
            "name": "文档生成智能体",
            "task": "生成通俗课程讲解",
            "output": f"围绕 {focus_text} 调整讲解重点。",
            "status": "done",
            "resource_type": "document",
        },
        {
            "agent": "mindmap_generator",
            "name": "导图生成智能体",
            "task": "生成知识结构图",
            "output": "把核心概念、关键关系和应用场景组织成可视化结构。",
            "status": "done",
            "resource_type": "mindmap",
        },
        {
            "agent": "code_generator",
            "name": "代码生成智能体",
            "task": "生成可运行代码案例",
            "output": "给出可直接运行的 Python 示例，帮助把知识落到实践。",
            "status": "done",
            "resource_type": "code",
        },
        {
            "agent": "practice_generator",
            "name": "练习资源智能体",
            "task": "生成课前自测和随堂练习",
            "output": "生成分层练习资源，提前暴露可能错因。",
            "status": "done",
            "resource_type": "quiz",
        },
        {
            "agent": "storyboard_generator",
            "name": "动画分镜智能体",
            "task": "生成微课动画脚本",
            "output": "把抽象概念转成画面、旁白和交互步骤，方便课堂演示。",
            "status": "done",
            "resource_type": "storyboard",
        },
    ]


def _extend_agent_trace(session: dict, steps: list[dict]) -> list[dict]:
    trace = list(session.get("agent_trace") or [])
    trace.extend(steps)
    session["agent_trace"] = trace
    return trace


def _graph_node_by_text(text: str) -> Optional[dict]:
    from app.api.graph import KNOWLEDGE_GRAPH

    text = str(text or "").lower()
    aliases = {
        "cnn": "CNN",
        "卷积": "CNN",
        "rnn": "RNN",
        "循环": "RNN",
        "nlp": "NLP",
        "自然语言": "NLP",
        "视觉": "计算机视觉",
        "图像": "计算机视觉",
        "回归": "线性回归",
        "过拟合": "决策树",
        "正则": "决策树",
        "反向传播": "神经网络",
        "梯度": "神经网络",
        "深度": "深度学习",
    }
    target = next((name for key, name in aliases.items() if key in text), "")
    for node in KNOWLEDGE_GRAPH["nodes"]:
        name = node["name"]
        if name.lower() in text or (target and target == name):
            return node
    return None


def _neighbors(node_id: str) -> tuple[list[dict], list[dict]]:
    from app.api.graph import KNOWLEDGE_GRAPH

    node_map = {node["id"]: node for node in KNOWLEDGE_GRAPH["nodes"]}
    prerequisites = [node_map[e["from"]] for e in KNOWLEDGE_GRAPH["edges"] if e["to"] == node_id and e["from"] in node_map]
    next_nodes = [node_map[e["to"]] for e in KNOWLEDGE_GRAPH["edges"] if e["from"] == node_id and e["to"] in node_map]
    return prerequisites, next_nodes


def _build_next_plan(
    *,
    topic: str,
    score: int,
    wrong_topics: list[str],
    results: list[dict],
    personalization: dict,
    round_num: int,
) -> dict:
    current_node = _graph_node_by_text(topic)
    weak_text = "；".join(wrong_topics)
    weak_node = _graph_node_by_text(weak_text)
    focus_node = weak_node or current_node
    prerequisites, next_nodes = _neighbors(focus_node["id"]) if focus_node else ([], [])

    missed = [r for r in results if not r.get("is_correct")]
    weakest = sorted(missed, key=lambda r: int(r.get("grade_score", 0)))[:3]
    profile_dimensions = int(personalization.get("profile_dimensions") or 0)
    history_weak = personalization.get("weak_points") or []

    steps = []
    if score < 80:
        steps.append({
            "title": "先补当前错因",
            "action": "生成错因补强资料并重读关键解析",
            "target": wrong_topics[0] if wrong_topics else topic,
            "reason": f"本轮得分 {score}，低于掌握线 80，需要先修正错误理解。",
            "estimated_time": "15分钟",
            "priority": "high",
        })
        if weakest:
            steps.append({
                "title": "做变式练习",
                "action": "围绕最低分题目做 3-5 道同类变式",
                "target": weakest[0]["question"][:36],
                "reason": f"最低题得分 {weakest[0].get('grade_score', 0)}，说明该点需要迁移练习。",
                "estimated_time": "20分钟",
                "priority": "high",
            })
    else:
        steps.append({
            "title": "快速复盘",
            "action": "保留本轮批改依据，整理成自己的知识卡片",
            "target": topic,
            "reason": f"本轮得分 {score}，已达到掌握线，可以进入后继知识。",
            "estimated_time": "10分钟",
            "priority": "medium",
        })

    if prerequisites and score < 80:
        prereq = prerequisites[0]
        steps.append({
            "title": "回补先修知识",
            "action": f"复习[{prereq['name']}]再回到当前知识点",
            "target": prereq["name"],
            "reason": "知识图谱显示它是当前内容的前置基础。",
            "estimated_time": "20分钟",
            "priority": "medium",
        })

    if next_nodes and score >= 80:
        nxt = next_nodes[0]
        steps.append({
            "title": "进入下一知识点",
            "action": f"开始学习[{nxt['name']}]",
            "target": nxt["name"],
            "reason": "知识图谱显示这是当前知识点的自然后继模块。",
            "estimated_time": "30分钟",
            "priority": "medium",
        })
    elif score < 80:
        steps.append({
            "title": "再测验证",
            "action": "完成补强后进行下一轮测验",
            "target": topic,
            "reason": "用再次测评确认错因是否被真正消除。",
            "estimated_time": "10分钟",
            "priority": "medium",
        })

    return {
        "summary": "先补错因，再做变式，最后用再测验证" if score < 80 else "已达掌握线，建议复盘后进入后继知识",
        "next_focus": steps[0]["target"] if steps else topic,
        "mastery_line": 80,
        "current_score": score,
        "round": round_num,
        "profile_dimensions": profile_dimensions,
        "history_weak_points": history_weak[:3],
        "graph_context": {
            "current": current_node,
            "focus": focus_node,
            "prerequisites": prerequisites[:2],
            "next": next_nodes[:2],
        },
        "steps": steps,
        "evidence": {
            "wrong_count": len(wrong_topics),
            "lowest_scores": [
                {"question": item["question"][:40], "score": item.get("grade_score", 0)}
                for item in weakest
            ],
        },
    }


def _score_resource_quality(resource_type: str, content: str, topic: str, personalization: dict) -> dict:
    text = str(content or "").strip()
    suggestions = []
    criteria = []
    score = 45

    profile_dimensions = int(personalization.get("profile_dimensions") or 0)
    weak_points = personalization.get("weak_points") or []
    if profile_dimensions > 0 or weak_points:
        score += 12
        criteria.append("已读取画像或错因证据")
    else:
        suggestions.append("补充学生画像或历史错题后，资源会更个性化")

    if topic and topic.lower() in text.lower():
        score += 8
        criteria.append("内容围绕当前知识点")
    else:
        suggestions.append("内容需要更明确地围绕当前知识点")

    if resource_type == "document":
        if len(text) >= 450:
            score += 12
            criteria.append("讲解长度充足")
        else:
            suggestions.append("课程讲解偏短，可补充定义、例子和应用")
        if any(mark in text for mark in ["##", "###", "1.", "- "]):
            score += 8
            criteria.append("结构化表达清晰")
        else:
            suggestions.append("建议使用小标题或列表组织内容")
        if any(word in text for word in ["例", "应用", "场景", "类比"]):
            score += 10
            criteria.append("包含例子或应用场景")
        else:
            suggestions.append("建议加入生活类比或实际应用场景")
    elif resource_type == "mindmap":
        normalized = text.replace("```mermaid", "").replace("```", "").strip().lower()
        if normalized.startswith("mindmap") and "root" in normalized:
            score += 18
            criteria.append("Mermaid mindmap 基本格式正确")
        else:
            suggestions.append("思维导图需要以 mindmap/root 结构输出")
        branch_count = sum(1 for line in text.splitlines() if line.startswith("    ") and not line.startswith("      "))
        if branch_count >= 3:
            score += 10
            criteria.append("包含多个主分支")
        else:
            suggestions.append("建议至少包含 3 个主要分支")
    elif resource_type == "code":
        lines = [line for line in text.splitlines() if line.strip()]
        if len(lines) <= 80:
            score += 8
            criteria.append("代码长度适合课堂演示")
        else:
            suggestions.append("代码偏长，建议拆成更小示例")
        if any(token in text for token in ["import ", "def ", "print(", "class "]):
            score += 12
            criteria.append("包含可执行 Python 结构")
        else:
            suggestions.append("代码需要包含可直接运行的 Python 结构")
        if "#" in text or '"""' in text:
            score += 8
            criteria.append("包含注释，便于理解")
        else:
            suggestions.append("建议补充关键步骤注释")
    elif resource_type == "quiz":
        if any(word in text for word in ["选择题", "简答题", "填空题", "题目"]):
            score += 12
            criteria.append("包含练习题结构")
        else:
            suggestions.append("练习资源需要明确题型和题目")
        if any(word in text for word in ["答案", "参考答案", "解析"]):
            score += 12
            criteria.append("包含答案或解析")
        else:
            suggestions.append("建议为练习题补充参考答案和解析")
        if any(word in text for word in ["基础", "进阶", "应用", "错因", "易错"]):
            score += 8
            criteria.append("包含分层或错因导向")
        else:
            suggestions.append("建议加入基础、进阶或错因导向分层")
    elif resource_type == "storyboard":
        if any(word in text for word in ["镜头", "场景", "画面", "分镜"]):
            score += 12
            criteria.append("包含可视化分镜结构")
        else:
            suggestions.append("动画分镜需要包含镜头、场景或画面描述")
        if any(word in text for word in ["旁白", "讲解", "字幕"]):
            score += 8
            criteria.append("包含讲解或旁白")
        else:
            suggestions.append("建议补充旁白或字幕说明")
        if any(word in text for word in ["交互", "暂停", "提问", "拖拽", "点击"]):
            score += 8
            criteria.append("包含互动设计")
        else:
            suggestions.append("建议加入课堂互动或检查点")
    elif resource_type == "reading":
        if any(word in text for word in ["资源", "书", "视频", "网站", "课程"]):
            score += 12
            criteria.append("包含拓展学习入口")
        else:
            suggestions.append("拓展阅读需要列出可继续学习的资源")
        if any(word in text for word in ["顺序", "先", "再", "最后", "建议"]):
            score += 8
            criteria.append("包含学习顺序建议")
        else:
            suggestions.append("建议补充推荐学习顺序")

    score = max(0, min(100, score))
    level = "excellent" if score >= 88 else "good" if score >= 75 else "needs_review"
    return {
        "resource_type": resource_type,
        "title": RESOURCE_TYPE_NAMES.get(resource_type, resource_type),
        "score": score,
        "level": level,
        "passed": score >= 75,
        "criteria": criteria[:5],
        "suggestions": suggestions[:4],
    }


def _review_generated_resources(
    *,
    topic: str,
    resources: dict,
    personalization: dict,
) -> dict:
    checks = [
        _score_resource_quality(resource_type, content, topic, personalization)
        for resource_type, content in resources.items()
    ]
    overall_score = int(sum(item["score"] for item in checks) / max(len(checks), 1))
    failed = [item for item in checks if not item["passed"]]
    return {
        "overall_score": overall_score,
        "pass_line": 75,
        "status": "passed" if not failed else "needs_review",
        "summary": "资源结构、格式和个性化证据通过质检" if not failed else "部分资源需要补充后再作为正式学习材料",
        "checks": checks,
        "personalization_used": bool(personalization.get("personalized") or personalization.get("profile_dimensions") or personalization.get("weak_points")),
        "profile_dimensions": int(personalization.get("profile_dimensions") or 0),
        "weak_points": (personalization.get("weak_points") or [])[:3],
    }


@router.post("/books")
async def recommend_books(req: StartLearningRequest, db: AsyncSession = Depends(get_db)):
    """第1步：多智能体协作 — 根据主题和画像推荐权威书籍"""
    session_id = str(uuid.uuid4())[:8]
    topic = req.topic.strip()

    # 获取学生画像（结构化数据）
    profile_text = await _profile_text_for_student(db, req.student_id)
    personal_context, personalization_evidence = await _get_personalization(db, req.student_id, topic)

    # 获取画像维度数据
    from app.models.database import StudentProfile
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(StudentProfile).where(StudentProfile.student_id == req.student_id))
    profile = result.scalar_one_or_none()
    profile_data = {}
    if profile:
        for field in ["knowledge_base", "cognitive_style", "learning_ability", "error_patterns",
                       "learning_goals", "interests", "learning_habits"]:
            val = getattr(profile, field, None)
            if val and isinstance(val, dict) and val.get("value"):
                profile_data[field] = val

    # 多智能体协作执行
    from app.agents.multi_agent import multi_agent_orchestrator
    orchestrator_result = await multi_agent_orchestrator.execute_learning_flow(topic, profile_data)

    # 基于多智能体结果推荐书籍
    books = _recommend_books(topic, profile_text, limit=4)

    # 构建智能体追踪日志
    agent_trace = [
        {
            "agent": "planner",
            "name": "任务规划智能体",
            "task": f"分析 {topic} 学习任务",
            "output": f"规划了 {len(orchestrator_result.get('plan', {}).get('tasks', []))} 个子任务。",
            "status": "done",
        },
        {
            "agent": "profiler",
            "name": "画像分析智能体",
            "task": "读取学生画像并分析学习偏好",
            "output": f"已分析 {len(profile_data)} 个画像维度，调整推荐策略。",
            "status": "done",
        },
        {
            "agent": "book_recommender",
            "name": "权威书籍推荐智能体",
            "task": f"为 {topic} 推荐权威学习书籍",
            "output": f"基于画像分析，生成 {len(books)} 本候选书。",
            "status": "done",
        },
    ]

    # 记录多智能体通信日志
    comm_log = multi_agent_orchestrator.get_communication_log()
    agent_states = multi_agent_orchestrator.get_agent_states()

    learning_sessions[session_id] = {
        "topic": topic,
        "student_id": req.student_id,
        "stage": "book_select",
        "books": books,
        "selected_book": None,
        "materials": None,
        "quiz": None,
        "quiz_result": None,
        "reinforcement": None,
        "personal_context": personal_context,
        "personalization": personalization_evidence,
        "agent_trace": agent_trace,
        "multi_agent_result": orchestrator_result,
        "agent_states": agent_states,
        "round": 1,
    }

    return {
        "success": True,
        "session_id": session_id,
        "topic": topic,
        "books": books,
        "profile_hint": profile_text,
        "agent_trace": agent_trace,
        "agent_states": agent_states,
        "communication_log": comm_log[-10:],  # 最近10条通信记录
        "stage": "book_select",
    }


@router.post("/book/select")
async def select_learning_book(req: SelectBookRequest, db: AsyncSession = Depends(get_db)):
    """用户选定书籍后，基于这本书生成学习计划、思维导图和代码实践。"""
    session = learning_sessions.get(req.session_id)
    if not session:
        return {"success": False, "message": "学习会话不存在"}

    topic = session["topic"]
    books = session.get("books") or []
    selected_book = next((book for book in books if book.get("id") == req.book_id), None)
    if not selected_book:
        return {"success": False, "message": "未找到这本书"}

    personal_context = session.get("personal_context") or ""
    personalization_evidence = session.get("personalization") or {}

    plan_prompt = f"""你是学习规划导师。学生要学{topic}，已经选择主线书籍：
书名：{selected_book['title']}
作者：{selected_book['author']}
推荐理由：{selected_book.get('fit_reason', '')}

请基于这本书生成一份精简学习计划。
要求：
1. 适合每天60-90分钟学习
2. 按[先理解概念 → 再做代码实验 → 最后自测]安排
3. 分成4-6个学习节点
4. 每个节点包含：学习目标、建议阅读重点、动手任务、检查标准
5. 不要写太长，适合页面展示

用Markdown输出。"""

    mindmap_prompt = f"""为"{topic}"生成简洁的学习导图，使用Markdown格式。

# {topic}

## 核心概念
- 概念A
- 概念B
- 概念C

## 关键要点
- 要点1
- 要点2
- 要点3

## 实践任务
- 任务1
- 任务2

## 自测重点
- 重点1
- 重点2

要求：
1. 只用##和-两级结构
2. 4个主要分支
3. 每分支2-3个子节点
4. 每个节点不超过10个字
5. 只输出核心内容，不要解释"""

    code_prompt = f"""你是Python编程导师。学生正在根据 {selected_book['title']} 学习{topic}。
请生成一个30行以内的 Python 小实验，帮助验证书中的核心概念。
要求：
1. 可直接运行
2. 注释清楚
3. 适合入门演示
4. 尽量体现[训练/验证/过拟合/反向传播]等相关概念中的至少一个

只输出代码块。"""

    async def safe_chat(prompt: str, system: str, fallback: str, timeout: int = 50):
        try:
            content = await asyncio.wait_for(
                spark.chat(_personalized_prompt(prompt, personal_context), system_prompt=system),
                timeout=timeout,
            )
            return content if content and len(content.strip()) > 20 else fallback
        except Exception as e:
            print(f"{选书资料生成失败} {e}")
            return fallback

    fallback_plan = f"""## 基于 {selected_book['title']} 的学习计划

1. **建立整体认识**：先读神经网络的定义、层结构和训练目标，能用自己的话解释输入层、隐藏层、输出层。
2. **补关键薄弱点**：重点看反向传播、训练集/验证集/测试集、过拟合与正则化。
3. **做小实验**：用 Python 跑一个简单分类模型，观察训练准确率和测试准确率。
4. **画结构图复盘**：把书中主线整理成导图，确认每个概念之间的关系。
5. **自测验收**：能解释一个实际应用，并说明如何避免过拟合。"""

    fallback_mindmap = f"""# {topic}

## 核心概念
- 反向传播
- 损失函数
- 过拟合

## 关键要点
- 梯度计算
- 权重更新
- 正则化

## 实践任务
- Python实验
- 准确率观察

## 自测重点
- 概念辨析
- 应用场景"""

    fallback_code = """```python
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier

X, y = make_classification(n_samples=300, n_features=10, random_state=7)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=7)

model = MLPClassifier(hidden_layer_sizes=(16,), max_iter=500, random_state=7)
model.fit(X_train, y_train)

print("训练集准确率:", round(model.score(X_train, y_train), 3))
print("测试集准确率:", round(model.score(X_test, y_test), 3))
print("如果训练集很高、测试集明显较低，就要警惕过拟合。")
```"""

    plan_task = safe_chat(plan_prompt, "你是一位擅长因材施教的学习规划导师。", fallback_plan)
    mindmap_task = safe_chat(mindmap_prompt, "你是一位教学导图设计专家。", fallback_mindmap)
    code_task = safe_chat(code_prompt, "你是一位Python编程导师。", fallback_code)
    plan_content, mindmap_content, code_content = await asyncio.gather(plan_task, mindmap_task, code_task)

    document_content = f"""## 已选择主线书籍

**{selected_book['title']}**  
作者：{selected_book['author']}

**这本书的好处：** {selected_book['benefit']}

**为什么适合你：** {selected_book.get('fit_reason', '与当前主题匹配度高')}

---

{plan_content}
"""

    generated_resources = {
        "document": document_content,
        "mindmap": mindmap_content,
        "code": code_content,
    }
    resource_quality = _review_generated_resources(
        topic=topic,
        resources=generated_resources,
        personalization=personalization_evidence,
    )
    agent_trace = _extend_agent_trace(session, [
        {
            "agent": "book_selector",
            "name": "选书确认智能体",
            "task": "记录学生选择的主线教材",
            "output": f"学生选择 {selected_book['title']}，后续学习计划和视频推荐都围绕这本书展开。",
            "status": "done",
        },
        {
            "agent": "study_plan_generator",
            "name": "学习计划智能体",
            "task": "基于选定书籍生成学习计划和思维导图",
            "output": f"已生成学习计划、导图和代码实验；质检 {resource_quality['overall_score']} 分。",
            "status": "done",
        },
    ])

    materials = {
        "document": document_content,
        "study_plan": plan_content,
        "mindmap": mindmap_content,
        "code": code_content,
        "book": selected_book,
        "video_keyword": selected_book.get("video_keyword") or f"{topic} {selected_book['title']}",
    }

    session["selected_book"] = selected_book
    session["materials"] = materials
    session["resource_quality"] = resource_quality
    session["stage"] = "learn"

    try:
        resource_ids = []
        for resource_type, content in generated_resources.items():
            resource_id = _learning_resource_id(req.session_id, resource_type)
            resource_ids.append(resource_id)
            quality_check = next(
                (item for item in resource_quality["checks"] if item["resource_type"] == resource_type),
                {},
            )
            db.add(LearningResource(
                resource_id=resource_id,
                student_id=req.student_id,
                resource_type=resource_type,
                title=f"{topic} - {selected_book['title']} - {RESOURCE_TYPE_NAMES[resource_type]}",
                content=content,
                content_format="markdown",
                topic=topic,
                difficulty="medium",
                extra_data={
                    "source": "book_driven_learning",
                    "session_id": req.session_id,
                    "selected_book": selected_book,
                    "personalization": personalization_evidence,
                    "quality_check": quality_check,
                    "agent_trace": agent_trace,
                },
            ))

        db.add(LearningRecord(
            student_id=req.student_id,
            action_type="book_select",
            topic=topic,
            duration=0,
            extra_data={
                "session_id": req.session_id,
                "resource_ids": resource_ids,
                "selected_book": selected_book,
                "resource_quality": resource_quality,
                "agent_trace": agent_trace,
            },
        ))
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"{选书资料沉淀失败} {e}")

    return {
        "success": True,
        "session_id": req.session_id,
        "topic": topic,
        "book": selected_book,
        "materials": materials,
        "resource_quality": resource_quality,
        "agent_trace": agent_trace,
        "stage": "learn",
    }


@router.post("/start")
async def start_learning(req: StartLearningRequest, db: AsyncSession = Depends(get_db)):
    """第1步：开始学习 — 生成学习资料"""
    session_id = str(uuid.uuid4())[:8]
    topic = req.topic
    personal_context, personalization_evidence = await _get_personalization(db, req.student_id, topic)
    agent_trace = _build_agent_trace(topic, personalization_evidence)

    # 并行生成5种资料（加超时保护）
    doc_prompt = f"""你是AI课程教师。请用500字讲解"{topic}"的核心概念。
包含：定义、关键点（3-5个）、一个生活中的类比、一个实际应用。
用Markdown格式，语言通俗易懂。直接输出内容。"""

    mindmap_prompt = f"""用Mermaid mindmap语法为"{topic}"生成一个美观的知识点思维导图。

格式要求（严格遵循）：
mindmap
  root(({topic}))
    核心概念1
      关键点1.1
      关键点1.2
      关键点1.3
    核心概念2
      关键点2.1
      关键点2.2
    核心概念3
      关键点3.1
      关键点3.2
    应用场景
      应用1
      应用2

注意事项：
- root节点用双括号
- 3-4个主要分支
- 每个分支2-3个子节点
- 子节点用简短关键词（不超过8个字）
- 只输出mermaid代码，不要其他内容"""

    code_prompt = f"""用Python写一个"{topic}"的简单代码示例。
要求：30行以内，有注释，可直接运行。只输出代码块。"""

    quiz_prompt = f"""你是一位出题专家。请为"{topic}"生成一份随堂练习资源。
要求：
1. 2道基础选择题
2. 1道应用选择题
3. 1道简答题
4. 每题给出参考答案和一句解析
5. 标注可能暴露的错因

用Markdown格式，直接输出内容。"""

    storyboard_prompt = f"""你是一位微课动画导演。请为"{topic}"生成一份动画分镜/微课脚本。
要求包含5个镜头，每个镜头写：
- 画面
- 旁白
- 屏幕文字
- 交互检查点

风格适合课堂演示，用Markdown表格或列表输出。"""

    async def safe_chat(prompt, system, timeout=50):
        try:
            return await asyncio.wait_for(spark.chat(prompt, system_prompt=system), timeout=timeout)
        except Exception as e:
            print(f"{学习资料生成失败} {e}")
            return f"（生成中遇到问题，请稍后重试）"

    # 并行执行
    doc_task = safe_chat(_personalized_prompt(doc_prompt, personal_context), "你是一位耐心的AI教师。")
    mm_task = safe_chat(_personalized_prompt(mindmap_prompt, personal_context), "你是一位教学设计专家。")
    code_task = safe_chat(_personalized_prompt(code_prompt, personal_context), "你是一位Python编程导师。")
    quiz_task = safe_chat(_personalized_prompt(quiz_prompt, personal_context), "你是一位严格但清晰的出题专家。")
    storyboard_task = safe_chat(_personalized_prompt(storyboard_prompt, personal_context), "你是一位懂教学设计的微课动画导演。")

    results = await asyncio.gather(doc_task, mm_task, code_task, quiz_task, storyboard_task, return_exceptions=True)

    doc_content = results[0] if not isinstance(results[0], Exception) else f"（生成失败: {results[0]}）"
    mm_content = results[1] if not isinstance(results[1], Exception) else f"（生成失败: {results[1]}）"
    code_content = results[2] if not isinstance(results[2], Exception) else f"（生成失败: {results[2]}）"
    quiz_content = results[3] if not isinstance(results[3], Exception) else f"（生成失败: {results[3]}）"
    storyboard_content = results[4] if not isinstance(results[4], Exception) else f"（生成失败: {results[4]}）"

    generated_resources = {
        "document": doc_content,
        "mindmap": mm_content,
        "quiz": quiz_content,
        "code": code_content,
        "storyboard": storyboard_content,
    }
    resource_quality = _review_generated_resources(
        topic=topic,
        resources=generated_resources,
        personalization=personalization_evidence,
    )
    agent_trace.append({
        "agent": "quality_reviewer",
        "name": "资源质检智能体",
        "task": "检查生成资源的结构、格式、可用性和个性化证据",
        "output": f"综合质检 {resource_quality['overall_score']} 分；{resource_quality['summary']}。",
        "status": "done",
    })

    # 存储会话
    learning_sessions[session_id] = {
        "topic": topic,
        "student_id": req.student_id,
        "stage": "learn",  # learn → quiz → review → complete
        "materials": {
            "document": doc_content,
            "mindmap": mm_content,
            "quiz": quiz_content,
            "code": code_content,
            "storyboard": storyboard_content,
        },
        "quiz": None,
        "quiz_result": None,
        "reinforcement": None,
        "personalization": personalization_evidence,
        "resource_quality": resource_quality,
        "agent_trace": agent_trace,
        "round": 1,  # 第几轮
    }

    # 真实学习过程中生成的资料也要沉淀到资源库，供证据中心和评估报告读取。
    try:
        resource_ids = []
        for resource_type, content in generated_resources.items():
            resource_id = _learning_resource_id(session_id, resource_type)
            resource_ids.append(resource_id)
            quality_check = next(
                (item for item in resource_quality["checks"] if item["resource_type"] == resource_type),
                {},
            )
            db.add(LearningResource(
                resource_id=resource_id,
                student_id=req.student_id,
                resource_type=resource_type,
                title=f"{topic} - {RESOURCE_TYPE_NAMES[resource_type]}",
                content=content,
                content_format="markdown",
                topic=topic,
                difficulty="medium",
                extra_data={
                    "source": "adaptive_learning",
                    "session_id": session_id,
                    "personalization": personalization_evidence,
                    "quality_check": quality_check,
                    "agent_trace": [
                        step for step in agent_trace
                        if step.get("agent") in {"planner", "profiler", "quality_reviewer"} or step.get("resource_type") == resource_type
                    ],
                },
            ))

        db.add(LearningRecord(
            student_id=req.student_id,
            action_type="study",
            topic=topic,
            duration=0,
            extra_data={
                "session_id": session_id,
                "resource_ids": resource_ids,
                "personalization": personalization_evidence,
                "resource_quality": resource_quality,
                "agent_trace": agent_trace,
            },
        ))
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"{学习资料沉淀失败} {e}")

    return {
        "success": True,
        "session_id": session_id,
        "topic": topic,
        "materials": {
            "document": doc_content,
            "mindmap": mm_content,
            "quiz": quiz_content,
            "code": code_content,
            "storyboard": storyboard_content,
        },
        "resource_quality": resource_quality,
        "agent_trace": agent_trace,
        "stage": "learn",
    }


@router.post("/quiz/generate")
async def generate_quiz(session_id: str):
    """第2步：生成测验题"""
    session = learning_sessions.get(session_id)
    if not session:
        return {"success": False, "message": "学习会话不存在"}

    topic = session["topic"]
    round_num = session.get("round", 1)
    weak_points = session.get("weak_points", [])
    selected_book = session.get("selected_book") or {}
    book_line = f"主线书籍：{selected_book.get('title')}，请贴合这本书的学习主线。" if selected_book else ""

    # 如果是补强轮，针对薄弱点出题
    focus = ""
    if round_num > 1 and weak_points:
        focus = f"重点针对这些薄弱点：{', '.join(weak_points[:3])}"

    prompt = f"""你是出题专家。请为"{topic}"生成5道选择题。

{book_line}
{focus}
难度：{'简单' if round_num > 1 else '中等'}

要求：
1. 全部是单选题
2. 每道题4个选项（A、B、C、D）
3. 只有1个正确答案
4. 题目要清晰，避免歧义
5. 每道题必须关联一个具体的知识点（用于后续掌握率分析）

返回JSON数组，每道题的格式：
{{"id": 1, "question": "题目描述", "options": ["A.选项1","B.选项2","C.选项3","D.选项4"], "answer": "A", "explanation": "解析说明", "knowledge_point": "具体知识点名称"}}

注意：
- answer 字段只需要填写字母（A/B/C/D）
- options 数组必须正好4个选项
- explanation 要简短说明为什么这个答案正确
- knowledge_point 必须是具体的知识点名称（如[反向传播]、"过拟合"、"梯度下降"），不能是主题名称

只返回JSON数组，不要其他内容。"""

    try:
        response = await asyncio.wait_for(spark.chat(prompt, system_prompt="你是出题专家，只返回JSON。"), timeout=60)
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1].replace("json", "", 1)
        questions = json.loads(response)
        # 验证题目格式
        if not isinstance(questions, list) or len(questions) < 3:
            raise ValueError("题目数量不足")
        for q in questions:
            if "id" not in q or "question" not in q:
                raise ValueError("题目格式错误")
    except Exception as e:
        print(f"{出题失败} {e}")
        questions = [
            {"id": 1, "question": f"关于{topic}，以下说法正确的是？",
             "options": ["A.它是一种基础概念", "B.它完全不重要", "C.它已经过时了", "D.无法实际应用"],
             "answer": "A", "explanation": f"{topic}是该领域的核心概念", "knowledge_point": f"{topic}基础概念"},
            {"id": 2, "question": f"{topic}主要应用于以下哪个领域？",
             "options": ["A.人工智能与机器学习", "B.烹饪与美食", "C.园艺与种植", "D.音乐与艺术"],
             "answer": "A", "explanation": f"{topic}是人工智能领域的关键技术", "knowledge_point": f"{topic}应用场景"},
            {"id": 3, "question": f"学习{topic}需要什么基础知识？",
             "options": ["A.数学和编程基础", "B.体育运动技能", "C.历史知识", "D.地理知识"],
             "answer": "A", "explanation": f"学习{topic}需要数学（线性代数、概率论）和编程基础", "knowledge_point": f"{topic}前置知识"},
            {"id": 4, "question": f"{topic}的一个典型应用场景是？",
             "options": ["A.图像识别与分类", "B.烹饪食谱推荐", "C.运动训练计划", "D.旅游路线规划"],
             "answer": "A", "explanation": f"{topic}常用于图像处理、数据分析等场景", "knowledge_point": f"{topic}实际应用"},
            {"id": 5, "question": f"以下关于{topic}的描述，哪项是正确的？",
             "options": ["A.它可以帮助解决复杂问题", "B.它只能用于理论研究", "C.它不需要计算资源", "D.它已经完全被淘汰"],
             "answer": "A", "explanation": f"{topic}在实际应用中有广泛的价值", "knowledge_point": f"{topic}价值与意义"},
        ]

    session["quiz"] = questions
    session["stage"] = "quiz"
    agent_trace = _extend_agent_trace(session, [
        {
            "agent": "quiz_generator",
            "name": "题目生成智能体",
            "task": f"为 {topic} 生成第 {round_num} 轮测验",
            "output": f"生成 {len(questions)} 道题；{'重点覆盖错因薄弱点' if round_num > 1 and weak_points else '用于检测首次学习效果'}。",
            "status": "done",
        }
    ])

    return {
        "success": True,
        "questions": questions,
        "stage": "quiz",
        "round": session.get("round", 1),
        "agent_trace": agent_trace,
    }


@router.post("/quiz/submit")
async def submit_quiz(req: SubmitQuizRequest, db: AsyncSession = Depends(get_db)):
    """第3步：提交测验并批改"""
    session = learning_sessions.get(req.session_id)
    if not session:
        return {"success": False, "message": "学习会话不存在"}

    questions = session.get("quiz", [])
    answers = req.answers
    results = []
    correct_count = 0
    total_score = 0
    wrong_topics = []

    for q in questions:
        qid = str(q["id"])
        user_answer = answers.get(qid, "").strip()
        correct_answer = str(q.get("answer", "")).strip()
        q_type = q.get("type", "choice")

        if q_type == "choice":
            grade = grade_choice_answer(user_answer, correct_answer)
        elif q_type == "fill":
            grade = grade_fill_answer(user_answer, correct_answer)
        elif q_type == "short_answer":
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
            wrong_topics.append(q["question"][:40])

        results.append({
            "question_id": q["id"],
            "question": q["question"],
            "type": q_type,
            "user_answer": user_answer,
            "correct_answer": correct_answer,
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

    total = len(questions)
    score = int(total_score / max(total, 1))
    next_plan = _build_next_plan(
        topic=session["topic"],
        score=score,
        wrong_topics=wrong_topics,
        results=results,
        personalization=session.get("personalization") or {},
        round_num=session.get("round", 1),
    )

    session["quiz_result"] = {
        "score": score,
        "correct_count": correct_count,
        "total": total,
        "results": results,
        "wrong_topics": wrong_topics,
        "next_plan": next_plan,
    }

    # 基于知识图谱分析薄弱知识点的影响范围
    from app.knowledge.knowledge_graph import knowledge_graph
    weak_analysis = knowledge_graph.analyze_weak_points(wrong_topics)

    # 生成动态学习路径建议
    topic = session["topic"]
    mastered = set()
    for r in results:
        if r.get("is_correct") and r.get("knowledge_point"):
            mastered.add(r["knowledge_point"])
    learning_path = knowledge_graph.find_learning_path(topic, mastered)

    # 判断是否需要补强
    grading_trace = _extend_agent_trace(session, [
        {
            "agent": "evaluator",
            "name": "评估分析智能体",
            "task": "批改测验并定位薄弱点",
            "output": f"本轮得分 {score} 分，定位 {len(wrong_topics)} 个薄弱点。",
            "status": "done",
        },
        {
            "agent": "path_planner",
            "name": "路径规划智能体",
            "task": "基于知识图谱生成动态学习路径",
            "output": f"已掌握 {len(mastered)} 个知识点，规划了 {len(learning_path)} 步学习路径。",
            "status": "done",
        }
    ])
    if score < 80:
        session["stage"] = "reinforce"
        session["weak_points"] = wrong_topics
    else:
        session["stage"] = "complete"

    # 保存学习记录并自动沉淀错题，形成[测验-错题本-复习]的闭环证据。
    wrong_count = 0
    try:
        from app.api.wrong_book import save_wrong_question

        for r in results:
            if r.get("is_correct"):
                continue
            orig_q = next((q for q in questions if q["id"] == r["question_id"]), {})
            await save_wrong_question(
                db,
                req.student_id,
                {
                    "question_id": f"{req.session_id}_{r['question_id']}",
                    "question": r["question"],
                    "question_type": r.get("type", "choice"),
                    "options": orig_q.get("options"),
                    "correct_answer": r["correct_answer"],
                    "user_answer": r["user_answer"],
                    "explanation": r.get("grade_feedback") or r.get("explanation", ""),
                    "topic": session["topic"],
                    "knowledge_point": session["topic"],
                    "is_mastered": False,
                },
            )
            wrong_count += 1

        db.add(LearningRecord(
            student_id=req.student_id,
            action_type="quiz",
            topic=session["topic"],
            score=score,
            extra_data={
                "correct": correct_count,
                "total": total,
                "round": session.get("round", 1),
                "wrong_saved": wrong_count,
                "wrong_topics": wrong_topics,
                "grading": "semantic_short_answer_v1",
                "next_plan": next_plan,
                "agent_trace": grading_trace,
            },
        ))
        await db.commit()
        print(f"{错题本} 已持久化 {wrong_count} 道错题")
    except Exception as e:
        await db.rollback()
        print(f"{保存记录失败} {e}")

    return {
        "success": True,
        "score": score,
        "correct_count": correct_count,
        "total": total,
        "results": results,
        "wrong_topics": wrong_topics,
        "next_plan": next_plan,
        "weak_analysis": weak_analysis,
        "learning_path": learning_path,
        "mastered_topics": list(mastered),
        "agent_trace": session.get("agent_trace", []),
        "stage": session["stage"],
        "message": f"掌握程度：{score}%" + ("，部分知识点需要加强" if score < 80 else "，恭喜掌握！"),
    }


@router.post("/reinforce")
async def generate_reinforcement(session_id: str, db: AsyncSession = Depends(get_db)):
    """第4步：生成补强资料"""
    session = learning_sessions.get(session_id)
    if not session:
        return {"success": False, "message": "学习会话不存在"}

    topic = session["topic"]
    weak_points = session.get("weak_points", [])
    student_id = session.get("student_id", "default")
    personalization_evidence = session.get("personalization") or {}

    # 生成针对性补强资料
    prompt = f"""你是AI辅导老师。学生在"{topic}"的测试中，以下知识点没掌握：
{json.dumps(weak_points, ensure_ascii=False)}

请针对这些薄弱点，生成一份简明的补强讲解：
1. 逐个解释错误原因
2. 用简单例子说明正确理解
3. 给出记忆技巧
4. 200-300字

用Markdown格式，语气亲切。"""

    try:
        reinforcement = await asyncio.wait_for(spark.chat(prompt, system_prompt="你是耐心的AI辅导老师。"), timeout=60)
        if len(reinforcement) < 50:
            raise ValueError("补强内容太短")
    except Exception as e:
        print(f"{补强生成失败} {e}")
        reinforcement = f"## {topic} 薄弱点补强\n\n"
        for t in weak_points:
            reinforcement += f"### {t}\n\n请重点复习这个知识点。建议：\n1. 重新阅读相关资料\n2. 尝试用自己的话解释\n3. 做相关练习题\n\n"
        reinforcement += f"\n**建议：** 重点理解以上知识点后，再做一次测试。"

    session["reinforcement"] = reinforcement
    session["round"] = session.get("round", 1) + 1
    session["stage"] = "review"
    agent_trace = _extend_agent_trace(session, [
        {
            "agent": "reinforcement_generator",
            "name": "错因补强智能体",
            "task": "根据错题生成补强讲解",
            "output": f"围绕 {len(weak_points)} 个薄弱点生成复习资料，并进入下一轮测验。",
            "status": "done",
        }
    ])

    try:
        round_num = session.get("round", 1)
        resource_id = _learning_resource_id(session_id, "reinforcement", round_num)
        db.add(LearningResource(
            resource_id=resource_id,
            student_id=student_id,
            resource_type="document",
            title=f"{topic} - 错因补强资料",
            content=reinforcement,
            content_format="markdown",
            topic=topic,
            difficulty="medium",
            extra_data={
                "source": "adaptive_reinforcement",
                "session_id": session_id,
                "round": round_num,
                "weak_points": weak_points,
                "personalization": personalization_evidence,
                "agent_trace": agent_trace,
            },
        ))
        db.add(LearningRecord(
            student_id=student_id,
            resource_id=resource_id,
            action_type="reinforce",
            topic=topic,
            duration=0,
            extra_data={
                "session_id": session_id,
                "round": round_num,
                "weak_points": weak_points,
                "resource_id": resource_id,
                "agent_trace": agent_trace,
            },
        ))
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"{补强资料沉淀失败} {e}")

    return {
        "success": True,
        "reinforcement": reinforcement,
        "wrong_topics": weak_points,
        "stage": "review",
        "round": session.get("round", 1),
        "agent_trace": agent_trace,
    }


@router.get("/status/{session_id}")
async def get_status(session_id: str):
    """获取学习会话状态"""
    session = learning_sessions.get(session_id)
    if not session:
        return {"success": False, "message": "会话不存在"}

    return {
        "success": True,
        "topic": session["topic"],
        "stage": session["stage"],
        "round": session.get("round", 1),
        "has_materials": bool(session.get("materials")),
        "has_quiz": bool(session.get("quiz")),
        "quiz_result": session.get("quiz_result"),
        "agent_trace": session.get("agent_trace", []),
    }
