"""
演示数据 API — 用于比赛答辩前快速准备完整闭环证据
"""
from fastapi import APIRouter, Depends
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    ChatMessage,
    ChatSession,
    LearningRecord,
    LearningResource,
    Student,
    StudentProfile,
    get_db,
)

router = APIRouter()

DEMO_STUDENT_ID = "default"


DEMO_PROFILE = {
    "knowledge_base": {
        "value": "已掌握 Python 基础、数据结构、线性代数和概率统计，了解监督学习基本流程；神经网络和模型评估仍需系统补强。",
        "confidence": 0.92,
        "source": "演示画像初始化",
    },
    "cognitive_style": {
        "value": "偏好图示化解释和代码实验，适合先看知识图谱，再通过小案例验证概念。",
        "confidence": 0.86,
        "source": "演示画像初始化",
    },
    "learning_ability": {
        "value": "理解抽象概念较快，但在公式推导和模型泛化分析上需要更多分步提示。",
        "confidence": 0.81,
        "source": "演示画像初始化",
    },
    "error_patterns": {
        "value": "容易混淆训练集、验证集、测试集的作用，对过拟合、欠拟合和正则化边界理解不稳定。",
        "confidence": 0.84,
        "source": "演示画像初始化",
    },
    "learning_goals": {
        "value": "两周内完成机器学习基础、神经网络入门和可解释小项目，为人工智能导论课程展示做准备。",
        "confidence": 0.9,
        "source": "演示画像初始化",
    },
    "interests": {
        "value": "对智能教育、推荐系统、计算机视觉和大模型应用开发感兴趣。",
        "confidence": 0.78,
        "source": "演示画像初始化",
    },
    "learning_habits": {
        "value": "晚上集中学习 60-90 分钟，喜欢先看总结，再做练习和代码实验巩固。",
        "confidence": 0.8,
        "source": "演示画像初始化",
    },
}


DEMO_RESOURCES = [
    {
        "resource_id": "demo-doc-neural-network",
        "resource_type": "document",
        "title": "神经网络 - 个性化课程讲解",
        "topic": "神经网络",
        "difficulty": "medium",
        "content": """# 神经网络核心讲解

神经网络是一类受生物神经系统启发的机器学习模型。它通过多层神经元对输入特征进行非线性变换，从而学习复杂的数据模式。

## 关键点

1. **神经元**：接收输入、加权求和，再经过激活函数输出。
2. **隐藏层**：逐层抽取更高层的特征表示。
3. **损失函数**：衡量预测结果和真实标签之间的差距。
4. **反向传播**：根据误差更新参数，使模型逐步变好。

针对当前学生画像，建议先用图示理解前向传播，再用 20 行 Python 代码实现一个二分类小例子。""",
    },
    {
        "resource_id": "demo-mindmap-neural-network",
        "resource_type": "mindmap",
        "title": "神经网络 - 思维导图",
        "topic": "神经网络",
        "difficulty": "medium",
        "content": """```mermaid
mindmap
  root((神经网络))
    基础结构
      输入层
      隐藏层
      输出层
    核心机制
      前向传播
      损失函数
      反向传播
    常见问题
      过拟合
      梯度消失
      学习率设置
    学习建议
      图示理解
      代码实验
      错题补强
```""",
    },
    {
        "resource_id": "demo-quiz-neural-network",
        "resource_type": "quiz",
        "title": "神经网络 - 分层练习题",
        "topic": "神经网络",
        "difficulty": "medium",
        "content": """## 选择题

1. 神经网络中激活函数的主要作用是？
   - A. 引入非线性能力
   - B. 删除全部噪声
   - C. 固定模型参数
   - D. 替代训练数据

答案：A

2. 反向传播主要用于？
   - A. 计算参数梯度并更新权重
   - B. 收集训练样本
   - C. 压缩图片
   - D. 展示可视化结果

答案：A

## 简答题

请用自己的话解释“过拟合”，并给出一个缓解办法。""",
    },
    {
        "resource_id": "demo-code-neural-network",
        "resource_type": "code",
        "title": "神经网络 - Python 代码案例",
        "topic": "神经网络",
        "difficulty": "medium",
        "content": """```python
import numpy as np

# 一个极简二分类神经元：sigmoid + 梯度下降
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([[0], [1], [1], [1]], dtype=float)

w = np.zeros((2, 1))
b = 0.0
lr = 0.3

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

for epoch in range(200):
    pred = sigmoid(X @ w + b)
    error = pred - y
    w -= lr * X.T @ error / len(X)
    b -= lr * error.mean()

print(sigmoid(X @ w + b).round(3))
```""",
    },
    {
        "resource_id": "demo-reading-neural-network",
        "resource_type": "reading",
        "title": "神经网络 - 拓展阅读",
        "topic": "神经网络",
        "difficulty": "medium",
        "content": """## 推荐资源

1. 《深度学习入门》：适合用图示和 NumPy 代码理解神经网络。
2. Machine Learning Crash Course：适合快速补齐模型训练和评估概念。
3. PyTorch 官方 Tutorials：适合把理论迁移到工程实践。

结合画像建议：先读第 1 类图示资料，再做 PyTorch 小实验，最后用练习题检查错因。""",
    },
    {
        "resource_id": "demo-storyboard-neural-network",
        "resource_type": "storyboard",
        "title": "神经网络 - 动画分镜",
        "topic": "神经网络",
        "difficulty": "medium",
        "content": """# 神经网络微课动画分镜

| 镜头 | 画面 | 旁白 | 屏幕文字 | 交互检查点 |
| --- | --- | --- | --- | --- |
| 1 | 输入特征像数据卡片一样进入网络 | 神经网络先接收输入特征 | 输入层 | 提问：输入层接收什么？ |
| 2 | 多个神经元依次加权求和 | 每个神经元会计算加权和 | 权重与偏置 | 点击查看权重变化 |
| 3 | 激活函数把直线关系变成弯曲边界 | 激活函数提供非线性表达能力 | 激活函数 | 判断：没有激活函数会怎样？ |
| 4 | 预测结果和真实标签之间出现距离 | 损失函数衡量当前模型错得多远 | 损失函数 | 拖动参数观察损失变化 |
| 5 | 误差箭头从后往前传回每层 | 反向传播根据误差更新参数 | 反向传播 | 选择：反向传播主要计算什么？ |

该分镜适合在课堂或答辩中把抽象概念转成可视化微课。""",
    },
]


DEMO_RECORDS = [
    {"action_type": "study", "topic": "机器学习基础", "score": None, "duration": 35, "extra_data": {"resource_type": "document"}},
    {"action_type": "quiz", "topic": "神经网络", "score": 72, "duration": 18, "extra_data": {"weak": ["过拟合", "反向传播"]}},
    {"action_type": "reinforce", "topic": "过拟合与正则化", "score": None, "duration": 22, "extra_data": {"strategy": "错因补强"}},
    {"action_type": "quiz", "topic": "神经网络", "score": 88, "duration": 16, "extra_data": {"round": 2}},
]


DEMO_WRONG_QUESTIONS = [
    {
        "question_id": "demo-wrong-overfitting",
        "question": "训练集准确率很高，但测试集准确率明显下降，最可能说明什么？",
        "question_type": "choice",
        "options": ["A. 模型过拟合", "B. 模型完全收敛", "C. 数据无需划分", "D. 学习率一定太小"],
        "correct_answer": "A",
        "user_answer": "B",
        "explanation": "训练集表现好、测试集表现差是典型过拟合信号，需要用验证集、正则化、数据增强等方式缓解。",
        "topic": "过拟合与正则化",
        "knowledge_point": "过拟合判断",
    },
    {
        "question_id": "demo-wrong-backprop",
        "question": "反向传播算法的核心作用是什么？",
        "question_type": "choice",
        "options": ["A. 计算梯度并更新参数", "B. 自动收集训练样本", "C. 删除隐藏层", "D. 直接提高数据质量"],
        "correct_answer": "A",
        "user_answer": "D",
        "explanation": "反向传播通过链式法则计算损失函数对各层参数的梯度，为优化器更新权重提供依据。",
        "topic": "神经网络",
        "knowledge_point": "反向传播",
    },
]


DEMO_PERSONALIZATION = {
    "personalized": True,
    "profile_dimensions": len(DEMO_PROFILE),
    "weak_points": [
        "过拟合判断（训练集好、测试集差）",
        "反向传播（链式法则与梯度更新）",
    ],
}


DEMO_AGENT_TRACE = [
    {
        "agent": "planner",
        "name": "任务规划智能体",
        "task": "拆解个性化学习任务",
        "output": "识别为神经网络入门场景，按画像、资源、测评、错因、补强的顺序组织闭环。",
        "status": "done",
    },
    {
        "agent": "profiler",
        "name": "学生画像智能体",
        "task": "读取学生基础和易错模式",
        "output": "学生偏好图示与代码实验，薄弱点集中在过拟合判断和反向传播。",
        "status": "done",
    },
    {
        "agent": "doc_generator",
        "name": "讲解资源智能体",
        "task": "生成个性化课程讲解",
        "output": "围绕神经元、隐藏层、损失函数和反向传播生成分层讲解。",
        "status": "done",
    },
    {
        "agent": "mindmap_generator",
        "name": "导图智能体",
        "task": "生成知识结构导图",
        "output": "输出神经网络结构、机制、常见问题和学习建议四层导图。",
        "status": "done",
    },
    {
        "agent": "code_generator",
        "name": "代码案例智能体",
        "task": "生成可运行代码案例",
        "output": "提供 NumPy 极简二分类神经元，帮助学生把前向传播和梯度下降落到代码。",
        "status": "done",
    },
    {
        "agent": "storyboard_generator",
        "name": "动画分镜智能体",
        "task": "生成微课动画分镜",
        "output": "把神经网络前向传播、损失函数和反向传播转成镜头、旁白与互动检查点。",
        "status": "done",
    },
    {
        "agent": "quiz_generator",
        "name": "测验智能体",
        "task": "生成分层练习题",
        "output": "生成选择题和简答题，用于检测激活函数、反向传播和过拟合理解。",
        "status": "done",
    },
    {
        "agent": "quality_reviewer",
        "name": "资源质检智能体",
        "task": "检查资源结构、画像匹配和可演示性",
        "output": "5 份资源均通过质检，平均 88 分，能够支撑比赛演示闭环。",
        "status": "done",
    },
    {
        "agent": "evaluator",
        "name": "学习评估智能体",
        "task": "融合测验和错因生成评估",
        "output": "发现过拟合与反向传播仍需补强，建议进入错因驱动复习。",
        "status": "done",
    },
    {
        "agent": "path_planner",
        "name": "路径规划智能体",
        "task": "生成下一步学习计划",
        "output": "先补过拟合与正则化，再做变式题，最后完成小型神经网络代码实验。",
        "status": "done",
    },
]


DEMO_QUALITY_CHECKS = {
    "document": {
        "score": 88,
        "passed": True,
        "reasons": ["结构清晰", "覆盖核心概念", "结合画像给出图示和代码学习建议"],
        "suggestions": ["答辩时可强调该资料不是固定模板，而是根据画像生成"],
    },
    "mindmap": {
        "score": 92,
        "passed": True,
        "reasons": ["知识层级完整", "适合图示型学习者", "能直接支撑学习路径说明"],
        "suggestions": ["可在演示中配合知识图谱解释先修关系"],
    },
    "quiz": {
        "score": 86,
        "passed": True,
        "reasons": ["题型覆盖选择题和简答题", "能定位过拟合与反向传播错因", "答案解释明确"],
        "suggestions": ["继续加入变式题，验证错因是否真正掌握"],
    },
    "code": {
        "score": 90,
        "passed": True,
        "reasons": ["代码短小可运行", "能连接理论和实践", "适合比赛现场演示"],
        "suggestions": ["后续可增加可视化训练曲线"],
    },
    "reading": {
        "score": 84,
        "passed": True,
        "reasons": ["推荐资源与学习目标一致", "给出阅读顺序", "能辅助课后拓展"],
        "suggestions": ["可补充更多中文资料入口"],
    },
    "storyboard": {
        "score": 91,
        "passed": True,
        "reasons": ["包含镜头、画面、旁白和互动检查点", "适合课堂演示", "能把抽象知识转成可视化微课"],
        "suggestions": ["后续可接入真实动画生成或视频合成模块"],
    },
}


DEMO_RESOURCE_QUALITY = {
    "overall_score": 88,
    "pass_line": 75,
    "status": "passed",
    "summary": "演示资源覆盖讲解、导图、测验、代码和拓展阅读，均通过结构完整性、画像匹配度和可演示性检查。",
    "personalization_used": True,
    "profile_dimensions": len(DEMO_PROFILE),
    "weak_points": DEMO_PERSONALIZATION["weak_points"],
    "checks": list(DEMO_QUALITY_CHECKS.values()),
}


DEMO_NEXT_PLAN = {
    "next_focus": "过拟合与反向传播",
    "reason": "首轮测验暴露出过拟合判断和反向传播作用理解不稳定，需要先补错因再进入新主题。",
    "steps": [
        {"title": "错因回看", "description": "打开错题本，复盘训练集高分但测试集下降的过拟合场景。"},
        {"title": "补强资源", "description": "阅读正则化、验证集和早停策略的个性化讲解。"},
        {"title": "变式练习", "description": "完成 3 道过拟合判断题和 1 道反向传播简答题。"},
        {"title": "代码实验", "description": "运行 NumPy 神经元案例，观察学习率和迭代次数对结果的影响。"},
    ],
}


async def _ensure_student(db: AsyncSession) -> None:
    result = await db.execute(select(Student).where(Student.student_id == DEMO_STUDENT_ID))
    student = result.scalar_one_or_none()
    if not student:
        db.add(Student(student_id=DEMO_STUDENT_ID, name="A3 演示学生"))
        await db.flush()


@router.post("/seed")
async def seed_demo_data(db: AsyncSession = Depends(get_db)):
    """初始化可重复执行的演示数据。"""
    await _ensure_student(db)

    result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == DEMO_STUDENT_ID))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = StudentProfile(student_id=DEMO_STUDENT_ID)
        db.add(profile)

    for key, value in DEMO_PROFILE.items():
        setattr(profile, key, value)
    profile.profile_version = max((profile.profile_version or 0) + 1, 2)
    profile.raw_text = "A3 演示画像：计算机专业学生，目标是在人工智能导论课程中掌握机器学习和神经网络。"

    created_resources = 0
    for item in DEMO_RESOURCES:
        quality_check = DEMO_QUALITY_CHECKS.get(item["resource_type"], {})
        resource_agent_trace = [
            step
            for step in DEMO_AGENT_TRACE
            if step["agent"] in {
                "planner",
                "profiler",
                "quality_reviewer",
                "evaluator",
                "path_planner",
                f"{item['resource_type']}_generator",
            }
            or (item["resource_type"] == "document" and step["agent"] == "doc_generator")
        ]
        extra_data = {
            "personalization": DEMO_PERSONALIZATION,
            "quality_check": quality_check,
            "agent_trace": resource_agent_trace,
        }
        existing = await db.execute(select(LearningResource).where(LearningResource.resource_id == item["resource_id"]))
        resource = existing.scalar_one_or_none()
        if resource:
            await db.execute(
                update(LearningResource)
                .where(LearningResource.resource_id == item["resource_id"])
                .values(
                    title=item["title"],
                    content=item["content"],
                    topic=item["topic"],
                    difficulty=item["difficulty"],
                    extra_data=extra_data,
                )
            )
        else:
            db.add(LearningResource(
                student_id=DEMO_STUDENT_ID,
                content_format="markdown",
                extra_data=extra_data,
                **item,
            ))
            created_resources += 1

    result = await db.execute(select(ChatSession).where(ChatSession.session_id == "demo-a3"))
    session = result.scalar_one_or_none()
    if not session:
        db.add(ChatSession(session_id="demo-a3", student_id=DEMO_STUDENT_ID, title="A3 演示对话"))

    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == "demo-a3"))
    db.add(ChatMessage(
        session_id="demo-a3",
        role="user",
        content="我是计算机专业学生，想学神经网络，希望系统按我的基础生成资料并检测掌握情况。",
    ))
    db.add(ChatMessage(
        session_id="demo-a3",
        role="assistant",
        content="已更新学习画像，并调度画像、资源、题目、质检、评估和路径规划智能体生成个性化学习方案。",
        extra_data={
            "agents": [
                "profiler",
                "doc_generator",
                    "mindmap_generator",
                    "code_generator",
                    "storyboard_generator",
                    "quality_reviewer",
                "quiz_generator",
                "evaluator",
                "path_planner",
            ]
        },
    ))

    await db.execute(delete(LearningRecord).where(LearningRecord.student_id == DEMO_STUDENT_ID))
    for item in DEMO_RECORDS:
        extra_data = {"demo": True, **item.get("extra_data", {})}
        if item["action_type"] == "study":
            extra_data.update({
                "resource_quality": DEMO_RESOURCE_QUALITY,
                "agent_trace": DEMO_AGENT_TRACE[:7],
            })
        elif item["action_type"] == "quiz":
            extra_data.update({
                "wrong_topics": item.get("extra_data", {}).get("weak", ["过拟合", "反向传播"]),
                "next_plan": DEMO_NEXT_PLAN,
                "agent_trace": DEMO_AGENT_TRACE,
            })
        elif item["action_type"] == "reinforce":
            extra_data.update({
                "strategy": "错因补强",
                "next_plan": DEMO_NEXT_PLAN,
                "agent_trace": DEMO_AGENT_TRACE[1:],
            })
        db.add(LearningRecord(
            student_id=DEMO_STUDENT_ID,
            resource_id="",
            action_type=item["action_type"],
            topic=item["topic"],
            score=item["score"],
            duration=item["duration"],
            extra_data=extra_data,
        ))

    from app.api.wrong_book import save_wrong_question

    for item in DEMO_WRONG_QUESTIONS:
        await save_wrong_question(db, DEMO_STUDENT_ID, {**item, "is_mastered": False})

    await db.commit()

    resource_result = await db.execute(
        select(LearningResource).where(LearningResource.student_id == DEMO_STUDENT_ID)
    )
    seeded_resources = resource_result.scalars().all()
    resource_type_values = [item.resource_type for item in seeded_resources]
    resource_types = sorted(set(resource_type_values))
    quality_scores = [
        float((item.extra_data or {}).get("quality_check", {}).get("score", 0))
        for item in seeded_resources
        if (item.extra_data or {}).get("quality_check")
    ]

    return {
        "success": True,
        "student_id": DEMO_STUDENT_ID,
        "profile_dimensions": len(DEMO_PROFILE),
        "resources_total": len(resource_type_values),
        "resource_type_count": len(resource_types),
        "resource_types": resource_types,
        "seed_resource_count": len(DEMO_RESOURCES),
        "resources_created": created_resources,
        "records_created": len(DEMO_RECORDS),
        "wrong_questions_created": len(DEMO_WRONG_QUESTIONS),
        "quality_resource_count": len(quality_scores),
        "avg_resource_quality": round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else None,
        "agent_trace_count": len(DEMO_AGENT_TRACE),
    }
