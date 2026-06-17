"""
知识点依赖图 — 动态学习路径调整
基于DAG（有向无环图）实现知识点前置关系管理
"""
from typing import Dict, List, Set, Optional
from collections import defaultdict, deque


# ─── 知识点依赖图定义 ───

KNOWLEDGE_DEPENDENCIES = {
    # 基础知识
    "线性代数基础": {"prerequisites": [], "category": "数学基础"},
    "概率论基础": {"prerequisites": [], "category": "数学基础"},
    "Python编程基础": {"prerequisites": [], "category": "编程基础"},

    # 机器学习基础
    "机器学习概述": {"prerequisites": ["线性代数基础", "概率论基础"], "category": "机器学习"},
    "线性回归": {"prerequisites": ["机器学习概述"], "category": "机器学习"},
    "逻辑回归": {"prerequisites": ["线性回归"], "category": "机器学习"},
    "决策树": {"prerequisites": ["机器学习概述"], "category": "机器学习"},
    "随机森林": {"prerequisites": ["决策树"], "category": "机器学习"},
    "SVM": {"prerequisites": ["线性代数基础", "机器学习概述"], "category": "机器学习"},
    "聚类": {"prerequisites": ["机器学习概述"], "category": "机器学习"},
    "降维": {"prerequisites": ["线性代数基础"], "category": "机器学习"},

    # 深度学习基础
    "神经网络基础": {"prerequisites": ["线性回归", "Python编程基础"], "category": "深度学习"},
    "反向传播": {"prerequisites": ["神经网络基础", "微积分"], "category": "深度学习"},
    "激活函数": {"prerequisites": ["神经网络基础"], "category": "深度学习"},
    "损失函数": {"prerequisites": ["神经网络基础"], "category": "深度学习"},
    "优化算法": {"prerequisites": ["微积分", "线性代数基础"], "category": "深度学习"},
    "过拟合与正则化": {"prerequisites": ["神经网络基础"], "category": "深度学习"},

    # CNN
    "卷积神经网络": {"prerequisites": ["神经网络基础", "反向传播"], "category": "计算机视觉"},
    "图像分类": {"prerequisites": ["卷积神经网络"], "category": "计算机视觉"},

    # RNN
    "循环神经网络": {"prerequisites": ["神经网络基础", "反向传播"], "category": "自然语言处理"},
    "LSTM": {"prerequisites": ["循环神经网络"], "category": "自然语言处理"},
    "Transformer": {"prerequisites": ["循环神经网络", "注意力机制"], "category": "自然语言处理"},

    # 其他
    "微积分": {"prerequisites": [], "category": "数学基础"},
    "注意力机制": {"prerequisites": ["神经网络基础"], "category": "深度学习"},
    "迁移学习": {"prerequisites": ["卷积神经网络", "循环神经网络"], "category": "深度学习"},
    "数据增强": {"prerequisites": ["卷积神经网络"], "category": "计算机视觉"},
}


class KnowledgeGraph:
    """知识点依赖图"""

    def __init__(self):
        self.graph = KNOWLEDGE_DEPENDENCIES
        self._build_reverse_graph()

    def _build_reverse_graph(self):
        """构建反向图（谁依赖我）"""
        self.reverse_graph = defaultdict(list)
        for node, info in self.graph.items():
            for prereq in info["prerequisites"]:
                self.reverse_graph[prereq].append(node)

    def get_prerequisites(self, topic: str) -> List[str]:
        """获取前置知识点"""
        # 尝试模糊匹配
        matched = self._fuzzy_match(topic)
        if matched:
            return self.graph[matched]["prerequisites"]
        return []

    def get_dependents(self, topic: str) -> List[str]:
        """获取后续知识点"""
        matched = self._fuzzy_match(topic)
        if matched:
            return self.reverse_graph.get(matched, [])
        return []

    def _fuzzy_match(self, topic: str) -> Optional[str]:
        """模糊匹配知识点"""
        topic_lower = topic.lower()
        for node in self.graph:
            if topic_lower in node.lower() or node.lower() in topic_lower:
                return node
        return None

    def find_learning_path(self, topic: str, mastered: Set[str] = None) -> List[Dict]:
        """为指定主题规划学习路径"""
        if mastered is None:
            mastered = set()

        matched = self._fuzzy_match(topic)
        if not matched:
            return [{"topic": topic, "status": "new", "reason": "直接学习该主题"}]

        # BFS找所有前置依赖
        needed = []
        visited = set()
        queue = deque([matched])

        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            visited.add(current)

            if current in mastered:
                continue  # 已掌握，跳过

            # 检查前置是否都满足
            prereqs = self.graph[current]["prerequisites"]
            all_prereqs_met = all(p in mastered for p in prereqs)

            if all_prereqs_met or not prereqs:
                needed.append({
                    "topic": current,
                    "category": self.graph[current]["category"],
                    "status": "ready" if current != matched else "target",
                    "reason": "前置已掌握" if current != matched else "学习目标",
                })
            else:
                # 前置未满足，加入前置
                for p in prereqs:
                    if p not in mastered:
                        queue.append(p)

        return needed

    def analyze_weak_points(self, wrong_topics: List[str]) -> Dict:
        """分析薄弱知识点及影响范围"""
        weak_analysis = {}

        for topic in wrong_topics:
            matched = self._fuzzy_match(topic)
            if matched:
                # 找到受影响的后续知识点
                affected = self.get_dependents(matched)
                weak_analysis[topic] = {
                    "matched_knowledge_point": matched,
                    "affected_topics": affected[:3],  # 最多3个受影响的后续
                    "suggestion": f"建议先巩固「{matched}」，否则会影响后续学习",
                }

        return weak_analysis


# 全局实例
knowledge_graph = KnowledgeGraph()
