---
id: activation_functions
topic: 激活函数
course: 人工智能导论
chapter: 7
---

# 激活函数

## 1. 概述

激活函数为神经网络引入非线性能力，使网络能够学习复杂的数据模式。

## 2. 常见激活函数

### Sigmoid
σ(x) = 1/(1+e⁻ˣ)
- 输出范围：(0, 1)
- 缺点：梯度消失、输出非零中心

### Tanh
tanh(x) = (eˣ-e⁻ˣ)/(eˣ+e⁻ˣ)
- 输出范围：(-1, 1)
- 比Sigmoid好，仍有梯度消失问题

### ReLU
f(x) = max(0, x)
- 计算简单，缓解梯度消失
- 缺点：Dead ReLU（负半区梯度为0）

### Leaky ReLU
f(x) = max(0.01x, x)
- 解决Dead ReLU问题
- 负半区保留小梯度

### Softmax
将输出转换为概率分布，用于多分类。

## 3. 选型建议
- 隐藏层默认用 ReLU
- 遇到 Dead ReLU 时改用 Leaky ReLU
- 二分类输出用 Sigmoid
- 多分类输出用 Softmax

## 4. 关键要点
1. 没有激活函数的多层网络等价于单层线性模型
2. ReLU 是目前最常用的激活函数
3. 激活函数的非线性是深度学习的关键
