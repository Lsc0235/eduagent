---
id: rnn_lstm
topic: RNN与LSTM
course: 人工智能导论
chapter: 8
---

# 循环神经网络与LSTM

## 1. 概述

循环神经网络（RNN）处理序列数据，通过隐藏状态传递时序信息。LSTM通过门控机制解决长期依赖问题。

## 2. RNN结构

当前隐藏状态：hₜ = f(Wₕhₜ₋₁ + Wₓxₜ + b)
- 每个时间步共享参数
- 适合处理文本、时间序列等序列数据

## 3. RNN的问题

- **梯度消失**：长期依赖时梯度指数衰减
- **梯度爆炸**：梯度指数增长

## 4. LSTM（长短期记忆网络）

三个门控机制：
- **遗忘门**：决定丢弃哪些旧信息
- **输入门**：决定存储哪些新信息
- **输出门**：决定输出哪些信息

## 5. GRU

LSTM的简化版，合并遗忘门和输入门为更新门，参数更少。

## 6. Python示例

```python
import torch.nn as nn

lstm = nn.LSTM(input_size=10, hidden_size=20,
               num_layers=2, batch_first=True)
# input shape: (batch, seq_len, input_size)
output, (hn, cn) = lstm(input_data)
```

## 7. 关键要点
1. RNN适合处理序列数据
2. LSTM通过门控机制解决长期依赖
3. Transformer已逐步替代RNN成为主流
4. 理解RNN有助于理解注意力机制
