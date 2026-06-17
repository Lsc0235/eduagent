"""
路径规划智能体 — 个性化学习路径规划（增强版：支持动态调整）
"""
import json
import uuid
from typing import AsyncGenerator, List, Dict
from app.agents.base import BaseAgent, AgentRole, AgentMessage, AgentResponse
from app.llm.spark_client import SparkClient
from app.llm.prompts import PromptTemplates


class PathPlannerAgent(BaseAgent):
    """路径规划智能体 — 基于知识图谱和画像规划学习路径，支持动态调整"""

    def __init__(self):
        super().__init__(
            agent_id="path_planner",
            role=AgentRole.PATH_PLANNER,
            name="路径规划智能体"
        )
        self.spark = SparkClient()
        
        # 路径调整规则
        self.ADJUSTMENT_RULES = {
            "weak_threshold": 60,      # 低于60分判定为薄弱知识点
            "consecutive_fail": 3,     # 连续3次不合格触发路径调整
            "mastery_threshold": 85,   # 85分以上可跳过已掌握内容
            "reinforcement_count": 2,  # 薄弱知识点补强资源数量
        }

    async def process(self, message: AgentMessage) -> AgentResponse:
        task = message.content.get("task", "")
        profile = message.context.get("profile", {})
        current_progress = message.context.get("learning_progress", {})
        evaluation_data = message.context.get("evaluation_data", {})
        
        # 获取课程知识图谱
        knowledge_graph = await self._get_knowledge_graph()
        
        # 根据任务类型选择处理方式
        if task == "adjust_path":
            # 动态调整路径
            adjusted_path = await self._adjust_path_based_on_performance(
                profile, current_progress, evaluation_data, knowledge_graph
            )
            return self._create_response(True, {
                "path": adjusted_path,
                "adjustments": adjusted_path.get("adjustments", []),
                "summary": adjusted_path.get("adjustment_summary", "路径已根据学习表现调整")
            })
        else:
            # 初始路径规划
            prompt = PromptTemplates.PATH_PLANNING.format(
                knowledge_graph=json.dumps(knowledge_graph, ensure_ascii=False),
                student_profile=json.dumps(profile, ensure_ascii=False),
                current_progress=json.dumps(current_progress, ensure_ascii=False)
            )

            result = await self.spark.chat(prompt, PromptTemplates.SYSTEM_BASE)
            parsed = self._parse_path(result)

            return self._create_response(True, {"path": parsed})

    async def process_stream(self, message: AgentMessage) -> AsyncGenerator[str, None]:
        result = await self.process(message)
        yield json.dumps(result.content, ensure_ascii=False)

    async def _adjust_path_based_on_performance(
        self, 
        profile: dict, 
        current_progress: dict, 
        evaluation_data: dict,
        knowledge_graph: dict
    ) -> dict:
        """根据学习表现动态调整路径"""
        
        adjustments = []
        weak_points = evaluation_data.get("weak_points", [])
        recent_scores = evaluation_data.get("recent_scores", {})
        
        # 1. 识别薄弱知识点
        weak_topics = []
        for topic_id, score in recent_scores.items():
            if score < self.ADJUSTMENT_RULES["weak_threshold"]:
                weak_topics.append({
                    "topic_id": topic_id,
                    "score": score,
                    "severity": "high" if score < 40 else "medium"
                })
        
        # 2. 检查连续失败的知识点
        consecutive_failures = evaluation_data.get("consecutive_failures", {})
        for topic_id, fail_count in consecutive_failures.items():
            if fail_count >= self.ADJUSTMENT_RULES["consecutive_fail"]:
                adjustments.append({
                    "type": "insert_reinforcement",
                    "topic_id": topic_id,
                    "reason": f"连续{fail_count}次不合格，需要加强练习",
                    "priority": "high",
                    "resources": await self._generate_reinforcement_resources(topic_id)
                })
        
        # 3. 检查已掌握的内容（可跳过）
        mastered_topics = []
        for topic_id, score in recent_scores.items():
            if score >= self.ADJUSTMENT_RULES["mastery_threshold"]:
                mastered_topics.append(topic_id)
                adjustments.append({
                    "type": "skip_topic",
                    "topic_id": topic_id,
                    "reason": f"已掌握（{score}分），可跳过或快速浏览",
                    "priority": "low"
                })
        
        # 4. 根据学习效率调整内容密度
        learning_efficiency = evaluation_data.get("learning_efficiency", 50)
        if learning_efficiency < 40:
            adjustments.append({
                "type": "reduce_density",
                "reason": "学习效率较低，建议减少每日学习内容量",
                "suggestion": "将每个知识点拆分为更小的学习单元"
            })
        elif learning_efficiency > 80:
            adjustments.append({
                "type": "increase_density",
                "reason": "学习效率较高，可适当增加学习内容",
                "suggestion": "可同时学习多个相关知识点"
            })
        
        # 5. 生成调整后的路径
        adjusted_path = {
            "course": knowledge_graph["course"],
            "adjustments": adjustments,
            "adjustment_summary": self._generate_adjustment_summary(adjustments, weak_topics),
            "next_focus": weak_topics[0]["topic_id"] if weak_topics else "继续当前路径",
            "reinforcement_needed": len([a for a in adjustments if a["type"] == "insert_reinforcement"]),
            "skipable_count": len([a for a in adjustments if a["type"] == "skip_topic"]),
        }
        
        return adjusted_path

    async def _generate_reinforcement_resources(self, topic_id: str) -> List[dict]:
        """为薄弱知识点生成补强资源"""
        # 从知识图谱获取知识点信息
        knowledge_graph = await self._get_knowledge_graph()
        topic_info = next((t for t in knowledge_graph["topics"] if t["id"] == topic_id), None)
        
        if not topic_info:
            return []
        
        topic_name = topic_info["name"]
        
        # 调用资源生成智能体生成补强资源
        reinforcement_resources = [
            {
                "type": "quiz",
                "title": f"{topic_name} - 强化练习",
                "description": f"针对{topic_name}的专项练习题",
                "count": 5
            },
            {
                "type": "document",
                "title": f"{topic_name} - 重点回顾",
                "description": f"{topic_name}的核心知识点梳理",
            },
            {
                "type": "reading",
                "title": f"{topic_name} - 补充材料",
                "description": f"{topic_name}的深入学习资料",
            }
        ]
        
        return reinforcement_resources

    def _generate_adjustment_summary(self, adjustments: List[dict], weak_topics: List[dict]) -> str:
        """生成调整摘要"""
        summary_parts = []
        
        if weak_topics:
            weak_names = [w["topic_id"] for w in weak_topics[:3]]
            summary_parts.append(f"发现{len(weak_topics)}个薄弱知识点：{', '.join(weak_names)}")
        
        reinforcement_count = len([a for a in adjustments if a["type"] == "insert_reinforcement"])
        if reinforcement_count:
            summary_parts.append(f"已插入{reinforcement_count}组补强资源")
        
        skip_count = len([a for a in adjustments if a["type"] == "skip_topic"])
        if skip_count:
            summary_parts.append(f"可跳过{skip_count}个已掌握内容")
        
        if not summary_parts:
            return "当前学习进度良好，无需调整"
        
        return "；".join(summary_parts)

    async def _get_knowledge_graph(self) -> dict:
        """获取课程知识图谱"""
        return {
            "course": "人工智能导论",
            "topics": [
                {"id": "ai_overview", "name": "人工智能概述", "level": 1, "prerequisites": []},
                {"id": "search", "name": "搜索算法", "level": 2, "prerequisites": ["ai_overview"]},
                {"id": "knowledge_rep", "name": "知识表示", "level": 2, "prerequisites": ["ai_overview"]},
                {"id": "ml_basics", "name": "机器学习基础", "level": 2, "prerequisites": ["ai_overview"]},
                {"id": "supervised", "name": "监督学习", "level": 3, "prerequisites": ["ml_basics"]},
                {"id": "unsupervised", "name": "无监督学习", "level": 3, "prerequisites": ["ml_basics"]},
                {"id": "neural_network", "name": "神经网络", "level": 3, "prerequisites": ["supervised"]},
                {"id": "deep_learning", "name": "深度学习", "level": 4, "prerequisites": ["neural_network"]},
                {"id": "cnn", "name": "卷积神经网络", "level": 4, "prerequisites": ["deep_learning"]},
                {"id": "rnn", "name": "循环神经网络", "level": 4, "prerequisites": ["deep_learning"]},
                {"id": "nlp", "name": "自然语言处理", "level": 5, "prerequisites": ["rnn"]},
                {"id": "cv", "name": "计算机视觉", "level": 5, "prerequisites": ["cnn"]},
                {"id": "rl", "name": "强化学习", "level": 5, "prerequisites": ["neural_network"]},
            ]
        }

    def _parse_path(self, response: str) -> dict:
        try:
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
            return json.loads(response)
        except json.JSONDecodeError:
            return {"error": "路径解析失败", "raw": response}
