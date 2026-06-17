"""
智学通（EduAgent）— 配置管理
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""

    # 应用基础
    app_name: str = "智学通 EduAgent"
    debug: bool = False

    # 科大讯飞星火 API
    spark_api_key: str = ""
    spark_api_secret: str = ""
    spark_app_id: str = ""
    spark_api_url: str = "wss://spark-api.xf-yun.com/v4.0/chat"
    spark_http_url: str = "https://spark-api-open.xf-yun.com/v1/chat/completions"
    spark_model: str = ""

    # 数据库（Render 部署时通过 DATABASE_URL 环境变量覆盖为 PostgreSQL）
    database_url: str = "sqlite+aiosqlite:///./eduagent.db"

    # 向量数据库
    chroma_persist_dir: str = "./data/chroma_db"

    # 课程知识库
    knowledge_base_dir: str = "./data/ai_intro"

    # 安全
    secret_key: str = "dev-secret-key-change-in-production"

    # CORS
    frontend_url: str = "http://localhost:5173"

    # Agent 配置
    max_concurrent_agents: int = 3
    agent_timeout: int = 60  # 秒
    max_retries: int = 3

    # LLM 参数
    llm_temperature: float = 0.7
    llm_max_tokens: int = 4096

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# 项目根目录
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
KNOWLEDGE_DIR = DATA_DIR / "ai_intro"
