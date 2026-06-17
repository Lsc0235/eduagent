---
id: linear_regression
topic: 线性回归
course: 人工智能导论
chapter: 5
---

# 线性回归

## 1. 概述

线性回归（Linear Regression）是最基本的机器学习算法之一，用于建立自变量和因变量之间的线性关系模型。它是监督学习中回归问题的基础方法。

## 2. 数学模型

### 2.1 一元线性回归

模型公式：**y = wx + b**

其中：
- y 是预测值（因变量）
- x 是输入特征（自变量）
- w 是权重（斜率）
- b 是偏置（截距）

### 2.2 多元线性回归

模型公式：**y = w₁x₁ + w₂x₂ + ... + wₙxₙ + b**

矩阵形式：**y = Xw + b**

其中 X 是特征矩阵，w 是权重向量。

## 3. 损失函数

均方误差（MSE）：

**MSE = (1/n) Σ(yᵢ - ŷᵢ)²**

其中 n 是样本数量，yᵢ 是真实值，ŷᵢ 是预测值。

## 4. 求解方法

### 4.1 最小二乘法（正规方程）

**w = (XᵀX)⁻¹Xᵀy**

优点：直接求解，无需迭代
缺点：当特征维度很高时计算复杂度大

### 4.2 梯度下降法

权重更新公式：
**w = w - α · ∂MSE/∂w**

其中 α 是学习率。

梯度下降的变体：
- **批量梯度下降（BGD）**：使用全部样本计算梯度
- **随机梯度下降（SGD）**：每次使用一个样本
- **小批量梯度下降（Mini-batch GD）**：每次使用一小批样本

## 5. 模型评估

常用指标：
- **R²（决定系数）**：越接近1越好
- **MSE（均方误差）**：越小越好
- **MAE（平均绝对误差）**：越小越好

## 6. 正则化

为防止过拟合，可添加正则化项：

- **L2 正则化（Ridge）**：损失 + λΣwᵢ²
- **L1 正则化（Lasso）**：损失 + λΣ|wᵢ|

## 7. Python 实现示例

```python
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# 生成示例数据
np.random.seed(42)
X = np.random.randn(100, 3)
y = 3 * X[:, 0] + 2 * X[:, 1] - 1.5 * X[:, 2] + np.random.randn(100) * 0.5

# 划分训练集和测试集
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# 训练模型
model = LinearRegression()
model.fit(X_train, y_train)

# 预测
y_pred = model.predict(X_test)

# 评估
print(f"权重: {model.coef_}")
print(f"偏置: {model.intercept_:.4f}")
print(f"R²: {r2_score(y_test, y_pred):.4f}")
print(f"MSE: {mean_squared_error(y_test, y_pred):.4f}")
```

## 8. 关键要点

1. 线性回归假设特征与目标之间存在线性关系
2. 最小二乘法在特征维度不高时是最常用的求解方法
3. 梯度下降法适合大规模数据集
4. 正则化可以有效防止过拟合
5. 线性回归是很多复杂模型的基础（如神经网络中的单个神经元）
