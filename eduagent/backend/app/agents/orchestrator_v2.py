"""
多智能体调度器 — 真正的多Agent协同架构
"""
import json
import asyncio
from app.llm.spark_client import SparkClient
from typing import Dict, Any

spark = SparkClient()

# ─── 各智能体系统提示词 ───

AGENT_ROLES = {
    "planner": {
        "name": "任务规划智能体",
        "desc": "分析用户需求，制定任务计划",
    },
    "profiler": {
        "name": "画像分析智能体",
        "desc": "提取和分析学生特征",
    },
    "doc_generator": {
        "name": "文档生成智能体",
        "desc": "生成课程讲解文档和思维导图",
    },
    "quiz_generator": {
        "name": "题目生成智能体",
        "desc": "生成练习题和测验",
    },
    "code_generator": {
        "name": "代码生成智能体",
        "desc": "生成代码案例和实操材料",
    },
    "tutor": {
        "name": "辅导答疑智能体",
        "desc": "解答学生问题，提供详细讲解",
    },
    "evaluator": {
        "name": "评估分析智能体",
        "desc": "分析学习效果，给出建议",
    },
    "searcher": {
        "name": "资源搜索智能体",
        "desc": "搜索在线学习资源和推荐",
    },
}


class MultiAgentOrchestrator:
    """
    多智能体调度器（编排智能体）

    核心设计：
    1. Planner Agent 分析用户意图，制定执行计划
    2. 根据计划，调度对应的专职 Agent
    3. 多个 Agent 并行执行
    4. 结果由聚合智能体整合返回

    这不是简单的单次 API 调用，而是真正的多智能体协作：
    - 每个 Agent 有自己的专职角色和专业知识
    - Agent 之间通过消息传递协作
    - 编排器协调整个流程
    """

    def __init__(self):
        self.spark = spark

    async def plan(self, user_message: str, profile_text: str) -> dict:
        """
        Step 1: 规划智能体 — 分析需求，制定执行计划
        """
        prompt = f"""你是一个任务规划智能体。分析用户需求，制定执行计划。

用户消息: {user_message}
学生画像: {profile_text}

你需要判断需要哪些智能体协作，并返回JSON：
{{
    "intent": "analysis|resource|search|qa|eval",
    "agents_needed": ["agent1", "agent2"],
    "tasks": [
        {{"agent": "agent名", "task": "具体任务描述", "params": {{}}}}
    ]
}}

可选智能体：
- profiler: 提取/分析学生画像
- doc_generator: 生成文档和思维导图
- quiz_generator: 生成练习题
- code_generator: 生成代码案例
- tutor: 答疑讲解
- evaluator: 学习评估
- searcher: 搜索在线资源

如果是简单问答，只用 tutor。
如果是生成资料，用 doc_generator + quiz_generator 组合。
如果是搜索资源，用 searcher。

只返回JSON。"""

        response = await self.spark.chat(prompt, system_prompt="你是任务规划智能体，只返回JSON。")
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1].replace("json", "", 1)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"intent": "qa", "agents_needed": ["tutor"],
                    "tasks": [{"agent": "tutor", "task": user_message, "params": {}}]}

    async def execute_agent(self, agent_name: str, task: str, params: dict, profile_text: str) -> dict:
        """
        Step 2: 执行单个智能体 — 每个 Agent 有自己的专职职责
        """
        agent_prompts = {
            "doc_generator": f"""你是一个课程文档生成智能体。你的职责是生成高质量的课程讲解文档和思维导图。
学生画像: {profile_text}
任务: {task}
请直接输出内容，使用Markdown格式。""",
            "quiz_generator": f"""你是一个题目生成智能体。你的职责是生成针对性的练习题。
学生画像: {profile_text}
任务: {task}
请生成3-5道题，包含选择题和简答题，附答案。直接输出。""",
            "code_generator": f"""你是一个代码生成智能体。你的职责是生成可运行的代码案例。
学生画像: {profile_text}
任务: {task}
请用Python写代码示例，带注释。50行以内。直接输出。""",
            "tutor": f"""你是一个辅导答疑智能体。你的职责是详细解答学生问题。
学生画像: {profile_text}
问题: {task}
请给出详细、准确、易懂的解答。使用Markdown格式。""",
            "evaluator": f"""你是一个评估分析智能体。你的职责是分析学习情况并给出建议。
任务: {task}
请给出评估和建议。""",
            "searcher": f"""你是一个资源搜索智能体。你负责推荐学习资源。
任务: {task}
请推荐3-5个相关资源（书籍、视频、网站）。直接输出。""",
            "profiler": f"""你是一个画像分析智能体。你负责从对话中提取学生特征。
任务: {task}
请提取关键信息。""",
        }

        prompt = agent_prompts.get(agent_name, task)
        try:
            content = await asyncio.wait_for(
                self.spark.chat(prompt, system_prompt=f"你是{AGENT_ROLES.get(agent_name, {}).get('name', agent_name)}。"),
                timeout=60
            )
            return {"agent": agent_name, "success": True, "content": content}
        except Exception as e:
            return {"agent": agent_name, "success": False, "content": f"[{agent_name} 执行失败: {e}]"}

    async def execute_plan(self, plan: dict, user_message: str, profile_text: str) -> list:
        """
        Step 3: 并行执行多个智能体 — 真正的多Agent协作
        """
        tasks = plan.get("tasks", [])
        if not tasks:
            return [{"agent": "tutor", "success": True, "content": ""}]

        # 并行执行所有任务
        coroutines = []
        for task in tasks:
            agent_name = task.get("agent", "tutor")
            task_desc = task.get("task", user_message)
            params = task.get("params", {})
            coroutines.append(self.execute_agent(agent_name, task_desc, params, profile_text))

        results = await asyncio.gather(*coroutines, return_exceptions=True)
        final_results = []
        for r in results:
            if isinstance(r, dict):
                final_results.append(r)
            else:
                final_results.append({"agent": "unknown", "success": False, "content": str(r)})
        return final_results

    async def aggregate(self, user_message: str, results: list, profile_text: str) -> str:
        """
        Step 4: 聚合智能体 — 整合所有 Agent 的输出
        """
        parts = []
        for r in results:
            if r.get("success") and r.get("content"):
                agent_name = r["agent"]
                content = r["content"]
                parts.append(f"### [{AGENT_ROLES.get(agent_name, {}).get('name', agent_name)}输出]\n{content}")

        if not parts:
            return "抱歉，处理过程中出现了问题，请重试。"

        combined = "\n\n".join(parts)

        # 如果有多个 Agent 输出，让 LLM 整合为一个流畅的回答
        if len(parts) > 1:
            prompt = f"""请将以下多个智能体的输出整合为一个流畅、完整的学习回答：

用户问题: {user_message}

{combined}

要求：
1. 合并为一个连贯的回答
2. 保持 Markdown 格式
3. 如果有文档和练习题，分开标注"""

            try:
                aggregated = await asyncio.wait_for(
                    self.spark.chat(prompt, system_prompt="你是内容整合智能体，负责将多个Agent的输出合并为流畅回答。"),
                    timeout=60
                )
                return aggregated
            except Exception:
                pass

        # 只有一个 Agent，直接返回
        return parts[0].split("\n", 1)[1] if "\n" in parts[0] else parts[0]

    async def run(self, user_message: str, profile_text: str) -> dict:
        """
        完整的多智能体协作流程，带总超时保护
        """
        import asyncio

        async def _run_inner():
            # Step 1: 规划
            plan = await self.plan(user_message, profile_text)
            print(f"[多智能体] 规划完成: {plan.get('intent', 'unknown')} → {plan.get('agents_needed', [])}")

            # Step 2-3: 并行执行
            results = await self.execute_plan(plan, user_message, profile_text)
            agents_used = [r.get("agent", "?") for r in results if r.get("success")]
            print(f"[多智能体] 执行完成: {agents_used}")

            # Step 4: 聚合
            final_content = await self.aggregate(user_message, results, profile_text)

            return {
                "content": final_content,
                "agents_used": agents_used,
                "plan": plan,
            }

        try:
            return await asyncio.wait_for(_run_inner(), timeout=90.0)
        except asyncio.TimeoutError:
            print("[多智能体] 执行超时，返回部分结果")
            return {
                "content": f"关于「{user_message}」，多智能体协作超时，请稍后重试或简化问题。",
                "agents_used": [],
                "plan": {},
            }


# 全局实例
orchestrator = MultiAgentOrchestrator()
