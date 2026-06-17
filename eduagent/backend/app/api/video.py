"""
视频搜索 API — 按学生画像推荐 B 站高播放量直达视频。
"""
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import StudentProfile, get_db
from app.services.bilibili_recommender import (
    extract_profile_text,
    recommend_bilibili_videos,
)


router = APIRouter()

COVER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Referer": "https://www.bilibili.com/",
}

ALLOWED_COVER_HOSTS = {
    "i0.hdslb.com",
    "i1.hdslb.com",
    "i2.hdslb.com",
    "archive.biliimg.com",
}


class VideoSearchRequest(BaseModel):
    keyword: str
    count: int = 6
    student_id: str = "default"


@router.get("/cover")
async def proxy_cover(url: str = Query(..., min_length=10)):
    """代理 B 站封面，避免前端直连图床时出现防盗链破图。"""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in ALLOWED_COVER_HOSTS:
        raise HTTPException(status_code=400, detail="不支持的封面地址")

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url, headers=COVER_HEADERS)
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "image/jpeg")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="封面响应不是图片")

    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/search")
async def search_videos(req: VideoSearchRequest, db: AsyncSession = Depends(get_db)):
    """返回具体 B 站视频页链接，不返回搜索结果页。"""
    profile_text = ""
    try:
        result = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == req.student_id)
        )
        profile = result.scalar_one_or_none()
        profile_text = extract_profile_text(profile)
    except Exception as exc:
        print(f"[读取学生画像失败] {exc}")

    videos = await recommend_bilibili_videos(
        keyword=req.keyword,
        count=req.count,
        profile_text=profile_text,
    )

    return {
        "success": True,
        "videos": videos,
        "profile_hint": profile_text,
        "direct_only": True,
    }
