"""
RAG 检索增强生成 — TF-IDF向量检索 + 关键词语义混合 + 防幻觉
无需额外依赖，纯Python + numpy实现
"""
import re
import math
from typing import List, Dict, Tuple
from collections import Counter
import numpy as np

kb_documents: List[dict] = []

# ─── 中文分词（简单版，无需jieba） ───

def simple_tokenize(text: str) -> List[str]:
    """简单中文分词：按标点、空格切分，再按2-4字切片"""
    # 先按标点和空格切分
    tokens = re.split(r'[\s，,。.：:；;！!？?、\-\+\(\)（）\[\]【】《》""\'\'\"\"/\\]+', text)
    result = []
    for token in tokens:
        token = token.strip()
        if not token:
            continue
        # 英文单词直接保留
        if re.match(r'^[a-zA-Z0-9_]+$', token):
            result.append(token.lower())
            continue
        # 中文：按2-4字切片
        for size in [2, 3, 4]:
            for i in range(len(token) - size + 1):
                result.append(token[i:i+size])
        # 也保留整词（如果不太长）
        if len(token) <= 8:
            result.append(token)
    return result


# ─── TF-IDF 向量化 ───

class TFIDFVectorizer:
    """轻量TF-IDF向量器"""

    def __init__(self):
        self.vocab: Dict[str, int] = {}
        self.idf: np.ndarray = None

    def fit(self, documents: List[str]):
        """训练词表和IDF"""
        n_docs = len(documents)
        doc_freq = Counter()

        all_tokens = []
        for doc in documents:
            tokens = simple_tokenize(doc)
            all_tokens.append(tokens)
            unique_tokens = set(tokens)
            for t in unique_tokens:
                doc_freq[t] += 1

        # 取出现频率较高的词作为词表
        min_df = max(1, n_docs // 5)
        vocab_list = [t for t, c in doc_freq.items() if c >= min_df]
        # 如果词表太小，放宽条件
        if len(vocab_list) < 50:
            vocab_list = [t for t, c in doc_freq.most_common(200)]

        self.vocab = {t: i for i, t in enumerate(vocab_list)}
        self.idf = np.zeros(len(vocab_list))
        for i, t in enumerate(vocab_list):
            self.idf[i] = math.log((n_docs + 1) / (doc_freq.get(t, 0) + 1)) + 1

    def transform(self, text: str) -> np.ndarray:
        """将文本转为TF-IDF向量"""
        tokens = simple_tokenize(text)
        tf = Counter(tokens)
        vec = np.zeros(len(self.vocab))
        total = max(len(tokens), 1)
        for t, count in tf.items():
            if t in self.vocab:
                idx = self.vocab[t]
                vec[idx] = (count / total) * self.idf[idx]
        # L2归一化
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec


# ─── 向量检索引擎 ───

class VectorRAGEngine:
    """基于TF-IDF的RAG检索引擎"""

    def __init__(self):
        self.vectorizer = TFIDFVectorizer()
        self.doc_vectors: np.ndarray = None
        self.doc_contents: List[str] = []
        self.doc_sources: List[str] = []
        self._built = False

    def build_index(self, documents: List[dict]):
        """构建索引"""
        if not documents:
            return

        self.doc_contents = [d.get("content", "") for d in documents]
        self.doc_sources = [d.get("source", "") for d in documents]

        # 训练词表
        self.vectorizer.fit(self.doc_contents)

        # 向量化所有文档
        vectors = []
        for content in self.doc_contents:
            v = self.vectorizer.transform(content)
            vectors.append(v)
        self.doc_vectors = np.array(vectors)
        self._built = True
        print(f"[VectorRAG] 索引构建完成: {len(documents)}个文档, 词表大小{len(self.vectorizer.vocab)}")

    def retrieve(self, query: str, top_k: int = 3) -> List[dict]:
        """向量检索"""
        if not self._built or self.doc_vectors is None or len(self.doc_vectors) == 0:
            return []

        query_vec = self.vectorizer.transform(query)

        # 计算余弦相似度
        similarities = np.dot(self.doc_vectors, query_vec)

        # 取top_k
        top_indices = np.argsort(similarities)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score > 0.01:  # 最低阈值
                results.append({
                    "source": self.doc_sources[idx],
                    "content": self.doc_contents[idx],
                    "score": score,
                })
        return results

    def format_context(self, docs: List[dict]) -> str:
        """格式化检索结果"""
        if not docs:
            return ""
        parts = []
        for doc in docs:
            source = doc.get("source", "未知")
            content = doc.get("content", "")[:800]
            score = doc.get("score", 0)
            parts.append(f"[来源: {source} | 相关度: {score:.2f}]\n{content}")
        return "\n\n---\n\n".join(parts)


# ─── 全局实例 ───

vector_rag = VectorRAGEngine()

# 兼容旧接口
class RAGEngine:
    def retrieve(self, query: str, top_k: int = 3) -> List[dict]:
        return vector_rag.retrieve(query, top_k)

    def format_context(self, docs: List[dict]) -> str:
        return vector_rag.format_context(docs)

rag_engine = RAGEngine()


# ─── 关键词语义补充（兼容旧代码） ───

def _keyword_score(query: str, content: str) -> float:
    """关键词匹配得分"""
    query_lower = query.lower()
    content_lower = content.lower()
    words = re.split(r'[\s，,。.：:；;！!？?、\-\+]+', query)
    score = 0
    for w in words:
        if len(w) >= 2 and w in content_lower:
            score += content_lower.count(w) * 0.5
    if query_lower in content_lower:
        score += 3
    return score


def _semantic_score(query: str, content: str) -> float:
    """语义匹配得分"""
    synonyms = {
        '神经网络': ['神经网络', '反向传播', '激活函数', '深度学习', '感知机', '神经元'],
        '过拟合': ['过拟合', '欠拟合', '正则化', '泛化', '偏差', '方差', '验证集', '早停'],
        '机器学习': ['机器学习', '监督学习', '无监督学习', '分类', '回归', '聚类'],
        '决策树': ['决策树', '随机森林', '信息增益', '基尼指数', 'CART', '剪枝'],
        '线性回归': ['线性回归', '最小二乘', '梯度下降', '损失函数', '均方误差'],
        'SVM': ['SVM', '支持向量机', '核函数', '超平面', '间隔'],
        '深度学习': ['深度学习', 'CNN', 'RNN', 'Transformer', 'LSTM', '残差网络'],
    }
    matched = set()
    for concept, syns in synonyms.items():
        if concept in query and any(s in content for s in syns):
            matched.add(concept)
    return len(matched) * 2
