"""
资源生成智能体 — 多类型个性化学习资源生成
"""
import json
import uuid
from typing import AsyncGenerator
from app.agents.base import BaseAgent, AgentRole, AgentMessage, AgentResponse
from app.llm.spark_client import SparkClient
from app.llm.prompts import PromptTemplates


class ResourceGeneratorAgent(BaseAgent):
    """资源生成智能体 — 协调 5+ 种资源类型的个性化生成"""

    def __init__(self):
        super().__init__(
            agent_id="resource_generator",
            role=AgentRole.RESOURCE_GENERATOR,
            name="资源生成智能体"
        )
        self.spark = SparkClient()
        self.resource_types = PromptTemplates.RESOURCE_TYPES

    async def process(self, message: AgentMessage) -> AgentResponse:
        task = message.content.get("task", "")
        user_message = message.content.get("user_message", "")
        params = message.content.get("params", {})
        profile = message.context.get("profile", {})

        # 确定要生成的资源类型
        resource_types_to_gen = params.get("types", ["document", "mindmap", "quiz", "code", "storyboard"])
        topic = params.get("topic", self._extract_topic(user_message))
        difficulty = params.get("difficulty", "medium")

        resources = []
        summaries = []

        for res_type in resource_types_to_gen:
            if res_type not in self.resource_types:
                continue

            type_info = self.resource_types[res_type]
            prompt = PromptTemplates.RESOURCE_GENERATION.format(
                student_profile=json.dumps(profile, ensure_ascii=False),
                topic=topic,
                resource_type=type_info["name"],
                difficulty=difficulty,
                specific_instructions=type_info["instructions"]
            )

            content = await self.spark.chat(prompt, PromptTemplates.SYSTEM_BASE)

            resource = {
                "resource_id": str(uuid.uuid4())[:8],
                "type": res_type,
                "type_name": type_info["name"],
                "title": f"{topic} - {type_info['name']}",
                "content": content,
                "topic": topic,
                "difficulty": difficulty,
            }
            resources.append(resource)
            summaries.append(f"已生成「{type_info['name']}」")

        return self._create_response(True, {
            "resources": resources,
            "summary": f"已为「{topic}」生成 {len(resources)} 份学习资源：{'、'.join(summaries)}"
        })

    async def process_stream(self, message: AgentMessage) -> AsyncGenerator[str, None]:
        result = await self.process(message)
        for resource in result.content.get("resources", []):
            yield json.dumps({"type": "resource", "data": resource}, ensure_ascii=False) + "\n"

    def _extract_topic(self, text: str) -> str:
        """从用户消息中提取知识点主题"""
        # 简单的关键词提取，实际应使用 LLM
        keywords = ["机器学习", "深度学习", "神经网络", "线性回归", "逻辑回归",
                     "决策树", "随机森林", "SVM", "卷积神经网络", "循环神经网络",
                     "自然语言处理", "计算机视觉", "强化学习", "聚类", "降维",
                     "反向传播", "梯度下降", "过拟合", "正则化", "特征工程"]
        for kw in keywords:
            if kw in text:
                return kw
        return "人工智能基础"
