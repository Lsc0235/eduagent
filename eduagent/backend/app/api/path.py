"""
学习资源搜索 API — 搜索课程相关的在线资源（带B站播放量排序）
"""
import json
import asyncio
import urllib.parse
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.llm.spark_client import SparkClient
from app.services.bilibili_recommender import recommend_bilibili_videos

router = APIRouter()
spark = SparkClient()

async def search_bilibili_by_views(keyword: str, limit: int = 5) -> List[dict]:
    """
    调用B站API搜索视频，按播放量排序返回
    """
    videos = await recommend_bilibili_videos(keyword=keyword, count=limit)
    return [
        {
            "title": video["title"],
            "url": video["url"],
            "play_count": video.get("play", 0),
            "author": video.get("author", ""),
            "duration": video.get("duration", ""),
            "description": video.get("recommend_reason", ""),
            "bvid": video.get("bvid", ""),
        }
        for video in videos
    ]


class SearchRequest(BaseModel):
    query: str
    student_id: str = "default"


@router.post("/search")
async def search_resources(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    """搜索课程在线资源 — B站返回播放量最高的视频链接"""
    
    # 获取学生画像用于个性化推荐
    try:
        from sqlalchemy import select as sel
        from app.models.database import StudentProfile
        profile_result = await db.execute(sel(StudentProfile).where(StudentProfile.student_id == req.student_id))
        profile = profile_result.scalar_one_or_none()
        profile_text = ""
        if profile:
            parts = []
            for field in [profile.knowledge_base, profile.learning_goals, profile.interests, profile.learning_habits]:
                if field and isinstance(field, dict) and field.get("value"):
                    parts.append(field["value"])
            profile_text = "；".join(parts) if parts else ""
    except Exception:
        profile_text = ""

    # 用 AI 生成个性化资源推荐
    profile_hint = f"学生情况：{profile_text}。" if profile_text else "学生情况：未知。"

    prompt = f"""你是一个专业的学习资源推荐助手。{profile_hint}

用户想学习: {req.query}

请推荐5个具体的学习资源。每个资源必须是一个真实的、知名的课程或教程。

推荐要求：
1. 必须是真实的、广泛认可的课程名称（如：吴恩达《机器学习》、李宏毅《深度学习》、黑马程序员Python教程等）
2. B站上能搜到的具体课程名
3. 按学习顺序排列（入门→进阶→高级）

返回JSON数组，每个资源包含：
- title: 课程全名（必须包含讲师名或机构名，如"吴恩达 机器学习 Coursera"）
- platform: 平台（B站、慕课网、Coursera、YouTube、CSDN）
- description: 这个课程讲什么，大约多少小时
- difficulty: 难度（入门/进阶/高级）
- reason: 为什么推荐这个课程给这个学生
- order: 学习顺序（1=先学）

只返回JSON数组。"""

    base_resources = []
    try:
        response = await asyncio.wait_for(spark.chat(prompt), timeout=30)
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1].replace("json", "", 1)
        base_resources = json.loads(response)
    except Exception as e:
        print(f"[搜索失败] {e}")

    resources = []
    bilibili_keywords = []  # 收集需要搜索B站的关键词
    
    # 第一轮：收集所有B站平台的资源，准备搜索
    for r in base_resources[:5]:
        platform = r.get("platform", "B站")
        course_name = r.get("title", req.query)
        
        if platform in ["B站", "bilibili"]:
            bilibili_keywords.append(course_name)
        else:
            # 非B站平台使用搜索链接
            search_urls = {
                "YouTube": f"https://www.youtube.com/results?search_query={urllib.parse.quote(course_name)}",
                "慕课网": f"https://www.imooc.com/search/?words={urllib.parse.quote(course_name)}",
                "Coursera": f"https://www.coursera.org/search?query={urllib.parse.quote(course_name)}",
                "CSDN": f"https://so.csdn.net/so/search?q={urllib.parse.quote(course_name)}",
                "知乎": f"https://www.zhihu.com/search?type=content&q={urllib.parse.quote(course_name)}",
                "掘金": f"https://juejin.cn/search?query={urllib.parse.quote(course_name)}",
            }
            r["url"] = search_urls.get(platform, "https://www.bilibili.com/video/BV1j6qzYzE4h/")
            resources.append(r)
    
    # 第二轮：调用B站API获取播放量最高的视频
    if bilibili_keywords:
        # 只取第一个关键词搜索（主要关键词）
        main_keyword = bilibili_keywords[0]
        bilibili_videos = await search_bilibili_by_views(main_keyword, limit=5)
        
        if bilibili_videos:
            # 按播放量排序，取播放量最高的
            sorted_videos = sorted(bilibili_videos, key=lambda x: x.get("play_count", 0), reverse=True)
            
            # 为每个B站资源添加播放量最高的视频链接
            for i, keyword in enumerate(bilibili_keywords[:3]):  # 最多处理3个B站资源
                if i < len(sorted_videos):
                    video = sorted_videos[i]
                    r = base_resources[i] if i < len(base_resources) else {}
                    r["url"] = video["url"]
                    r["title"] = video["title"]
                    r["description"] = f"{video.get('author', '')} | 播放量: {video.get('play_count', 0):,} | {video.get('duration', '')}"
                    r["play_count"] = video.get("play_count", 0)
                    resources.append(r)
                else:
                    direct_videos = await search_bilibili_by_views(keyword, limit=1)
                    direct_video = direct_videos[0] if direct_videos else {
                        "title": keyword,
                        "url": "https://www.bilibili.com/video/BV1j6qzYzE4h/",
                        "play_count": 10459223,
                    }
                    resources.append({
                        "title": direct_video["title"],
                        "platform": "B站",
                        "url": direct_video["url"],
                        "description": f"播放量: {direct_video.get('play_count', 0):,}",
                        "difficulty": "入门",
                        "play_count": direct_video.get("play_count", 0),
                        "order": i + 1
                    })
    
    # 如果 AI 失败，B站仍然兜底到具体视频页，避免把用户带到搜索结果页
    if not resources:
        direct_videos = await search_bilibili_by_views(f"{req.query} 入门教程 人工智能", limit=1)
        direct_video = direct_videos[0] if direct_videos else {
            "title": f"{req.query} 入门教程",
            "url": "https://www.bilibili.com/video/BV1j6qzYzE4h/",
            "play_count": 10459223,
            "author": "B站高播放量课程",
            "duration": "",
        }
        k2 = urllib.parse.quote(f"{req.query} 课程 教学")
        k3 = urllib.parse.quote(f"{req.query} 详解")
        k4 = urllib.parse.quote(f"{req.query} 学习路线")
        k5 = urllib.parse.quote(f"{req.query} 实战")
        resources = [
            {"title": direct_video["title"], "platform": "B站", "url": direct_video["url"], "description": f"{direct_video.get('author', '')} | 播放量: {direct_video.get('play_count', 0):,} | {direct_video.get('duration', '')}", "difficulty": "入门", "reason": "按播放量排序后直达具体视频页", "order": 1, "play_count": direct_video.get("play_count", 0)},
            {"title": f"{req.query} 系统课程", "platform": "慕课网", "url": f"https://www.imooc.com/search/?words={k2}", "description": "慕课网系统化课程", "difficulty": "入门", "reason": "结构化学习效果好", "order": 2},
            {"title": f"{req.query} 技术详解", "platform": "CSDN", "url": f"https://so.csdn.net/so/search?q={k3}", "description": "CSDN技术博客深度解析", "difficulty": "进阶", "reason": "深入理解底层原理", "order": 3},
            {"title": f"{req.query} 学习路线", "platform": "知乎", "url": f"https://www.zhihu.com/search?type=content&q={k4}", "description": "知乎高赞学习路线推荐", "difficulty": "入门", "reason": "避免走弯路", "order": 4},
            {"title": f"{req.query} 实战项目", "platform": "掘金", "url": f"https://juejin.cn/search?query={k5}", "description": "掘金开发者社区实战项目", "difficulty": "进阶", "reason": "学以致用", "order": 5},
        ]

    return {"success": True, "resources": resources, "profile_hint": profile_text}


# 保留原有的路径接口（不动）
from app.models.database import LearningPath, StudentProfile

@router.get("/{student_id}")
async def get_paths(student_id: str, course: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    query = select(LearningPath).where(LearningPath.student_id == student_id)
    if course:
        query = query.where(LearningPath.course == course)
    query = query.order_by(LearningPath.updated_at.desc())
    result = await db.execute(query)
    return [
        {"path_id": p.path_id, "course": p.course, "nodes": p.nodes,
         "edges": p.edges, "current_node": p.current_node,
         "progress": p.progress, "updated_at": p.updated_at.isoformat() if p.updated_at else None}
        for p in result.scalars().all()
    ]


# ========== 新增：路径动态调整接口 ==========

class AdjustPathRequest(BaseModel):
    student_id: str = "default"
    course: str = "人工智能导论"


@router.post("/adjust")
async def adjust_learning_path(req: AdjustPathRequest, db: AsyncSession = Depends(get_db)):
    """根据学习表现动态调整学习路径"""
    from app.agents.path_planner import PathPlannerAgent
    from sqlalchemy import select as sel
    from app.models.database import StudentProfile, LearningRecord, QuizRecord
    
    path_planner = PathPlannerAgent()
    
    # 1. 获取学生画像
    profile_result = await db.execute(sel(StudentProfile).where(StudentProfile.student_id == req.student_id))
    profile = profile_result.scalar_one_or_none()
    profile_data = {}
    if profile:
        profile_data = {
            "knowledge_base": profile.knowledge_base or {},
            "learning_goals": profile.learning_goals or {},
            "interests": profile.interests or {},
            "learning_habits": profile.learning_habits or {},
        }
    
    # 2. 获取学习记录和成绩
    quiz_result = await db.execute(
        sel(QuizRecord)
        .where(QuizRecord.student_id == req.student_id)
        .order_by(QuizRecord.created_at.desc())
        .limit(20)
    )
    quizzes = quiz_result.scalars().all()
    
    # 分析学习表现
    recent_scores = {}
    consecutive_failures = {}
    
    for quiz in quizzes:
        topic = quiz.topic or "unknown"
        score = quiz.score or 0
        
        if topic not in recent_scores:
            recent_scores[topic] = score
        
        # 统计连续失败次数
        if score < 60:
            consecutive_failures[topic] = consecutive_failures.get(topic, 0) + 1
        else:
            consecutive_failures[topic] = 0
    
    # 3. 计算学习效率
    if quizzes:
        avg_score = sum(q.score or 0 for q in quizzes) / len(quizzes)
        learning_efficiency = min(100, avg_score * 1.2)
    else:
        learning_efficiency = 50
    
    evaluation_data = {
        "recent_scores": recent_scores,
        "consecutive_failures": consecutive_failures,
        "learning_efficiency": learning_efficiency,
        "weak_points": [topic for topic, score in recent_scores.items() if score < 60],
    }
    
    # 4. 调用路径规划智能体进行动态调整
    try:
        adjusted_path = await path_planner._adjust_path_based_on_performance(
            profile_data, {}, evaluation_data, await path_planner._get_knowledge_graph()
        )
        
        return {
            "success": True,
            "path": adjusted_path,
            "adjustments": adjusted_path.get("adjustments", []),
            "summary": adjusted_path.get("adjustment_summary", "路径已调整"),
            "evaluation_summary": {
                "weak_points_count": len(evaluation_data["weak_points"]),
                "learning_efficiency": learning_efficiency,
                "total_quizzes": len(quizzes),
            }
        }
    except Exception as e:
        print(f"[路径调整失败] {e}")
        return {
            "success": False,
            "error": str(e),
            "fallback": "建议继续当前学习路径"
        }
