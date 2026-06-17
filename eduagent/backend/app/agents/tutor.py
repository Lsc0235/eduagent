"""
辅导智能体 — 智能答疑解惑
"""
import json
from typing import AsyncGenerator
from app.agents.base import BaseAgent, AgentRole, AgentMessage, AgentResponse
from app.llm.spark_client import SparkClient
from app.llm.prompts import PromptTemplates


class TutorAgent(BaseAgent):
    """辅导智能体 — 提供即时多模态答疑解惑"""

    def __init__(self):
        super().__init__(
            agent_id="tutor",
            role=AgentRole.TUTOR,
            name="辅导智能体"
        )
        self.spark = SparkClient()

    async def process(self, message: AgentMessage) -> AgentResponse:
        user_message = message.content.get("user_message", "")
        task = message.content.get("task", user_message)
        profile = message.context.get("profile", {})
        knowledge_context = message.context.get("knowledge_context", "")

        prompt = PromptTemplates.TUTORING.format(
            question=task,
            knowledge_context=knowledge_context or "暂无相关知识库上下文",
            student_profile=json.dumps(profile, ensure_ascii=False)
        )

        answer = await self.spark.chat(prompt, PromptTemplates.SYSTEM_BASE)

        return self._create_response(True, {
            "answer": answer,
            "topic": self._detect_topic(task)
        })

    async def process_stream(self, message: AgentMessage) -> AsyncGenerator[str, None]:
        user_message = message.content.get("user_message", "")
        task = message.content.get("task", user_message)
        profile = message.context.get("profile", {})
        knowledge_context = message.context.get("knowledge_context", "")

        prompt = PromptTemplates.TUTORING.format(
            question=task,
            knowledge_context=knowledge_context or "暂无相关知识库上下文",
            student_profile=json.dumps(profile, ensure_ascii=False)
        )

        async for chunk in self.spark.chat_stream(prompt, PromptTemplates.SYSTEM_BASE):
            yield chunk

    def _detect_topic(self, text: str) -> str:
        """检测问题涉及的知识点"""
        topics = {
            "机器学习": ["机器学习", "ML", "监督学习", "无监督学习"],
            "深度学习": ["深度学习", "神经网络", "CNN", "RNN", "Transformer"],
            "自然语言处理": ["NLP", "自然语言", "文本", "语言模型"],
            "计算机视觉": ["视觉", "图像", "目标检测", "图像分类"],
            "强化学习": ["强化学习", "Q-learning", "策略梯度"],
        }
        for topic, keywords in topics.items():
            for kw in keywords:
                if kw in text:
                    return topic
        return "通用"
