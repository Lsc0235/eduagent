"""
评估智能体 — 学习效果评估
"""
import json
from typing import AsyncGenerator
from app.agents.base import BaseAgent, AgentRole, AgentMessage, AgentResponse
from app.llm.spark_client import SparkClient
from app.llm.prompts import PromptTemplates


class EvaluatorAgent(BaseAgent):
    """评估智能体 — 跟踪学习行为、评估效果、动态调整策略"""

    def __init__(self):
        super().__init__(
            agent_id="evaluator",
            role=AgentRole.EVALUATOR,
            name="评估智能体"
        )
        self.spark = SparkClient()

    async def process(self, message: AgentMessage) -> AgentResponse:
        learning_records = message.context.get("learning_records", [])
        quiz_scores = message.context.get("quiz_scores", [])
        study_duration = message.context.get("study_duration", 0)

        prompt = PromptTemplates.EVALUATION.format(
            learning_records=json.dumps(learning_records, ensure_ascii=False),
            quiz_scores=json.dumps(quiz_scores, ensure_ascii=False),
            study_duration=study_duration
        )

        result = await self.spark.chat(prompt, PromptTemplates.SYSTEM_BASE)
        parsed = self._parse_evaluation(result)

        return self._create_response(True, {
            "report": parsed,
            "summary": self._generate_summary(parsed)
        })

    async def process_stream(self, message: AgentMessage) -> AsyncGenerator[str, None]:
        result = await self.process(message)
        yield json.dumps(result.content, ensure_ascii=False)

    def _parse_evaluation(self, response: str) -> dict:
        try:
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
            return json.loads(response)
        except json.JSONDecodeError:
            return {"error": "评估解析失败", "raw": response}

    def _generate_summary(self, evaluation: dict) -> str:
        """生成评估摘要文本"""
        if "error" in evaluation:
            return "暂无足够数据生成评估报告，请继续学习积累数据。"
        score = evaluation.get("overall_score", 0)
        return f"综合学习效果评分：{score}/100"
