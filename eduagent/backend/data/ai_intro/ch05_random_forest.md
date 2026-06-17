---
id: random_forest
topic: 随机森林
course: 人工智能导论
chapter: 5
---

# 随机森林

## 1. 概述

随机森林（Random Forest）是一种基于Bagging的集成学习算法，通过构建多棵决策树并将它们的结果进行投票或平均，来提高模型的准确性和稳定性。

## 2. 核心思想

### Bagging（Bootstrap Aggregating）
- 从原始数据中有放回地抽取多个子集
- 每个子集训练一棵决策树
- 最终结果通过投票（分类）或平均（回归）得到

### 随机特征选择
在每个节点划分时，不是从所有特征中选择最优，而是从随机选择的特征子集中选择最优。

## 3. 算法步骤

1. 从原始训练集通过有放回采样生成多个子集
2. 对每个子集训练一棵决策树
3. 在每个节点，随机选择m个特征（通常m=√d）
4. 从m个特征中选择最优特征进行划分
5. 最终预测：分类任务用投票法，回归任务用平均法

## 4. 关键参数

| 参数 | 说明 | 建议值 |
|------|------|--------|
| n_estimators | 树的数量 | 100-500 |
| max_depth | 树的最大深度 | None或10-30 |
| max_features | 每棵树使用的特征数 | sqrt（分类）, 1/3（回归） |
| min_samples_split | 内部节点再划分所需最小样本数 | 2-10 |

## 5. 优缺点

### 优点
- 防止过拟合，泛化能力强
- 可以评估特征重要性
- 对缺失值和异常值鲁棒
- 可以处理高维数据

### 缺点
- 模型可解释性不如单棵决策树
- 训练和预测速度较慢
- 在噪声较大的数据上可能过拟合

## 6. Python实现

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score

rf = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    n_jobs=-1
)

# 交叉验证评估
scores = cross_val_score(rf, X, y, cv=5)
print(f"随机森林准确率: {scores.mean():.4f} ± {scores.std():.4f}")

# 特征重要性
rf.fit(X_train, y_train)
importances = rf.feature_importances_
```

## 7. 关键要点

1. 随机森林是工业界最常用的机器学习算法之一
2. 随机性来自两方面：数据采样和特征选择
3. 树的数量足够多时，随机森林不会过拟合
4. 是理解和使用XGBoost等高级算法的基础
