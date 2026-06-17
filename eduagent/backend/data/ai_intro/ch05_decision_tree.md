---
id: decision_tree
topic: 决策树
course: 人工智能导论
chapter: 5
---

# 决策树

## 1. 概述

决策树是一种常用的监督学习算法，通过树形结构对数据进行分类或回归。它模拟人类的决策过程，每个内部节点表示一个属性判断，每个分支表示一个判断结果，每个叶子节点表示一个分类结果。

## 2. 核心概念

### 2.1 树结构
- **根节点**：包含所有数据的第一个划分特征
- **内部节点**：对应特征的判断条件
- **叶子节点**：最终的分类/回归结果
- **分支**：判断条件的输出

### 2.2 划分标准

#### 信息增益（ID3算法）
信息熵：H(D) = -Σpk * log2(pk)

信息增益：g(D,A) = H(D) - H(D|A)

选择信息增益最大的特征进行划分。

#### 信息增益比（C4.5算法）
解决信息增益偏向取值多的特征的问题。

#### 基尼指数（CART算法）
Gini(D) = 1 - Σpk²

选择基尼指数最小的特征和切分点。

## 3. 算法流程

1. 从训练数据的根节点开始
2. 对每个特征计算划分标准
3. 选择最优特征进行划分
4. 对每个子节点递归执行
5. 直到满足停止条件（节点纯度高、深度限制等）

## 4. 剪枝

### 预剪枝
在划分前就判断是否继续，限制树的深度、叶子节点数等。

### 后剪枝
先生成完整的树，再从底部向上剪掉不必要的分支。

## 5. 优缺点

### 优点
- 模型可解释性强
- 不需要特征缩放
- 可以处理数值型和类别型特征

### 缺点
- 容易过拟合
- 对数据的微小变化敏感（不稳定）
- 不擅长处理线性关系

## 6. Python实现示例

```python
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.datasets import load_iris

# 加载数据
iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(iris.data, iris.target)

# 创建决策树
clf = DecisionTreeClassifier(max_depth=3, random_state=42)
clf.fit(X_train, y_train)

# 评估
accuracy = clf.score(X_test, y_test)
print(f"准确率: {accuracy:.4f}")
print(f"特征重要性: {clf.feature_importances_}")
```

## 7. 关键要点

1. 决策树是随机森林和XGBoost等集成方法的基础
2. 剪枝是防止过拟合的关键手段
3. CART算法同时支持分类和回归
4. 理解决策树有助于理解更复杂的集成学习方法
