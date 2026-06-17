"""
多智能体协作框架
"""
import uuid
from enum import Enum
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


class AgentRole(str, Enum):
    PLANNER = "planner"
    PROFILER = "profiler"
    DOC_GENERATOR = "doc_generator"
    QUIZ_GENERATOR = "quiz_generator"
    EVALUATOR = "evaluator"
    PATH_PLANNER = "path_planner"


class MessageType(str, Enum):
    REQUEST = "request"
    TASK_ASSIGN = "task_assign"
    TASK_COMPLETE = "task_complete"


@dataclass
class AgentMessage:
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    sender: str = ""
    receiver: str = ""
    msg_type: MessageType = MessageType.REQUEST
    content: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class AgentState:
    role: AgentRole
    status: str = "idle"
    current_task: str = ""
    messages_sent: int = 0
    messages_received: int = 0
    results: Dict[str, Any] = field(default_factory=dict)


class MessageBus:
    def __init__(self):
        self.queues: Dict[str, List[AgentMessage]] = {}
        self.log: List[Dict] = []

    def register(self, agent_id: str):
        self.queues[agent_id] = []

    def send(self, message: AgentMessage):
        if message.receiver in self.queues:
            self.queues[message.receiver].append(message)
            self.log.append({"from": message.sender, "to": message.receiver, "type": message.msg_type.value, "content": str(message.content)[:100], "time": message.timestamp})

    def receive(self, agent_id: str):
        if agent_id in self.queues and self.queues[agent_id]:
            return self.queues[agent_id].pop(0)
        return None

    def get_log(self):
        return self.log


class BaseAgent:
    def __init__(self, role: AgentRole, bus: MessageBus):
        self.role = role
        self.state = AgentState(role=role)
        self.bus = bus
        self.bus.register(role.value)

    async def process(self, message: AgentMessage):
        raise NotImplementedError

    async def send(self, receiver: str, msg_type: MessageType, content: Dict):
        msg = AgentMessage(sender=self.role.value, receiver=receiver, msg_type=msg_type, content=content)
        self.bus.send(msg)
        self.state.messages_sent += 1

    def _update_task(self, task: str):
        self.state.status = "working"
        self.state.current_task = task

    def _done(self, key: str, result):
        self.state.status = "done"
        self.state.results[key] = result


class PlannerAgent(BaseAgent):
    async def process(self, message: AgentMessage):
        if message.msg_type == MessageType.TASK_ASSIGN:
            result = self._plan(message.content)
            await self.send(message.sender, MessageType.TASK_COMPLETE, {"task_id": message.id, "result": result})
            return result

    def _plan(self, content):
        self._update_task("规划学习任务")
        topic = content.get("topic", "")
        profile = content.get("profile", {})
        skill = "进阶" if "进阶" in str(profile.get("knowledge_base", "")) else "入门"
        plan = {"topic": topic, "skill_level": skill, "tasks": [{"id": i, "agent": a, "task": t} for i, (a, t) in enumerate([("profiler", "分析画像"), ("doc_generator", "生成文档"), ("quiz_generator", "生成题目"), ("evaluator", "评估效果")], 1)], "estimated_time": "30-45分钟"}
        self._done("plan", plan)
        return plan


class ProfilerAgent(BaseAgent):
    async def process(self, message: AgentMessage):
        if message.msg_type == MessageType.TASK_ASSIGN:
            result = self._analyze(message.content)
            await self.send(message.sender, MessageType.TASK_COMPLETE, {"task_id": message.id, "result": result})
            return result

    def _analyze(self, content):
        self._update_task("分析学生画像")
        profile = content.get("profile", {})
        analysis = {"learning_style": "视觉型", "skill_level": "入门到进阶"}
        kb = profile.get("knowledge_base", {})
        if kb.get("value"):
            analysis["skill_level"] = kb["value"][:50]
        self._done("analysis", analysis)
        return analysis


class DocGeneratorAgent(BaseAgent):
    async def process(self, message: AgentMessage):
        if message.msg_type == MessageType.TASK_ASSIGN:
            result = {"topic": message.content.get("topic", ""), "format": "markdown", "adapted_to": message.content.get("profile_analysis", {}).get("skill_level", "入门")}
            await self.send(message.sender, MessageType.TASK_COMPLETE, {"task_id": message.id, "result": result})
            return result


class QuizGeneratorAgent(BaseAgent):
    async def process(self, message: AgentMessage):
        if message.msg_type == MessageType.TASK_ASSIGN:
            result = {"topic": message.content.get("topic", ""), "question_count": 5, "difficulty": "中等"}
            await self.send(message.sender, MessageType.TASK_COMPLETE, {"task_id": message.id, "result": result})
            return result


class EvaluatorAgent(BaseAgent):
    async def process(self, message: AgentMessage):
        if message.msg_type == MessageType.TASK_ASSIGN:
            qr = message.content.get("quiz_result", {})
            score = qr.get("score", 0)
            wrong = qr.get("wrong_topics", [])
            ev = {"score": score, "level": "优秀" if score >= 90 else "良好" if score >= 80 else "及格" if score >= 60 else "需努力", "weak_points": wrong[:5], "recommendations": ["重新学习基础"] if score < 60 else ["针对薄弱点补强"] if score < 80 else ["进入下一阶段"]}
            await self.send(message.sender, MessageType.TASK_COMPLETE, {"task_id": message.id, "result": ev})
            return ev


class PathPlannerAgent(BaseAgent):
    async def process(self, message: AgentMessage):
        if message.msg_type == MessageType.TASK_ASSIGN:
            score = message.content.get("score", 0)
            path = {"next_steps": [{"action": "重新学习基础", "priority": "high"}] if score < 60 else [{"action": "针对薄弱点补强", "priority": "high"}] if score < 80 else [{"action": "进入下一知识点", "priority": "medium"}]}
            await self.send(message.sender, MessageType.TASK_COMPLETE, {"task_id": message.id, "result": path})
            return path


class MultiAgentOrchestrator:
    def __init__(self):
        self.bus = MessageBus()
        self.agents = {
            "planner": PlannerAgent(AgentRole.PLANNER, self.bus),
            "profiler": ProfilerAgent(AgentRole.PROFILER, self.bus),
            "doc_generator": DocGeneratorAgent(AgentRole.DOC_GENERATOR, self.bus),
            "quiz_generator": QuizGeneratorAgent(AgentRole.QUIZ_GENERATOR, self.bus),
            "evaluator": EvaluatorAgent(AgentRole.EVALUATOR, self.bus),
            "path_planner": PathPlannerAgent(AgentRole.PATH_PLANNER, self.bus),
        }
        self.execution_log = []

    async def execute_learning_flow(self, topic, profile=None):
        self.execution_log = []

        msg = AgentMessage(sender="orchestrator", receiver="planner", msg_type=MessageType.TASK_ASSIGN, content={"task": topic, "topic": topic, "profile": profile or {}})
        self.bus.send(msg)
        plan = await self.agents["planner"].process(msg)
        self.execution_log.append({"agent": "planner", "action": f"规划完成，{len(plan.get('tasks', []))}个子任务"})

        msg = AgentMessage(sender="orchestrator", receiver="profiler", msg_type=MessageType.TASK_ASSIGN, content={"task": "分析画像", "profile": profile or {}})
        self.bus.send(msg)
        pa = await self.agents["profiler"].process(msg)
        self.execution_log.append({"agent": "profiler", "action": "画像分析完成"})

        msg = AgentMessage(sender="orchestrator", receiver="doc_generator", msg_type=MessageType.TASK_ASSIGN, content={"task": "生成文档", "topic": topic, "profile_analysis": pa})
        self.bus.send(msg)
        doc = await self.agents["doc_generator"].process(msg)
        self.execution_log.append({"agent": "doc_generator", "action": "文档生成完成"})

        msg = AgentMessage(sender="orchestrator", receiver="quiz_generator", msg_type=MessageType.TASK_ASSIGN, content={"task": "生成题目", "topic": topic})
        self.bus.send(msg)
        quiz = await self.agents["quiz_generator"].process(msg)
        self.execution_log.append({"agent": "quiz_generator", "action": "题目生成完成"})

        return {"topic": topic, "plan": plan, "profile_analysis": pa, "document": doc, "quiz": quiz, "execution_log": self.execution_log, "agents_used": list(self.agents.keys()), "messages_exchanged": len(self.bus.get_log())}

    async def evaluate_and_adjust(self, quiz_result, profile=None):
        msg = AgentMessage(sender="orchestrator", receiver="evaluator", msg_type=MessageType.TASK_ASSIGN, content={"task": "评估", "quiz_result": quiz_result})
        self.bus.send(msg)
        ev = await self.agents["evaluator"].process(msg)

        msg = AgentMessage(sender="orchestrator", receiver="path_planner", msg_type=MessageType.TASK_ASSIGN, content={"task": "规划路径", "topic": quiz_result.get("topic", ""), "score": ev.get("score", 0)})
        self.bus.send(msg)
        path = await self.agents["path_planner"].process(msg)
        return {"evaluation": ev, "next_path": path}

    def get_agent_states(self):
        return {r: {"status": a.state.status, "current_task": a.state.current_task, "messages_sent": a.state.messages_sent} for r, a in self.agents.items()}

    def get_communication_log(self):
        return self.bus.get_log()


multi_agent_orchestrator = MultiAgentOrchestrator()
