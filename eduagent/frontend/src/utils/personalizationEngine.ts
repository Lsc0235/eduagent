import type {
  CurrentLearningContext,
  ExerciseEvaluationResult,
  LearningMode,
  LearningRecord,
  PersonalizedExercise,
  PersonalizedPlan,
  ProfileUpdateSuggestion,
  ProjectTask,
  UserProfile,
  WeaknessRecoveryPlan,
  WrongQuestion,
} from '../types/personalization'

const has = (value: string, keywords: string[]) => keywords.some(keyword => value.includes(keyword))

const modeLabel: Record<LearningMode, string> = {
  single_topic: '单点速学',
  system_study: '系统学习',
  project_task: '项目任务',
}

export const getLearningModeLabel = (mode: LearningMode) => modeLabel[mode]

export const getRecommendedMode = (topic: string, profile: UserProfile): LearningMode => {
  const habit = profile.learningHabit
  const goal = profile.learningGoal
  const base = profile.knowledgeBase
  const style = profile.cognitiveStyle

  if (has(style, ['代码', '实践']) && has(goal, ['项目', '实践', '实战'])) return 'project_task'
  if (has(goal, ['项目', '实践', '实战'])) return 'project_task'
  if (has(goal, ['系统学习', '长期掌握', '课程', '体系'])) return 'system_study'
  if (has(habit, ['时间短', '30分钟', '碎片', '短'])) return 'single_topic'
  if (has(base, ['薄弱', '零基础', '一般', '入门'])) return 'single_topic'
  return topic.length > 8 ? 'system_study' : 'single_topic'
}

export const generatePersonalizedReason = (topic: string, profile: UserProfile, mode: LearningMode) => {
  const preferences = [
    profile.knowledgeBase ? `知识基础：${profile.knowledgeBase}` : '',
    profile.cognitiveStyle ? `认知风格：${profile.cognitiveStyle}` : '',
    profile.learningGoal ? `学习目标：${profile.learningGoal}` : '',
    profile.learningHabit ? `学习习惯：${profile.learningHabit}` : '',
  ].filter(Boolean)

  return `系统根据你的学习画像，推荐你使用【${modeLabel[mode]}】模式学习「${topic}」。` +
    `因为${preferences.join('；')}。本次会优先提供图解、案例、代码示例和小测题，减少不必要的跳步。`
}

export const createFallbackBooks = (topic: string) => [
  {
    id: 'd2l-local',
    title: `动手学${topic}`,
    author: 'Aston Zhang 等',
    level: '入门到进阶',
    score: 96,
    benefit: '用代码和图解把概念讲清楚，适合作为主线教材。',
    fit_reason: '适合图解 + 代码偏好的画像',
    why_authoritative: '内容体系完整，实践案例丰富',
    ebook_url: 'https://zh.d2l.ai/',
  },
  {
    id: 'nielsen-local',
    title: `${topic}与深度学习基础`,
    author: 'Michael Nielsen',
    level: '基础理解',
    score: 91,
    benefit: '适合先建立直觉，再进入公式和代码。',
    fit_reason: '适合基础一般、需要类比解释的画像',
    why_authoritative: '经典在线教材，解释清晰',
    ebook_url: 'http://neuralnetworksanddeeplearning.com/',
  },
]

export const generateExercises = (topic: string, profile: UserProfile): PersonalizedExercise[] => {
  const isProject = has(profile.learningGoal, ['项目', '实践', '实战'])
  const isWeak = has(profile.knowledgeBase, ['薄弱', '零基础', '一般', '入门'])
  const isExam = has(profile.learningGoal, ['考试', '考研', '测验'])

  return [
    {
      id: `${topic}-concept`,
      type: isExam ? '选择题' : '概念判断题',
      question: `学习「${topic}」时，最先应该确认哪件事？`,
      options: ['A. 直接记公式', 'B. 明确输入、输出和核心作用', 'C. 跳过基础概念', 'D. 只看结论'],
      answer: 'B. 明确输入、输出和核心作用',
      analysis: '先明确输入、输出和核心作用，后续公式、代码和案例才有位置可放。',
      knowledgePoint: `${topic}核心概念`,
      difficulty: isWeak ? '入门' : '中等',
    },
    {
      id: `${topic}-process`,
      type: '选择题',
      question: `如果你对「${topic}」的流程不稳定，最适合的学习方式是？`,
      options: ['A. 只背术语', 'B. 画流程图并用一个小例子跑通', 'C. 直接做难题', 'D. 不看反馈'],
      answer: 'B. 画流程图并用一个小例子跑通',
      analysis: '流程图能降低认知负荷，小例子能验证每一步是否真的理解。',
      knowledgePoint: `${topic}流程理解`,
      difficulty: '入门',
    },
    {
      id: `${topic}-code`,
      type: isProject ? '代码理解题' : '案例题',
      question: `把「${topic}」用于一个小案例时，最关键的检查项是什么？`,
      options: ['A. 结果是否可解释', 'B. 变量名是否最长', 'C. 代码是否越复杂越好', 'D. 是否跳过测试'],
      answer: 'A. 结果是否可解释',
      analysis: '项目型学习不仅要跑通，还要能解释输入、处理过程和结果含义。',
      knowledgePoint: `${topic}案例应用`,
      difficulty: '中等',
    },
    {
      id: `${topic}-mistake`,
      type: '选择题',
      question: `学习「${topic}」时，错题最应该沉淀成什么？`,
      options: ['A. 一个薄弱知识点', 'B. 一句抱怨', 'C. 一个无关标签', 'D. 直接删除'],
      answer: 'A. 一个薄弱知识点',
      analysis: '错题要回流到画像和补弱计划里，才能影响下一次推荐。',
      knowledgePoint: `${topic}错因分析`,
      difficulty: '入门',
    },
    {
      id: `${topic}-transfer`,
      type: isWeak ? '概念判断题' : '综合应用题',
      question: `当你能把「${topic}」迁移到新场景时，说明你至少完成了什么？`,
      options: ['A. 只记住定义', 'B. 理解核心结构并能识别适用条件', 'C. 完全不需要练习', 'D. 只会复制答案'],
      answer: 'B. 理解核心结构并能识别适用条件',
      analysis: '迁移能力来自结构化理解和适用条件判断，而不是死记硬背。',
      knowledgePoint: `${topic}迁移应用`,
      difficulty: isExam ? '进阶' : '中等',
    },
  ]
}

export const generateSingleTopicPlan = (topic: string, profile: UserProfile): PersonalizedPlan => {
  const mode = getRecommendedMode(topic, profile)
  return {
    topic,
    recommendedMode: mode,
    reason: generatePersonalizedReason(topic, profile, mode),
    learningGoals: [
      `用一句话说清「${topic}」解决什么问题`,
      `画出「${topic}」的核心流程或结构`,
      `完成 5 道画像适配练习，并把错题回流到错题本`,
    ],
    learningPath: [
      { step: 1, title: '直觉建立', duration: '8分钟', description: `用生活类比解释「${topic}」的作用和边界。`, resourceType: '类比/图解' },
      { step: 2, title: '结构拆解', duration: '12分钟', description: `拆成输入、处理、输出、常见误区四块。`, resourceType: '流程图' },
      { step: 3, title: '代码或案例验证', duration: '15分钟', description: `用一个最小案例验证关键步骤。`, resourceType: '代码/案例' },
      { step: 4, title: '即时练习', duration: '10分钟', description: '完成 5 道题，错题进入错题本。', resourceType: '练习' },
    ],
    explanations: {
      beginner: `小白理解：${topic} 就像一个“判断和转换规则”，先看输入是什么，再看它怎样一步步得到结果。`,
      analogy: `类比理解：可以把 ${topic} 想成学习路线中的导航仪，它根据当前信息判断下一步应该往哪里走。`,
      professional: `专业理解：${topic} 的关键在于建立变量、结构、目标函数或判别规则之间的映射，并通过反馈修正理解。`,
    },
    resources: [
      {
        type: '讲义',
        title: `${topic} 一页速学讲义`,
        reason: '适合先建立全局框架，再进入细节。',
        contentPreview: `包含定义、核心流程、常见误区和一个小案例。`,
      },
      {
        type: has(profile.cognitiveStyle, ['代码']) ? '代码' : '思维导图',
        title: `${topic} ${has(profile.cognitiveStyle, ['代码']) ? '最小代码实验' : '结构导图'}`,
        reason: `匹配你的认知风格：${profile.cognitiveStyle}`,
        contentPreview: has(profile.cognitiveStyle, ['代码'])
          ? '用 20 行左右伪代码跑通核心流程。'
          : '把概念、流程、错因和应用场景连成图。',
      },
      {
        type: '题库',
        title: `${topic} 画像适配练习`,
        reason: `针对你的易错点：${profile.errorPreference}`,
        contentPreview: '包含概念判断、流程理解、案例应用和迁移题。',
      },
    ],
    exercises: generateExercises(topic, profile),
    nextTopics: [`${topic} 常见误区`, `${topic} 项目案例`, `${topic} 进阶应用`],
  }
}

export const generateSystemStudyEnhancement = (topic: string, profile: UserProfile, books: any[]) => {
  const source = books.length > 0 ? books : createFallbackBooks(topic)
  return source.map((book, index) => ({
    ...book,
    personalized_reason: `因为你的画像显示「${profile.cognitiveStyle}」，${book.title} 的案例和结构更适合作为第 ${index + 1} 本主线资料。`,
    profile_fit: `匹配点：${profile.knowledgeBase}；目标：${profile.learningGoal}`,
    study_advice: has(profile.learningHabit, ['短', '碎片', '30分钟'])
      ? '建议拆成 20-30 分钟小节，每节结束做 2 道题。'
      : '建议每章先看导图，再用代码或案例复现关键步骤。',
  }))
}

export const generateProjectTask = (topic: string, profile: UserProfile): ProjectTask => {
  const interest = profile.interestDirection
  let scene = '通用二分类小应用'
  if (has(interest, ['金融', '风控', '股票', '信用'])) scene = '金融风险预测'
  if (has(interest, ['视觉', '图像', '目标识别'])) scene = '图像分类'
  if (has(interest, ['自然语言', '文本', '情感'])) scene = '文本情感分析'

  return {
    topic,
    projectName: `基于${topic}的${scene}入门项目`,
    projectGoal: `用一个可展示的小项目理解 ${topic} 的核心流程，并形成作品说明。`,
    fitReason: `你的兴趣方向是「${profile.interestDirection}」，学习目标是「${profile.learningGoal}」，因此用项目任务更容易形成可迁移经验。`,
    prerequisites: ['Python 基础', '数据读取与划分', `${topic} 基本概念`, '简单评估指标'],
    background: `${scene}需要把真实问题转化为输入特征、模型判断和结果解释，适合用来练习 ${topic}。`,
    steps: [
      '定义任务目标和输入输出',
      '准备 20-50 条小样本或 mock 数据',
      `用 ${topic} 思路搭建最小模型流程`,
      '输出预测结果并解释错误案例',
      '整理项目 README：目标、步骤、结果、改进方向',
    ],
    codeExample:
`# ${topic} 项目骨架
data = load_demo_data()
train, test = split(data)
model = build_model(topic='${topic}')
model.fit(train.x, train.y)
pred = model.predict(test.x)
print(evaluate(pred, test.y))`,
    checklist: ['能说清项目目标', '能解释每一步输入输出', '至少记录 2 个错误案例', '能提出 1 个改进方向'],
    extensions: [`加入更多 ${scene} 特征`, '更换评估指标', '把结果做成可视化报告'],
  }
}

const normalizeAnswer = (answer: string) => {
  const text = (answer || '').trim()
  const first = text.match(/^[A-D]/i)?.[0]?.toUpperCase()
  return first || text
}

export const evaluateExerciseResult = (
  topic: string,
  answers: Record<string, string>,
  exercises: PersonalizedExercise[],
  profile: UserProfile,
): ExerciseEvaluationResult => {
  const wrongQuestions: WrongQuestion[] = []
  const mastered = new Set<string>()
  const weak = new Set<string>()

  exercises.forEach(exercise => {
    const userAnswer = answers[exercise.id] || ''
    const correct = normalizeAnswer(userAnswer) === normalizeAnswer(exercise.answer)
    if (correct) {
      mastered.add(exercise.knowledgePoint)
    } else {
      weak.add(exercise.knowledgePoint)
      wrongQuestions.push({
        id: `${exercise.id}-${Date.now()}`,
        topic,
        question: exercise.question,
        userAnswer: userAnswer || '未作答',
        correctAnswer: exercise.answer,
        analysis: exercise.analysis,
        knowledgePoint: exercise.knowledgePoint,
        difficulty: exercise.difficulty,
        errorType: '知识点理解偏差',
        source: 'single_topic',
        createdAt: new Date().toISOString(),
      })
    }
  })

  const correctCount = exercises.length - wrongQuestions.length
  const score = Math.round((correctCount / Math.max(exercises.length, 1)) * 100)
  const record: LearningRecord = {
    id: `record-${Date.now()}`,
    topic,
    mode: 'single_topic',
    score,
    completedSteps: 4,
    totalSteps: 4,
    wrongKnowledgePoints: Array.from(weak),
    masteredKnowledgePoints: Array.from(mastered),
    createdAt: new Date().toISOString(),
  }

  return {
    score,
    correctCount,
    wrongCount: wrongQuestions.length,
    masteredKnowledgePoints: record.masteredKnowledgePoints,
    weakKnowledgePoints: record.wrongKnowledgePoints,
    wrongQuestions,
    profileUpdateSuggestion: generateProfileUpdateSuggestion(record, profile),
  }
}

export const generateProfileUpdateSuggestion = (record: LearningRecord, profile: UserProfile): ProfileUpdateSuggestion => {
  const weakness = record.wrongKnowledgePoints
  return {
    id: `suggestion-${Date.now()}`,
    createdAt: new Date().toISOString(),
    mastered: record.masteredKnowledgePoints,
    weakness,
    suggestedProfileChange: weakness.length > 0
      ? `建议把「${weakness.join('、')}」加入易错点，并在下一轮学习中增加图解、案例和针对性练习。`
      : `本次「${record.topic}」掌握较好，可以把学习目标推进到项目实践或进阶应用。`,
    suggestedLearningAbility: record.score >= 80
      ? '当前理解与迁移能力较稳定，可逐步增加综合应用题。'
      : '当前需要更多分步提示和即时反馈，建议保持短路径学习。',
    suggestedGoal: record.score >= 80
      ? `${profile.learningGoal}；下一阶段加入 ${record.topic} 进阶应用`
      : profile.learningGoal,
    suggestedHabit: record.score < 70
      ? '每次学习后立即做 3-5 道小题，并把错因写成一句话。'
      : profile.learningHabit,
  }
}

export const generateWeaknessRecoveryPlan = (wrongs: WrongQuestion[], profile: UserProfile): WeaknessRecoveryPlan => {
  const counts = wrongs.reduce<Record<string, number>>((acc, question) => {
    acc[question.knowledgePoint] = (acc[question.knowledgePoint] || 0) + 1
    return acc
  }, {})
  const reviewPoints = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([point]) => point).slice(0, 5)
  const returnTopic = wrongs[0]?.topic || reviewPoints[0] || '当前知识点'
  return {
    reviewPoints,
    sequence: reviewPoints.map((point, index) => `${index + 1}. 先复盘「${point}」错因，再做 2 道同类题`),
    exercises: generateExercises(returnTopic, profile).slice(0, 3),
    resources: reviewPoints.map(point => ({
      type: '补弱讲义',
      title: `${point} 错因复盘卡`,
      reason: '来自错题本高频薄弱点',
      contentPreview: `用定义、例子、反例和一道小题重新理解 ${point}。`,
    })),
    returnTopic,
  }
}

export const generateMockChatResponse = (
  message: string,
  context: CurrentLearningContext | null,
  profile: UserProfile,
  wrongs: WrongQuestion[],
  records: LearningRecord[],
) => {
  const topic = context?.topic || '当前知识点'
  const weak = wrongs.slice(0, 3).map(question => question.knowledgePoint).join('、') || '暂无明确薄弱点'
  const latest = records[0]
  const styleAdvice = has(profile.cognitiveStyle, ['代码'])
    ? '我会多给代码示例和逐行解释。'
    : has(profile.cognitiveStyle, ['图'])
      ? '我会用流程结构和分步骤说明。'
      : '我会先给直觉解释，再给专业表达。'

  return `我先按你的画像来回答。\n\n` +
    `- 当前知识点：${topic}\n` +
    `- 当前模式：${context ? modeLabel[context.mode] : '未选择'}\n` +
    `- 画像重点：${profile.cognitiveStyle}\n` +
    `- 近期薄弱点：${weak}\n` +
    `${latest ? `- 最近得分：${latest.score} 分\n` : ''}\n\n` +
    `${styleAdvice}\n\n` +
    `针对你的问题“${message}”，建议这样学：\n` +
    `1. 先用一句话说清 ${topic} 的输入、处理和输出。\n` +
    `2. 再画出 3-4 步流程，把容易混淆的点标红。\n` +
    `3. 最后做一道同类题，把错因写进错题本。\n\n` +
    `如果你愿意，可以继续问我：“根据我的错题再出 3 道题”。`
}
