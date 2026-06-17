---
id: cnn
topic: 卷积神经网络（CNN）
course: 人工智能导论
chapter: 8
---

# 卷积神经网络（CNN）

## 1. 概述

卷积神经网络是专门处理网格状数据（如图像）的深度学习模型，通过卷积操作提取局部特征。

## 2. 核心组件

- **卷积层**：用卷积核在输入上滑动，提取特征图
- **池化层**：降采样，保留主要特征，减少参数
- **全连接层**：将特征图展平后进行分类

## 3. 卷积操作

输出特征图尺寸 = (W - K + 2P)/S + 1
- W: 输入尺寸
- K: 卷积核大小
- P: 填充大小
- S: 步长

## 4. 经典架构

| 模型 | 年份 | 创新点 |
|------|------|--------|
| LeNet-5 | 1998 | 奠定CNN基础 |
| AlexNet | 2012 | ReLU + Dropout + GPU |
| VGGNet | 2014 | 小卷积核堆叠 |
| ResNet | 2015 | 残差连接，解决退化问题 |

## 5. Python示例

```python
import torch.nn as nn

class SimpleCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 16, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc = nn.Linear(16 * 16 * 16, 10)

    def forward(self, x):
        x = self.pool(torch.relu(self.conv1(x)))
        x = x.view(x.size(0), -1)
        return self.fc(x)
```

## 6. 关键要点
1. CNN擅长处理图像数据，通过卷积提取空间特征
2. 池化层降低维度，防止过拟合
3. ResNet的残差连接是深度学习的重要突破
4. CNN也是计算机视觉的基础模型
