---
id: logistic_regression
topic: 逻辑回归
course: 人工智能导论
chapter: 5
---

# 逻辑回归

## 1. 概述

逻辑回归虽然名字叫"回归"，但本质是分类算法。它用 Sigmoid 函数将线性输出映射到 (0,1) 区间，表示概率。

## 2. 数学模型

p(y=1|x) = 1/(1+e⁻⁽ʷˣ⁺ᵇ⁾)

- w: 权重
- b: 偏置
- 输出：样本属于正类的概率

## 3. 决策边界

当 p ≥ 0.5 时预测为正类，即 w·x+b ≥ 0。

## 4. 损失函数

交叉熵损失（对数损失）：
L = -[y·log(p) + (1-y)·log(1-p)]

## 5. 优缺点

### 优点
- 简单快速，可解释性强
- 能直接输出概率
- 是理解神经网络分类器的基础

### 缺点
- 只能处理线性可分问题
- 对异常值敏感

## 6. Python示例

```python
from sklearn.linear_model import LogisticRegression

clf = LogisticRegression()
clf.fit(X_train, y_train)
pred = clf.predict(X_test)
proba = clf.predict_proba(X_test)
```

## 7. 关键要点
1. 逻辑回归是二分类的基准模型
2. 输出的是概率值，不是硬分类
3. 是神经网络单层分类器的理论基础
