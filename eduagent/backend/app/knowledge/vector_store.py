"""
向量数据库管理 — ChromaDB
"""
import os
from typing import List, Optional
from app.config import get_settings


class VectorStore:
    """向量数据库封装"""

    def __init__(self):
        self.settings = get_settings()
        self._client = None
        self._collection = None

    @property
    def client(self):
        if self._client is None:
            import chromadb
            self._client = chromadb.PersistentClient(
                path=self.settings.chroma_persist_dir
            )
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name="knowledge_base",
                metadata={"hnsw:space": "cosine"}
            )
        return self._collection

    def add_documents(self, documents: List[dict]):
        """添加文档到向量数据库"""
        ids = [doc["id"] for doc in documents]
        texts = [doc["content"] for doc in documents]
        metadatas = [doc.get("metadata", {}) for doc in documents]

        self.collection.add(
            ids=ids,
            documents=texts,
            metadatas=metadatas
        )

    def search(self, query: str, top_k: int = 5, filter_metadata: dict = None) -> List[dict]:
        """搜索相关文档"""
        kwargs = {
            "query_texts": [query],
            "n_results": top_k,
        }
        if filter_metadata:
            kwargs["where"] = filter_metadata

        results = self.collection.query(**kwargs)

        documents = []
        if results and results["documents"]:
            for i, doc in enumerate(results["documents"][0]):
                documents.append({
                    "content": doc,
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0,
                })

        return documents

    def get_count(self) -> int:
        """获取文档数量"""
        return self.collection.count()

    def delete_all(self):
        """清空所有文档"""
        self.client.delete_collection("knowledge_base")
        self._collection = None
