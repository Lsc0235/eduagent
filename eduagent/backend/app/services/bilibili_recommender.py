"""
Bilibili video recommender.

It always returns concrete video URLs. The search endpoint is only used as a
data source; users never receive a Bilibili search-result URL.
"""
from __future__ import annotations

import html
import re
from typing import Any
from urllib.parse import quote

import httpx


BILIBILI_SEARCH_URL = "https://api.bilibili.com/x/web-interface/search/type"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://search.bilibili.com/",
}

NEGATIVE_TITLE_WORDS = [
    "minecraft",
    "红石",
    "游戏",
    "鬼畜",
    "音乐",
    "影视",
    "直播",
    "切片",
    "reaction",
]

LEARNING_TITLE_WORDS = [
    "教程",
    "课程",
    "入门",
    "详解",
    "讲解",
    "学习",
    "机器学习",
    "深度学习",
    "神经网络",
    "人工智能",
    "python",
    "pytorch",
    "tensorflow",
    "matlab",
]

DIRECT_FALLBACKS = [
    {
        "topics": ["神经网络", "深度学习", "人工智能", "机器学习", "ai", "bp", "cnn", "rnn"],
        "title": "强推！Python＋机器学习＋深度学习系列课程",
        "bvid": "BV1j6qzYzE4h",
        "author": "AlfredTaylorHD",
        "play": 10459223,
        "duration": "",
        "cover": "",
        "recommend_reason": "高播放量 AI 入门系列，适合先建立机器学习到神经网络的整体框架。",
    },
    {
        "topics": ["神经网络", "机器学习", "数学建模", "matlab", "bp"],
        "title": "0基础入门 MATLAB 神经网络工具箱教程",
        "bvid": "BV13D4y1Q7RS",
        "author": "爱研究的小阿楠",
        "play": 7467063,
        "duration": "",
        "cover": "",
        "recommend_reason": "高播放量工具实操视频，适合数学建模、实验和快速上手场景。",
    },
]


def extract_profile_text(profile: Any) -> str:
    if not profile:
        return ""

    parts: list[str] = []
    for field_name in [
        "knowledge_base",
        "cognitive_style",
        "learning_ability",
        "error_patterns",
        "learning_goals",
        "interests",
        "learning_habits",
    ]:
        field = getattr(profile, field_name, None)
        if isinstance(field, dict) and field.get("value"):
            parts.append(str(field["value"]))
    return "；".join(parts)


def build_profile_queries(keyword: str, profile_text: str = "") -> list[str]:
    base = keyword.strip()
    if not base:
        return []

    text = profile_text.lower()
    queries: list[str] = []

    def add(value: str) -> None:
        value = " ".join(value.split())
        if value and value not in queries:
            queries.append(value)

    beginner = any(word in text for word in ["零基础", "初学", "入门", "基础薄弱", "不懂", "看不懂"])
    practical = any(word in text for word in ["实战", "项目", "代码", "落地", "竞赛", "比赛", "就业"])
    visual = any(word in text for word in ["视频", "动画", "直观", "案例", "图解"])
    theory = any(word in text for word in ["原理", "数学", "公式", "推导", "概念"])

    add(base)
    if beginner:
        add(f"{base} 零基础 入门 教程")
    if practical:
        add(f"{base} 实战 项目 Python")
    if visual:
        add(f"{base} 动画 图解 通俗")
    if theory:
        add(f"{base} 原理 详解")

    add(f"{base} 入门教程")
    add(f"{base} 课程")
    add(f"{base} 详解")
    return queries[:5]


def _clean_title(title: str) -> str:
    title = re.sub(r"</?em[^>]*>", "", title or "")
    return html.unescape(title).strip()


def _cover_proxy_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    if raw_url.startswith("//"):
        raw_url = f"https:{raw_url}"
    if raw_url.startswith("http://"):
        raw_url = raw_url.replace("http://", "https://", 1)
    if not raw_url.startswith("https://"):
        return ""
    return f"/api/video/cover?url={quote(raw_url, safe='')}"


def _play_to_int(value: Any) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if not value:
        return 0

    text = str(value).replace(",", "").strip().lower()
    if text in {"--", "-"}:
        return 0
    multiplier = 1
    if text.endswith("万"):
        multiplier = 10000
        text = text[:-1]
    try:
        return int(float(text) * multiplier)
    except ValueError:
        return 0


def _is_learning_video(title: str, keyword: str) -> bool:
    lower = title.lower()
    if any(word in lower for word in NEGATIVE_TITLE_WORDS):
        return False
    if keyword.lower() in lower:
        return True
    return any(word in lower for word in LEARNING_TITLE_WORDS)


def _reason_for(profile_text: str, source_keyword: str, play: int) -> str:
    fragments = []
    text = profile_text.lower()
    if any(word in text for word in ["零基础", "初学", "入门", "基础薄弱"]):
        fragments.append("匹配你的基础阶段")
    if any(word in text for word in ["实战", "项目", "代码", "落地", "竞赛", "比赛"]):
        fragments.append("偏向实战项目")
    if any(word in text for word in ["视频", "动画", "直观", "图解"]):
        fragments.append("偏向直观讲解")
    if not fragments:
        fragments.append("按当前主题匹配")
    if play > 0:
        fragments.append(f"播放量 {play:,}")
    fragments.append(f"检索词：{source_keyword}")
    return "，".join(fragments)


async def _search_once(client: httpx.AsyncClient, keyword: str, limit: int) -> list[dict]:
    params = {
        "search_type": "video",
        "keyword": keyword,
        "page": 1,
        "pagesize": min(max(limit * 3, 12), 30),
        "order": "click",
    }
    response = await client.get(BILIBILI_SEARCH_URL, params=params, headers=HEADERS)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != 0:
        return []

    videos = []
    for item in data.get("data", {}).get("result", []):
        bvid = str(item.get("bvid") or "").strip()
        if not bvid:
            continue

        title = _clean_title(str(item.get("title") or ""))
        if not _is_learning_video(title, keyword):
            continue

        pic = str(item.get("pic") or "")
        if pic and not pic.startswith("http"):
            pic = "https:" + pic

        play = _play_to_int(item.get("play"))
        videos.append({
            "title": title,
            "url": f"https://www.bilibili.com/video/{bvid}/",
            "author": item.get("author", ""),
            "play": play,
            "duration": item.get("duration", ""),
            "cover": _cover_proxy_url(pic),
            "bvid": bvid,
            "source_keyword": keyword,
            "is_direct": True,
        })
    return videos


def _direct_fallback_matches(keyword: str, profile_text: str, allow_generic: bool = False) -> list[dict]:
    key = keyword.lower()
    selected = []
    for item in DIRECT_FALLBACKS:
        topics = [str(topic).lower() for topic in item["topics"]]
        if any(topic in key or key in topic for topic in topics):
            selected.append(item)

    if not selected and allow_generic:
        selected = DIRECT_FALLBACKS[:]

    videos = []
    for item in selected:
        bvid = item["bvid"]
        play = int(item.get("play", 0))
        videos.append({
            "title": item["title"],
            "url": f"https://www.bilibili.com/video/{bvid}/",
            "author": item.get("author", ""),
            "play": play,
            "duration": item.get("duration", ""),
            "cover": item.get("cover", ""),
            "bvid": bvid,
            "source_keyword": "精选直达视频",
            "is_direct": True,
            "recommend_reason": item.get("recommend_reason") or _reason_for(profile_text, keyword, play),
            "fallback": True,
        })
    return videos


def _fallback_videos(keyword: str, count: int, profile_text: str) -> list[dict]:
    return _direct_fallback_matches(keyword, profile_text, allow_generic=True)[:count]


async def recommend_bilibili_videos(keyword: str, count: int = 6, profile_text: str = "") -> list[dict]:
    queries = build_profile_queries(keyword, profile_text)
    videos_by_bvid: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        for query in queries:
            try:
                for video in await _search_once(client, query, count):
                    current = videos_by_bvid.get(video["bvid"])
                    if not current or video["play"] > current["play"]:
                        videos_by_bvid[video["bvid"]] = video
            except Exception as exc:
                print(f"[B站视频检索失败] {query}: {exc}")

    for video in _direct_fallback_matches(keyword, profile_text):
        current = videos_by_bvid.get(video["bvid"])
        if not current or video["play"] > current.get("play", 0):
            videos_by_bvid[video["bvid"]] = video

    videos = sorted(videos_by_bvid.values(), key=lambda item: item.get("play", 0), reverse=True)
    if not videos:
        return _fallback_videos(keyword, count, profile_text)

    for video in videos:
        video["recommend_reason"] = _reason_for(profile_text, video.get("source_keyword", keyword), video.get("play", 0))

    return videos[:count]
