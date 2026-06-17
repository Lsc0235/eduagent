"""
数据库模型与初始化
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float, ForeignKey
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from app.config import get_settings


def _utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Student(Base):
    """学生信息"""
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(100), default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    profile = relationship("StudentProfile", back_populates="student", uselist=False)
    chat_sessions = relationship("ChatSession", back_populates="student")


class StudentProfile(Base):
    """学生画像（6+ 维度）"""
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(64), ForeignKey("students.student_id"), unique=True, nullable=False)

    knowledge_base = Column(JSON, default=dict)
    cognitive_style = Column(JSON, default=dict)
    learning_ability = Column(JSON, default=dict)
    error_patterns = Column(JSON, default=dict)
    learning_goals = Column(JSON, default=dict)
    interests = Column(JSON, default=dict)
    learning_habits = Column(JSON, default=dict)

    profile_version = Column(Integer, default=1)
    raw_text = Column(Text, default="")
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    student = relationship("Student", back_populates="profile")


class ChatSession(Base):
    """对话会话"""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    student_id = Column(String(64), ForeignKey("students.student_id"), nullable=False)
    title = Column(String(200), default="新对话")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    student = relationship("Student", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    """对话消息"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.session_id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text")
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)

    session = relationship("ChatSession", back_populates="messages")


class LearningResource(Base):
    """学习资源"""
    __tablename__ = "learning_resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(String(64), unique=True, nullable=False, index=True)
    student_id = Column(String(64), index=True)
    resource_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    content_format = Column(String(20), default="markdown")
    topic = Column(String(100), default="")
    difficulty = Column(String(20), default="medium")
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)


class LearningPath(Base):
    """学习路径"""
    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, autoincrement=True)
    path_id = Column(String(64), unique=True, nullable=False, index=True)
    student_id = Column(String(64), nullable=False, index=True)
    course = Column(String(100), nullable=False)
    nodes = Column(JSON, default=list)
    edges = Column(JSON, default=list)
    current_node = Column(String(64), default="")
    progress = Column(Float, default=0.0)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class LearningRecord(Base):
    """学习记录"""
    __tablename__ = "learning_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(64), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    resource_id = Column(String(64), default="")
    topic = Column(String(100), default="")
    score = Column(Float, nullable=True)
    duration = Column(Integer, default=0)
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)


# 数据库引擎
settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """初始化数据库"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """获取数据库会话"""
    async with async_session() as session:
        yield session
