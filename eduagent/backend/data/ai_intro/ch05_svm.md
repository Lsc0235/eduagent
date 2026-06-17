---
id: svm
topic: 支持向量机
course: 人工智能导论
chapter: 5
---

# 支持向量机（SVM）

## 1. 概述

支持向量机（Support Vector Machine, SVM）是一种强大的监督学习算法，通过寻找最优超平面对数据进行分类。其核心思想是找到间隔最大的决策边界。

## 2. 核心概念

### 2.1 超平面
在n维空间中，超平面是一个n-1维的子空间。
二维空间中超平面是一条直线，三维空间中超平面是一个平面。

### 2.2 支持向量
距离超平面最近的训练样本点，它们决定了超平面的位置和方向。

### 2.3 间隔（Margin）
超平面到最近支持向量的距离。SVM的目标是最大化间隔。

## 3. 数学模型

### 线性可分SVM
目标：找到 w 和 b，使得：
- y(w·x + b) ≥ 1（所有样本正确分类）
- ||w||/2 最小化（最大化间隔）

### 软间隔SVM
引入松弛变量ξ，允许部分样本被错误分类：
min ||w||²/2 + CΣξi

C 是惩罚参数，控制对误分类的惩罚程度。

### 核函数
将数据映射到高维空间，处理非线性问题：

| 核函数 | 公式 | 适用场景 |
|--------|------|---------|
| 线性核 | K(x,y) = x·y | 线性可分 |
| 多项式核 | K(x,y) = (x·y+c)^d | 非线性 |
| RBF核 | K(x,y) = exp(-γ||x-y||²) | 通用 |

## 4. Python实现

```python
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# 创建SVM分类器（RBF核）
pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('svm', SVC(kernel='rbf', C=1.0, gamma='scale'))
])

pipe.fit(X_train, y_train)
accuracy = pipe.score(X_test, y_test)
print(f"SVM准确率: {accuracy:.4f}")
```

## 5. 关键要点

1. SVM在小样本、高维数据上表现优秀
2. 核函数的选择是关键，RBF核通常效果最好
3. 需要特征缩放
4. 大规模数据上训练较慢
5. SVM是深度学习兴起前最强大的分类算法之一
