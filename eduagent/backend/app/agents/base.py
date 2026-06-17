"""
Agent 基类 — 所有智能体的父类
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio
import uuid


class AgentRole(str, Enum):
    """智能体角色"""
    ORCHESTRATOR = "orchestrator"
    PROFILER = "profiler"
    RESOURCE_GENERATOR = "resource_generator"
    PATH_PLANNER = "path_planner"
    TUTOR = "tutor"
    EVALUATOR = "evaluator"


class MessageType(str, Enum):
    """消息类型"""
    REQUEST = "request"
    RESPONSE = "response"
    BROADCAST = "broadcast"
    STREAM = "stream"


@dataclass
class AgentMessage:
    """Agent 间通信消息"""
    sender: str
    receiver: str
    message_type: MessageType
    content: dict
    context: dict = field(default_factory=dict)
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    parent_id: Optional[str] = None


@dataclass
class AgentResponse:
    """Agent 响应"""
    agent_id: str
    success: bool
    content: dict
    message: str = ""
    stream_chunks: list = field(default_factory=list)


class BaseAgent(ABC):
    """智能体基类"""

    def __init__(self, agent_id: str, role: AgentRole, name: str):
        self.agent_id = agent_id
        self.role = role
        self.name = name
        self._is_busy = False

    @property
    def is_busy(self) -> bool:
        return self._is_busy

    @abstractmethod
    async def process(self, message: AgentMessage) -> AgentResponse:
        """处理消息并返回响应"""
        pass

    @abstractmethod
    async def process_stream(self, message: AgentMessage) -> AsyncGenerator[str, None]:
        """流式处理消息"""
        pass

    async def safe_process(self, message: AgentMessage) -> AgentResponse:
        """安全处理（带异常捕获）"""
        self._is_busy = True
        try:
            result = await asyncio.wait_for(
                self.process(message),
                timeout=60
            )
            return result
        except asyncio.TimeoutError:
            return AgentResponse(
                agent_id=self.agent_id,
                success=False,
                content={},
                message=f"Agent {self.name} 处理超时"
            )
        except Exception as e:
            return AgentResponse(
                agent_id=self.agent_id,
                success=False,
                content={},
                message=f"Agent {self.name} 处理出错: {str(e)}"
            )
        finally:
            self._is_busy = False

    def _create_response(self, success: bool, content: dict, message: str = "") -> AgentResponse:
        return AgentResponse(
            agent_id=self.agent_id,
            success=success,
            content=content,
            message=message
        )
