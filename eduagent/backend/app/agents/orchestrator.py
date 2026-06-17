"""
编排智能体（Orchestrator）— 多智能体系统中枢
"""
from typing import AsyncGenerator
from app.agents.base import BaseAgent, AgentRole, AgentMessage, MessageType, AgentResponse
from app.agents.profiler import ProfilerAgent
from app.agents.resource_gen import ResourceGeneratorAgent
from app.agents.path_planner import PathPlannerAgent
from app.agents.tutor import TutorAgent
from app.agents.evaluator import EvaluatorAgent
from app.llm.spark_client import SparkClient
import json


class OrchestratorAgent(BaseAgent):
    """编排智能体 — 意图识别、任务分解、Agent 调度"""

    def __init__(self):
        super().__init__(
            agent_id="orchestrator",
            role=AgentRole.ORCHESTRATOR,
            name="编排智能体"
        )
        self.spark = SparkClient()
        self.agents = {
            "profiler": ProfilerAgent(),
            "resource": ResourceGeneratorAgent(),
            "path": PathPlannerAgent(),
            "tutor": TutorAgent(),
            "evaluator": EvaluatorAgent(),
        }

    INTENT_PROMPT = """你是一个意图识别系统。根据用户的对话内容，判断需要调用哪些智能体。

用户消息: {user_message}
对话历史摘要: {history_summary}

请以 JSON 格式返回需要调用的智能体列表和任务描述：
{{
    "intents": [
        {{
            "agent": "profiler|resource|path|tutor|evaluator",
            "task": "具体任务描述",
            "priority": "high|medium|low",
            "params": {{}}
        }}
    ],
    "response_type": "direct|multi_agent",
    "direct_reply": "如果可以直接回复的内容（仅当 response_type=direct 时）"
}}

智能体说明：
- profiler: 学生画像构建/更新/查询
- resource: 学习资源生成（文档、思维导图、题目、代码案例、阅读材料等）
- path: 学习路径规划/查看/调整
- tutor: 学习辅导答疑
- evaluator: 学习效果评估

只返回 JSON，不要其他内容。"""

    async def process(self, message: AgentMessage) -> AgentResponse:
        """处理用户消息"""
        user_message = message.content.get("user_message", "")
        history_summary = message.content.get("history_summary", "")
        student_id = message.context.get("student_id", "default")

        # 意图识别
        intent_prompt = self.INTENT_PROMPT.format(
            user_message=user_message,
            history_summary=history_summary
        )

        intent_response = await self.spark.chat(intent_prompt)
        intents = self._parse_intents(intent_response)

        if not intents:
            return self._create_response(True, {"reply": "抱歉，我没有理解你的意思，请再说一次。"})

        response_type = intents.get("response_type", "multi_agent")

        # 直接回复
        if response_type == "direct":
            return self._create_response(True, {
                "reply": intents.get("direct_reply", ""),
                "agents_used": []
            })

        # 多智能体协作
        agent_tasks = intents.get("intents", [])
        results = await self._dispatch_agents(agent_tasks, message)

        # 聚合结果
        aggregated = await self._aggregate_results(results, user_message, student_id)

        return self._create_response(True, aggregated)

    async def process_stream(self, message: AgentMessage) -> AsyncGenerator[str, None]:
        """流式处理"""
        user_message = message.content.get("user_message", "")
        history_summary = message.content.get("history_summary", "")
        student_id = message.context.get("student_id", "default")

        # 意图识别
        yield json.dumps({"type": "thinking", "content": "正在分析您的需求..."}, ensure_ascii=False) + "\n"

        intent_prompt = self.INTENT_PROMPT.format(
            user_message=user_message,
            history_summary=history_summary
        )
        intent_response = await self.spark.chat(intent_prompt)
        intents = self._parse_intents(intent_response)

        if not intents:
            yield json.dumps({"type": "reply", "content": "抱歉，我没有理解你的意思，请再说一次。"}, ensure_ascii=False) + "\n"
            return

        response_type = intents.get("response_type", "multi_agent")

        if response_type == "direct":
            direct_reply = intents.get("direct_reply", "")
            # 流式输出直接回复
            async for chunk in self.spark.chat_stream(direct_reply):
                yield json.dumps({"type": "stream", "content": chunk}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "done", "agents_used": []}, ensure_ascii=False) + "\n"
            return

        # 多智能体协作
        agent_tasks = intents.get("intents", [])
        results = []
        for task in agent_tasks:
            agent_name = task.get("agent", "")
            agent = self.agents.get(agent_name)
            if agent:
                yield json.dumps({"type": "agent_start", "agent": agent_name, "task": task.get("task", "")}, ensure_ascii=False) + "\n"
                agent_msg = AgentMessage(
                    sender="orchestrator",
                    receiver=agent_name,
                    message_type=MessageType.REQUEST,
                    content={"task": task.get("task", ""), "params": task.get("params", {}), "user_message": user_message},
                    context=message.context
                )
                result = await agent.safe_process(agent_msg)
                results.append({"agent": agent_name, "result": result})
                yield json.dumps({"type": "agent_done", "agent": agent_name, "success": result.success}, ensure_ascii=False) + "\n"

        # 聚合并流式输出
        aggregated = await self._aggregate_results(results, user_message, student_id)
        reply = aggregated.get("reply", "")

        # 流式输出聚合结果
        async for chunk in self.spark.chat_stream(reply):
            yield json.dumps({"type": "stream", "content": chunk}, ensure_ascii=False) + "\n"

        # 输出资源卡片
        if "resources" in aggregated:
            yield json.dumps({"type": "resources", "data": aggregated["resources"]}, ensure_ascii=False) + "\n"

        if "profile_update" in aggregated:
            yield json.dumps({"type": "profile_update", "data": aggregated["profile_update"]}, ensure_ascii=False) + "\n"

        yield json.dumps({"type": "done", "agents_used": [t.get("agent") for t in agent_tasks]}, ensure_ascii=False) + "\n"

    def _parse_intents(self, response: str) -> dict:
        """解析意图识别结果"""
        try:
            # 尝试提取 JSON
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
            return json.loads(response)
        except json.JSONDecodeError:
            return {"response_type": "direct", "direct_reply": response}

    async def _dispatch_agents(self, tasks: list, original_message: AgentMessage) -> list:
        """分发任务到各 Agent"""
        import asyncio
        results = []

        for task in tasks:
            agent_name = task.get("agent", "")
            agent = self.agents.get(agent_name)
            if not agent:
                continue

            agent_msg = AgentMessage(
                sender="orchestrator",
                receiver=agent_name,
                message_type=MessageType.REQUEST,
                content={"task": task.get("task", ""), "params": task.get("params", {}), "user_message": original_message.content.get("user_message", "")},
                context=original_message.context
            )
            result = await agent.safe_process(agent_msg)
            results.append({"agent": agent_name, "result": result})

        return results

    async def _aggregate_results(self, results: list, user_message: str, student_id: str) -> dict:
        """聚合多个 Agent 的结果"""
        aggregated = {
            "reply": "",
            "agents_used": [],
            "resources": [],
            "profile_update": None,
        }

        # 收集所有 Agent 结果
        resource_contents = []
        for r in results:
            agent_name = r.get("agent", "")
            result = r.get("result")
            aggregated["agents_used"].append(agent_name)

            if result and result.success:
                content = result.content
                if agent_name == "profiler" and "profile" in content:
                    aggregated["profile_update"] = content["profile"]
                elif agent_name == "resource" and "resources" in content:
                    aggregated["resources"].extend(content["resources"])
                    resource_contents.append(content.get("summary", ""))
                elif agent_name == "path" and "path" in content:
                    aggregated["resources"].append({"type": "learning_path", "data": content["path"]})
                elif agent_name == "tutor" and "answer" in content:
                    resource_contents.append(content["answer"])
                elif agent_name == "evaluator" and "report" in content:
                    resource_contents.append(content["report"])

        # 用 LLM 聚合生成自然语言回复
        if resource_contents:
            aggregate_prompt = f"""你是一个智能学习助手。根据以下各智能体的输出结果，为学生生成一段自然、友好的回复。
用户的原始问题: {user_message}

各智能体的输出:
{chr(10).join(resource_contents)}

要求：
1. 用亲切的语气
2. 概括性地介绍各智能体生成的内容
3. 如果有学习资源，引导学生查看
4. 控制在200字以内"""

            aggregated["reply"] = await self.spark.chat(aggregate_prompt)
        else:
            aggregated["reply"] = "我已经处理了您的请求，请查看相关资源。"

        return aggregated
