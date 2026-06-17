"""
知识库构建脚本 — 将课程文档向量化存入 ChromaDB
运行方式: python build_knowledge_base.py
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

import json
from pathlib import Path


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """将长文本切分为小块"""
    chunks = []
    lines = text.split("\n")
    current_chunk = []
    current_len = 0

    for line in lines:
        current_chunk.append(line)
        current_len += len(line)
        if current_len >= chunk_size:
            chunks.append("\n".join(current_chunk))
            # 保留最后几行作为重叠
            current_chunk = current_chunk[-3:]
            current_len = sum(len(l) for l in current_chunk)

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return [c.strip() for c in chunks if c.strip()]


def build():
    """构建知识库"""
    from app.knowledge.vector_store import VectorStore

    store = VectorStore()
    kb_dir = Path("./data/ai_intro")

    # 清空旧数据
    store.delete_all()
    print("🗑️ 已清空旧知识库")

    # 读取所有 markdown 文件
    all_docs = []
    for md_file in kb_dir.glob("*.md"):
        content = md_file.read_text(encoding="utf-8")
        chunks = chunk_text(content, chunk_size=400, overlap=50)

        for i, chunk in enumerate(chunks):
            # 提取 frontmatter 信息
            metadata = {"source": md_file.name, "chunk_index": i}
            if "---" in chunk:
                parts = chunk.split("---")
                if len(parts) >= 3:
                    metadata["frontmatter"] = parts[1].strip()
                    chunk = "---".join(parts[2:]).strip()

            all_docs.append({
                "id": f"{md_file.stem}_chunk_{i}",
                "content": chunk,
                "metadata": metadata,
            })

    # 存入向量数据库
    if all_docs:
        store.add_documents(all_docs)
        print(f"✅ 知识库构建完成: {len(all_docs)} 个文档块")
        print(f"   来自 {len(list(kb_dir.glob('*.md')))} 个文件")
        print(f"   向量数据库文档数: {store.get_count()}")
    else:
        print("⚠️ 没有找到知识库文档")


if __name__ == "__main__":
    build()
