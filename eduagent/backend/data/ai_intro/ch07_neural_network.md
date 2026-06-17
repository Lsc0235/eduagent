---
id: neural_network
topic: 神经网络
course: 人工智能导论
chapter: 7
---

# 神经网络

## 1. 概述

人工神经网络（Artificial Neural Network, ANN）是一种受生物神经系统启发的计算模型，由大量相互连接的节点（神经元）组成，能够通过学习数据中的模式来完成各种任务。

## 2. 感知机模型

### 2.1 单层感知机

最简单的神经网络，只有一个输出节点：

**y = f(Σwᵢxᵢ + b)**

其中 f 是激活函数（如阶跃函数）。

单层感知机只能解决线性可分问题（如 AND、OR 逻辑），无法解决 XOR 问题。

### 2.2 多层感知机（MLP）

通过引入隐藏层，多层感知机可以解决非线性问题：

```
输入层 → 隐藏层1 → 隐藏层2 → ... → 输出层
```

## 3. 反向传播算法（Backpropagation）

反向传播是训练神经网络的核心算法，通过链式法则计算损失函数对每个参数的梯度。

### 3.1 前向传播

输入数据从输入层逐层传递到输出层，计算预测值。

### 3.2 反向传播

从输出层开始，逐层计算梯度，更新权重：

**∂L/∂w = ∂L/∂y · ∂y/∂z · ∂z/∂w**

其中 L 是损失，y 是输出，z 是加权和。

## 4. 激活函数

### 4.1 Sigmoid
- 公式：σ(x) = 1/(1+e⁻ˣ)
- 范围：(0, 1)
- 问题：梯度消失

### 4.2 Tanh
- 公式：tanh(x) = (eˣ-e⁻ˣ)/(eˣ+e⁻ˣ)
- 范围：(-1, 1)
- 比 Sigmoid 好，仍有梯度消失问题

### 4.3 ReLU
- 公式：f(x) = max(0, x)
- 优点：计算简单，缓解梯度消失
- 问题：神经元死亡（Dead ReLU）

### 4.4 Leaky ReLU
- 公式：f(x) = max(0.01x, x)
- 解决 Dead ReLU 问题

## 5. 优化器

- **SGD**：随机梯度下降
- **Momentum**：引入动量加速收敛
- **Adam**：自适应学习率，最常用
- **RMSprop**：自适应学习率

## 6. 正则化

- **Dropout**：随机丢弃部分神经元
- **L1/L2 正则化**：在损失函数中添加惩罚项
- **Early Stopping**：提前停止训练
- **数据增强**：扩充训练数据

## 7. Python 实现

```python
import torch
import torch.nn as nn
import torch.optim as optim

class SimpleNN(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super().__init__()
        self.layer1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.layer2 = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        x = self.layer1(x)
        x = self.relu(x)
        x = self.layer2(x)
        return x

# 创建模型
model = SimpleNN(10, 64, 1)
criterion = nn.MSELoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)
```

## 8. 关键要点

1. 神经网络的核心是通过反向传播学习权重
2. 激活函数引入非线性，使网络能够拟合复杂函数
3. ReLU 是目前最常用的激活函数
4. 正则化技术是防止过拟合的关键
5. 深度网络比宽度网络更有效（深层网络的表达能力更强）
