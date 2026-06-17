---
id: transformer
topic: Transformer架构
course: 人工智能导论
chapter: 8
---

# Transformer 架构

## 1. 概述

Transformer是一种基于自注意力机制的深度学习架构，由Google于2017年提出。它完全摒弃了RNN的循环结构，通过注意力机制并行处理序列。

## 2. 核心组件

### 自注意力（Self-Attention）
Attention(Q, K, V) = softmax(QKᵀ/√dₖ)V

- Q: Query(查询)
- K: Key(键)  
- V: Value(值)
- dₖ: 缩放因子

### 多头注意力
将注意力分成多个头，每个头关注不同特征子空间，最后拼接。

### 位置编码
由于Transformer没有循环结构，需要通过位置编码注入位置信息。

### 前馈网络
每个注意力层后接一个全连接前馈网络。

## 3. 编码器-解码器

- **编码器**：处理输入序列，提取特征
- **解码器**：生成输出序列，包含掩码注意力

## 4. 影响

Transformer彻底改变了NLP领域，催生了BERT、GPT等模型，并扩展到CV（ViT）等领域。

## 5. 关键要点
1. Transformer是当前最主流的基础架构
2. 自注意力机制是其核心创新
3. 并行计算效率远超RNN
4. 是GPT等大语言模型的底层架构
