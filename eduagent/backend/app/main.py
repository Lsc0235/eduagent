"""
智学通（EduAgent）— FastAPI 主入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.api import chat, profile, resource, path, evaluation, quiz, graph, learning, demo, wrong_book, video
from app.models.database import init_db


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    await init_db()
    print("[OK] 智学通 EduAgent 启动成功")

    # 启动时加载知识库并构建TF-IDF向量索引
    try:
        from pathlib import Path
        kb_dir = Path(__file__).parent.parent / "data" / "ai_intro"
        kb_docs = []
        for md_file in kb_dir.glob("*.md"):
            content = md_file.read_text(encoding="utf-8")
            chunks = [c.strip() for c in content.split("\n\n") if c.strip() and len(c.strip()) > 50]
            for i, chunk in enumerate(chunks[:8]):
                kb_docs.append({"source": md_file.name, "content": chunk[:1200]})
        from app.knowledge.rag import vector_rag
        import app.knowledge.rag as rag_mod
        rag_mod.kb_documents = kb_docs
        vector_rag.build_index(kb_docs)
        print(f"[KB] 知识库已加载并构建向量索引: {len(kb_docs)} 个文档块")
    except Exception as e:
        print(f"[WARN] 知识库加载失败: {e}")

    yield
    print("[OK] 智学通 EduAgent 关闭")


app = FastAPI(
    title=settings.app_name,
    description="基于大模型的个性化资源生成与学习多智能体系统",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置（开发阶段允许所有来源）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(chat.router, prefix="/api/chat", tags=["对话"])
app.include_router(profile.router, prefix="/api/profile", tags=["画像"])
app.include_router(resource.router, prefix="/api/resource", tags=["资源"])
app.include_router(path.router, prefix="/api/path", tags=["学习路径"])
app.include_router(evaluation.router, prefix="/api/evaluation", tags=["评估"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["答题"])
app.include_router(graph.router, prefix="/api/graph", tags=["知识图谱"])
app.include_router(learning.router, prefix="/api/learning", tags=["自适应学习"])
app.include_router(demo.router, prefix="/api/demo", tags=["演示数据"])
app.include_router(wrong_book.router, prefix="/api/wrong-book", tags=["错题本"])
app.include_router(video.router, prefix="/api/video", tags=["视频"])


@app.get("/")
async def root():
    return {"message": "智学通 EduAgent API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/test")
async def test_api():
    """简单测试端点，无需数据库"""
    return {"ok": True, "message": "API 正常运行"}


@app.get("/api/selftest")
async def self_test():
    """自测所有功能 — 在浏览器里打开这个链接就能看到结果"""
    import json
    from app.llm.spark_client import SparkClient
    spark = SparkClient()
    results = {}

    # 1. API 连通性
    try:
        r = await spark.chat("请回复：连通成功")
        results["api_connect"] = "pass" if "成功" in r[:20] or len(r) > 5 else "fail"
        results["api_response"] = r[:100]
    except Exception as e:
        results["api_connect"] = f"fail: {str(e)[:100]}"

    # 2. 画像提取
    try:
        r = await spark.chat("""从对话提取学生信息，只返回JSON：
用户说: 我是计算机大三学生，学过Python，想学机器学习""")
        r = r.strip()
        if "```" in r: r = r.split("```")[1]; r = r.replace("json", "", 1) if r.startswith("json") else r
        profile = json.loads(r)
        results["profile_extraction"] = {"status": "pass", "fields": list(profile.keys())[:5]}
    except Exception as e:
        results["profile_extraction"] = {"status": f"fail: {str(e)[:100]}"}

    # 3. 资源生成
    try:
        r = await spark.chat('请用200字讲解"机器学习"的基本概念。直接输出内容。')
        results["resource_gen"] = {"status": "pass" if len(r) > 50 else "fail", "length": len(r)}
    except Exception as e:
        results["resource_gen"] = {"status": f"fail: {str(e)[:100]}"}

    # 4. 路径规划
    try:
        r = await spark.chat('规划学习路径，返回JSON: {"nodes":[{"id":"1","title":"概述"}],"recommendation":"建议"}  只返回JSON')
        r = r.strip()
        if "```" in r: r = r.split("```")[1]; r = r.replace("json", "", 1) if r.startswith("json") else r
        path = json.loads(r)
        results["path_planning"] = {"status": "pass", "nodes": len(path.get("nodes", []))}
    except Exception as e:
        results["path_planning"] = {"status": f"fail: {str(e)[:100]}"}

    # 5. 评估
    try:
        r = await spark.chat('生成评估报告JSON: {"overall_score":75,"dimensions":{"knowledge_mastery":{"score":70,"comment":"ok"}},"strengths":["好"],"weaknesses":["差"],"recommendations":["建议"],"next_focus":"重点"}  只返回JSON')
        r = r.strip()
        if "```" in r: r = r.split("```")[1]; r = r.replace("json", "", 1) if r.startswith("json") else r
        eval_data = json.loads(r)
        results["evaluation"] = {"status": "pass", "score": eval_data.get("overall_score", "?")}
    except Exception as e:
        results["evaluation"] = {"status": f"fail: {str(e)[:100]}"}

    passed = sum(1 for v in results.values() if isinstance(v, dict) and v.get("status") == "pass" or v == "pass")
    results["summary"] = f"通过 {passed}/5"

    return results
