"""
画像智能体 — 对话式学生画像构建
"""
import json
from typing import AsyncGenerator
from app.agents.base import BaseAgent, AgentRole, AgentMessage, AgentResponse
from app.llm.spark_client import SparkClient
from app.llm.prompts import PromptTemplates


class ProfilerAgent(BaseAgent):
    """画像智能体 — 从对话中自动抽取学生特征，构建动态画像"""

    def __init__(self):
        super().__init__(
            agent_id="profiler",
            role=AgentRole.PROFILER,
            name="画像智能体"
        )
        self.spark = SparkClient()

    async def process(self, message: AgentMessage) -> AgentResponse:
        task = message.content.get("task", "")
        user_message = message.content.get("user_message", "")
        current_profile = message.context.get("profile", {})

        # 分析对话，提取画像特征
        prompt = PromptTemplates.PROFILE_EXTRACTION.format(
            current_profile=json.dumps(current_profile, ensure_ascii=False),
            conversation=user_message
        )

        result = await self.spark.chat(prompt, PromptTemplates.SYSTEM_BASE)
        parsed = self._parse_profile_update(result)

        return self._create_response(True, {
            "profile": parsed.get("updated_dimensions", {}),
            "summary": parsed.get("summary", "")
        })

    async def process_stream(self, message: AgentMessage) -> AsyncGenerator[str, None]:
        result = await self.process(message)
        yield json.dumps(result.content, ensure_ascii=False)

    def _parse_profile_update(self, response: str) -> dict:
        try:
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
            return json.loads(response)
        except json.JSONDecodeError:
            return {"updated_dimensions": {}, "summary": response}
