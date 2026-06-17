import {
  createFallbackBooks,
  generateProjectTask as generateLegacyProjectTask,
  generateSingleTopicPlan as generateLegacySingleTopicPlan,
  generateSystemStudyEnhancement,
  getLearningModeLabel,
} from './personalizationEngine'
import type {
  AgentUpdateLog,
  CurrentLearningContext,
  DiagnosticQuestion,
  InterviewAnswers,
  LearnerAgentModel,
  LearningMode,
  LearningRecord,
  LearningStrategySummary,
  ProjectDefenseResult,
  ProjectSubmission,
  ProjectTask,
  ProjectReviewResult,
  ProjectWorkspace,
  StageTestQuestion,
  SystemStudyPlan,
  SystemStudyProgress,
  SystemStudyWorkspacePlan,
  UserProfile,
  WrongQuestion,
} from '../types/personalization'

const DEFAULT_PROFILE: UserProfile = {
  knowledgeBase: '基础一般，已掌握 Python 和线性代数入门，抽象模型仍需分步骤讲解',
  cognitiveStyle: '偏好图解、代码示例和案例拆解',
  learningAbility: '理解速度中等，适合短路径学习后立即练习',
  errorPreference: '容易混淆公式含义、模型训练流程和关键术语',
  learningGoal: '两周内掌握机器学习核心概念，并完成一个可展示的小项目',
  interestDirection: '智能教育、推荐系统、金融风控',
  learningHabit: '晚上学习 60 分钟，喜欢先总结再做题',
}

const normalize = (value?: string) => (value || '').trim()
const includesAny = (value: string, keywords: string[]) => keywords.some(keyword => value.includes(keyword))
const unique = <T,>(items: T[]) => Array.from(new Set(items.filter(Boolean)))

const derivePreferredResources = (...inputs: string[]) => {
  const text = inputs.join(' ')
  const resources: string[] = []
  if (includesAny(text, ['图', '图解', '结构', '流程'])) resources.push('图解')
  if (includesAny(text, ['代码', '编程', '实现'])) resources.push('代码')
  if (includesAny(text, ['案例', '项目', '实战'])) resources.push('案例')
  if (includesAny(text, ['题', '测评', '考试'])) resources.push('练习')
  if (resources.length === 0) resources.push('图解', '代码', '案例')
  return unique(resources)
}

const mergeUserProfile = (profile?: Partial<UserProfile>): UserProfile => ({
  ...DEFAULT_PROFILE,
  ...profile,
})

export const learnerAgentModelToUserProfile = (model: LearnerAgentModel): UserProfile => {
  const goal = model.explicitProfile.statedGoal || model.memory.shortTermGoals[0] || DEFAULT_PROFILE.learningGoal
  const topic = model.explicitProfile.recentTopic || model.diagnosticProfile.currentTopic || model.memory.recentTopics[0] || '当前知识点'
  const knowledgeBase = [
    model.diagnosticProfile.masteredConcepts.length > 0 ? `已掌握：${model.diagnosticProfile.masteredConcepts.slice(0, 3).join('、')}` : '',
    model.diagnosticProfile.weakConcepts.length > 0 ? `需补强：${model.diagnosticProfile.weakConcepts.slice(0, 3).join('、')}` : '',
  ].filter(Boolean).join('；') || DEFAULT_PROFILE.knowledgeBase

  return mergeUserProfile({
    knowledgeBase,
    cognitiveStyle: model.behaviorProfile.preferredContentByBehavior.join('、') || DEFAULT_PROFILE.cognitiveStyle,
    learningAbility: model.learningStrategy.explanationDepth === 'simple'
      ? '当前更适合分步骤、少术语的讲解'
      : model.learningStrategy.explanationDepth === 'advanced'
        ? '可以承接更完整的原理和综合应用'
        : DEFAULT_PROFILE.learningAbility,
    errorPreference: model.errorProfile.repeatedMistakes.join('、') || model.errorProfile.wrongKnowledgePoints.join('、') || DEFAULT_PROFILE.errorPreference,
    learningGoal: goal,
    interestDirection: model.explicitProfile.interestDirection || DEFAULT_PROFILE.interestDirection,
    learningHabit: model.explicitProfile.availableTime || model.behaviorProfile.averageSessionTime || DEFAULT_PROFILE.learningHabit,
  })
}

export const userProfileToLearnerAgentModel = (profile: UserProfile, userId = 'default'): LearnerAgentModel => ({
  userId,
  explicitProfile: {
    statedGoal: profile.learningGoal,
    interestDirection: profile.interestDirection,
    availableTime: profile.learningHabit,
    preferredResources: derivePreferredResources(profile.cognitiveStyle, profile.learningGoal, profile.interestDirection),
    recentTopic: '',
  },
  diagnosticProfile: {
    estimatedLevel: includesAny(profile.knowledgeBase, ['零基础', '薄弱', '入门']) ? 'beginner' : 'basic',
    masteredConcepts: includesAny(profile.knowledgeBase, ['Python']) ? ['Python 基础'] : [],
    weakConcepts: [],
    misconceptions: [],
  },
  behaviorProfile: {
    preferredContentByBehavior: derivePreferredResources(profile.cognitiveStyle),
    frequentlySkippedContent: [],
    repeatedViewedContent: [],
    averageSessionTime: profile.learningHabit,
    learningPersistence: 'medium',
  },
  errorProfile: {
    frequentErrorTypes: ['概念混淆'],
    wrongKnowledgePoints: [],
    repeatedMistakes: normalize(profile.errorPreference) ? [profile.errorPreference] : [],
    latestWrongQuestions: [],
  },
  learningStrategy: {
    recommendedMode: includesAny(profile.learningGoal, ['项目', '实战']) ? 'project_task' : 'single_topic',
    explanationDepth: includesAny(profile.learningAbility, ['分步骤', '慢']) ? 'simple' : 'normal',
    resourcePriority: derivePreferredResources(profile.cognitiveStyle),
    practiceDifficulty: includesAny(profile.knowledgeBase, ['薄弱', '零基础', '入门']) ? 'easy' : 'medium',
    nextBestAction: '先完成一次主题诊断，再进入个性化学习模式。',
  },
  memory: {
    longTermGoals: normalize(profile.interestDirection) ? [profile.interestDirection] : [],
    shortTermGoals: normalize(profile.learningGoal) ? [profile.learningGoal] : [],
    recentTopics: [],
    agentNotes: [],
    updatedAt: new Date().toISOString(),
  },
})

export const getDefaultLearnerAgentModel = (): LearnerAgentModel => userProfileToLearnerAgentModel(DEFAULT_PROFILE)

const deriveTopicConcepts = (topic: string) => {
  if (includesAny(topic, ['CNN', '卷积'])) {
    return ['卷积核', '特征图', '池化层', 'CNN 与普通网络区别', '代码参数理解']
  }
  if (includesAny(topic, ['神经网络'])) {
    return ['神经元', '激活函数', '前向传播', '反向传播', '过拟合']
  }
  if (includesAny(topic, ['线性回归'])) {
    return ['损失函数', '梯度下降', '特征与标签', '参数更新', '泛化误差']
  }
  return ['核心定义', '输入输出', '关键步骤', '常见误区', '应用场景']
}

export const buildAgentModelFromInterview = (answers: InterviewAnswers): LearnerAgentModel => {
  const goalText = [answers.goal, answers.desiredOutcome, answers.projectStyle].filter(Boolean).join('；')
  const notes = [
    answers.topicReason ? `学习动机：${answers.topicReason}` : '',
    answers.stuckPoints ? `当前容易卡住：${answers.stuckPoints}` : '',
    answers.supportPreference ? `期待系统帮助：${answers.supportPreference}` : '',
    answers.topicUnderstanding ? `主题自评：${answers.topicUnderstanding}` : '',
    answers.codingSupport ? `代码支持偏好：${answers.codingSupport}` : '',
  ].filter(Boolean)
  const preferredResources = derivePreferredResources(
    normalize(answers.supportPreference),
    normalize(answers.projectStyle),
    normalize(answers.stuckPoints),
    normalize(answers.codingSupport),
  )

  const model = getDefaultLearnerAgentModel()
  model.explicitProfile = {
    major: normalize(answers.major),
    grade: normalize(answers.grade),
    statedGoal: goalText || DEFAULT_PROFILE.learningGoal,
    interestDirection: normalize(answers.recentTopic) || DEFAULT_PROFILE.interestDirection,
    availableTime: normalize(answers.availableTime) || '每次学习 45-90 分钟',
    preferredResources,
    recentTopic: normalize(answers.recentTopic),
  }
  model.diagnosticProfile.currentTopic = normalize(answers.recentTopic)
  model.behaviorProfile.preferredContentByBehavior = preferredResources
  model.behaviorProfile.averageSessionTime = normalize(answers.availableTime) || '45-90 分钟'
  model.learningStrategy.recommendedMode = includesAny(goalText, ['项目', '代码', '运行']) ? 'project_task' : 'single_topic'
  model.learningStrategy.explanationDepth = includesAny(answers.currentLevel, ['完全不会', '刚入门', '零基础']) ? 'simple' : 'normal'
  model.learningStrategy.resourcePriority = preferredResources
  model.learningStrategy.practiceDifficulty = includesAny(answers.currentLevel, ['完全不会', '零基础']) ? 'easy' : 'medium'
  model.memory.shortTermGoals = unique([normalize(answers.goal), normalize(answers.desiredOutcome)].filter(Boolean))
  model.memory.longTermGoals = normalize(goalText) ? [goalText] : []
  model.memory.agentNotes = notes
  model.memory.recentTopics = normalize(answers.recentTopic) ? [answers.recentTopic] : []
  model.memory.updatedAt = new Date().toISOString()
  model.learningStrategy.nextBestAction = `先完成「${answers.recentTopic || '当前主题'}」的入门诊断，再进入推荐学习模式。`
  return model
}

export const generateInterviewFollowUps = (answers: Partial<InterviewAnswers>) => {
  const followUps: string[] = []
  const goal = normalize(answers.goal)
  const topic = normalize(answers.recentTopic)
  const support = normalize(answers.supportPreference)

  if (includesAny(goal, ['项目'])) {
    followUps.push('你这个项目更偏理论展示，还是需要做出一个能运行的代码结果？')
  }
  if (includesAny(topic, ['CNN', '卷积'])) {
    followUps.push('你是否已经理解卷积核、特征图和池化层的基本含义？')
  }
  if (includesAny(support, ['代码']) || includesAny(normalize(answers.currentLevel), ['不会写代码'])) {
    followUps.push('你更希望系统提供完整代码，还是逐步补全代码练习？')
  }

  return followUps.slice(0, 3)
}

export const generateDiagnosticQuestions = (topic: string, model: LearnerAgentModel): DiagnosticQuestion[] => {
  const concepts = deriveTopicConcepts(topic)
  const simple = model.learningStrategy.explanationDepth === 'simple'

  return [
    {
      id: `${topic}-diag-1`,
      type: 'concept',
      question: `关于「${concepts[0]}」，下面哪项最符合它在「${topic}」中的作用？`,
      options: [
        `A. 它决定了输入如何被局部处理`,
        'B. 它只负责展示结果，不参与计算',
        'C. 它和训练过程完全无关',
        'D. 它只在最终输出时出现',
      ],
      answer: 'A',
      explanation: `${concepts[0]}通常对应局部特征提取或关键处理单元。`,
      knowledgePoint: concepts[0],
      difficulty: simple ? '入门' : '中等',
    },
    {
      id: `${topic}-diag-2`,
      type: 'true_false',
      question: `判断：只要记住术语，不理解「${concepts[1]}」和输入输出关系，也能真正学会「${topic}」。`,
      options: ['A. 正确', 'B. 错误'],
      answer: 'B',
      explanation: `理解 ${concepts[1]} 与输入输出关系，才能把概念迁移到题目和代码里。`,
      knowledgePoint: concepts[1],
      difficulty: '入门',
    },
    {
      id: `${topic}-diag-3`,
      type: 'choice',
      question: `如果你要向同学解释「${concepts[2]}」，哪种说法更合适？`,
      options: [
        `A. 它是 ${topic} 中用于整理或压缩关键信息的步骤`,
        'B. 它的存在只是为了让术语更多',
        'C. 它和结果质量没有任何关系',
        'D. 只在考试时才需要记住',
      ],
      answer: 'A',
      explanation: `${concepts[2]}往往承担提炼重点、控制信息规模或稳定表示的作用。`,
      knowledgePoint: concepts[2],
      difficulty: '中等',
    },
    {
      id: `${topic}-diag-4`,
      type: 'code',
      question: `做「${topic}」代码实验时，如果参数改了但你说不清为什么结果变化，最可能暴露了哪类问题？`,
      options: [
        'A. 对关键参数和流程含义理解不稳',
        'B. 输入法有问题',
        'C. 代码颜色不好看',
        'D. 只要能运行就不需要理解',
      ],
      answer: 'A',
      explanation: `参数变化无法解释，通常意味着对 ${concepts[4]} 或整体流程的理解还不牢。`,
      knowledgePoint: concepts[4],
      difficulty: simple ? '入门' : '中等',
    },
    {
      id: `${topic}-diag-5`,
      type: 'scenario',
      question: `如果要把「${topic}」用于一个真实场景，第一步最应该先确认什么？`,
      options: [
        'A. 问题的输入、输出和评价标准',
        'B. 先背一堆术语',
        'C. 直接找最复杂的模型',
        'D. 跳过数据和反馈',
      ],
      answer: 'A',
      explanation: '先确认问题定义，后续的模型、资源和练习才能真正对齐目标。',
      knowledgePoint: concepts[3],
      difficulty: '中等',
    },
  ]
}

const normalizeAnswer = (answer?: string) => {
  const text = normalize(answer).toUpperCase()
  const match = text.match(/^[A-D]/)
  return match ? match[0] : text
}

const getEstimatedLevel = (score: number): LearnerAgentModel['diagnosticProfile']['estimatedLevel'] => {
  if (score >= 90) return 'advanced'
  if (score >= 75) return 'intermediate'
  if (score >= 60) return 'basic'
  if (score >= 35) return 'beginner'
  return 'unknown'
}

const getExplanationDepth = (level: LearnerAgentModel['diagnosticProfile']['estimatedLevel']) => {
  if (level === 'advanced' || level === 'intermediate') return 'advanced'
  if (level === 'basic') return 'normal'
  return 'simple'
}

const getPracticeDifficulty = (score: number, weakCount: number) => {
  if (score >= 85 && weakCount <= 1) return 'hard'
  if (score >= 60 && weakCount <= 2) return 'medium'
  return 'easy'
}

export const decideLearningMode = (topic: string, model: LearnerAgentModel): LearningMode => {
  const goal = `${model.explicitProfile.statedGoal || ''} ${model.memory.shortTermGoals.join(' ')}`
  const preferredResources = model.learningStrategy.resourcePriority.join(' ')
  const weakCount = model.diagnosticProfile.weakConcepts.length
  const score = model.diagnosticProfile.diagnosticScore || 0
  const repeatedBasics = model.errorProfile.repeatedMistakes.filter(item => includesAny(item, ['基础', '概念', '流程'])).length
  const longStudy = includesAny(model.explicitProfile.availableTime || '', ['长期', '每周', '90', '120', '系统'])

  if (weakCount >= 3 || repeatedBasics >= 2 || score < 60) return 'single_topic'
  if (includesAny(goal, ['系统', '课程', '长期']) && longStudy) return 'system_study'
  if (includesAny(goal, ['项目', '实战', '作品', '代码']) && score >= 60) return 'project_task'
  if (includesAny(preferredResources, ['代码', '案例']) && includesAny(goal, ['项目', '实践'])) return 'project_task'
  if (topic.length > 8 || includesAny(goal, ['体系', '全面'])) return 'system_study'
  return 'single_topic'
}

export const generateNextBestAction = (topic: string, model: LearnerAgentModel) => {
  const mode = decideLearningMode(topic, model)
  const weakFocus = model.diagnosticProfile.weakConcepts[0] || model.errorProfile.wrongKnowledgePoints[0]

  if (mode === 'single_topic' && weakFocus) {
    return `建议先完成「${weakFocus}」相关的单点速学，再回到「${topic}」继续系统学习。`
  }
  if (mode === 'project_task') {
    return `你已经具备进入「${topic}」项目任务的基础，可以先做一个最小可运行案例。`
  }
  return `建议把「${topic}」拆成教材主线 + 阶段测评，按照系统学习方式推进。`
}

export const evaluateDiagnosticResult = (
  topic: string,
  answers: Record<string, string>,
  questions: DiagnosticQuestion[],
  model: LearnerAgentModel,
): LearnerAgentModel => {
  const mastered: string[] = []
  const weak: string[] = []
  const misconceptions: string[] = []

  questions.forEach(question => {
    const isCorrect = normalizeAnswer(answers[question.id]) === normalizeAnswer(question.answer)
    if (isCorrect) {
      mastered.push(question.knowledgePoint)
    } else {
      weak.push(question.knowledgePoint)
      misconceptions.push(`对「${question.knowledgePoint}」的理解还不稳定，需补充：${question.explanation}`)
    }
  })

  const score = Math.round((mastered.length / Math.max(questions.length, 1)) * 100)
  const nextModel: LearnerAgentModel = {
    ...model,
    diagnosticProfile: {
      currentTopic: topic,
      estimatedLevel: getEstimatedLevel(score),
      masteredConcepts: unique([...model.diagnosticProfile.masteredConcepts, ...mastered]),
      weakConcepts: unique([...model.diagnosticProfile.weakConcepts, ...weak]),
      misconceptions: unique([...model.diagnosticProfile.misconceptions, ...misconceptions]).slice(0, 6),
      diagnosticScore: score,
      lastDiagnosticAt: new Date().toISOString(),
    },
  }

  const recommendedMode = decideLearningMode(topic, nextModel)
  nextModel.learningStrategy = {
    recommendedMode,
    explanationDepth: getExplanationDepth(nextModel.diagnosticProfile.estimatedLevel),
    resourcePriority: unique([
      ...nextModel.learningStrategy.resourcePriority,
      ...nextModel.behaviorProfile.preferredContentByBehavior,
    ]),
    practiceDifficulty: getPracticeDifficulty(score, weak.length),
    nextBestAction: generateNextBestAction(topic, nextModel),
  }
  nextModel.memory.recentTopics = unique([topic, ...nextModel.memory.recentTopics]).slice(0, 8)
  nextModel.memory.agentNotes = unique([
    `诊断完成：${topic}，得分 ${score} 分`,
    ...nextModel.memory.agentNotes,
  ]).slice(0, 10)
  nextModel.memory.updatedAt = new Date().toISOString()
  return nextModel
}

export const generateLearningStrategySummary = (topic: string, model: LearnerAgentModel): LearningStrategySummary => {
  const recommendedMode = decideLearningMode(topic, model)
  const weakPoints = model.diagnosticProfile.weakConcepts.slice(0, 2)
  const goal = model.explicitProfile.statedGoal || model.memory.shortTermGoals[0] || '尽快学懂并能应用'
  const reasons = [
    weakPoints.length > 0 ? `当前薄弱点集中在 ${weakPoints.join('、')}` : '',
    model.errorProfile.wrongKnowledgePoints.length > 0 ? `最近错题暴露出 ${model.errorProfile.wrongKnowledgePoints.slice(0, 2).join('、')}` : '',
    model.behaviorProfile.preferredContentByBehavior.length > 0 ? `你更适合 ${model.behaviorProfile.preferredContentByBehavior.join('、')} 这样的资源形式` : '',
  ].filter(Boolean)

  return {
    recommendedMode,
    reason: `围绕「${topic}」的本次学习，Agent 结合你的目标「${goal}」和当前诊断状态，推荐使用【${getLearningModeLabel(recommendedMode)}】。${reasons[0] ? `重点原因是：${reasons[0]}。` : ''}`,
    strategies: unique([
      weakPoints[0] ? `先补强「${weakPoints[0]}」，再推进主线学习。` : '先建立整体框架，再进入例题和代码。',
      model.learningStrategy.resourcePriority[0] ? `优先安排${model.learningStrategy.resourcePriority[0]}资源，减少无效切换。` : '优先使用图解和案例帮助理解。',
      model.learningStrategy.nextBestAction,
    ]).slice(0, 3),
  }
}

export const generateSingleTopicPlan = (topic: string, model: LearnerAgentModel) => {
  const plan = generateLegacySingleTopicPlan(topic, learnerAgentModelToUserProfile(model))
  const summary = generateLearningStrategySummary(topic, model)
  const weakPoints = model.diagnosticProfile.weakConcepts.slice(0, 2)

  return {
    ...plan,
    recommendedMode: 'single_topic' as const,
    reason: summary.reason,
    learningGoals: unique([
      weakPoints[0] ? `优先补强「${weakPoints[0]}」` : '',
      ...plan.learningGoals,
    ]).slice(0, 4),
    nextTopics: unique([
      ...weakPoints.map(point => `${point} 强化练习`),
      ...plan.nextTopics,
    ]).slice(0, 4),
  }
}

export const generateSystemStudyPlan = (topic: string, model: LearnerAgentModel): SystemStudyPlan => {
  const books = generateSystemStudyEnhancement(
    topic,
    learnerAgentModelToUserProfile(model),
    createFallbackBooks(topic),
  )

  return {
    topic,
    recommendedBooks: books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      level: book.level,
      score: book.score,
      benefit: book.benefit,
      personalizedReason: book.personalized_reason,
      fitReason: book.profile_fit,
      ebookUrl: book.ebook_url,
    })),
    longTermPlan: [
      {
        stage: '第 1 周',
        duration: '3-4 次学习',
        goal: `建立「${topic}」整体结构，吃透核心概念`,
        output: '一张导图 + 一份概念笔记',
      },
      {
        stage: '第 2 周',
        duration: '3-4 次学习',
        goal: `围绕 ${model.diagnosticProfile.weakConcepts[0] || topic} 做案例和练习`,
        output: '错题整理 + 最小代码实验',
      },
      {
        stage: '第 3 周',
        duration: '2-3 次学习',
        goal: '完成阶段测评并决定是否切换到项目任务',
        output: '阶段测评结果 + 下一步计划',
      },
    ],
    videoSuggestions: [
      `先看「${topic}」入门导学视频，建立整体框架`,
      `再看围绕 ${model.diagnosticProfile.weakConcepts[0] || '薄弱点'} 的专题讲解`,
      '最后配合教材章节做短时复盘',
    ],
    codeSuggestions: [
      `把「${topic}」拆成最小可运行示例`,
      '每完成一章，补一个 20-30 行的小实验',
      '对关键参数写一句自己的解释，避免只会照抄',
    ],
    milestoneAssessments: [
      '完成教材前 2 章后做一次概念诊断',
      '完成中段练习后做一次错题复盘',
      '完成全书主线后做一次综合测评',
    ],
  }
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

export const generateSystemStudyWorkspacePlan = (
  topic: string,
  selectedBook: { id: string; title: string; author?: string },
  model: LearnerAgentModel,
): SystemStudyWorkspacePlan => {
  const weak = model.diagnosticProfile.weakConcepts[0] || `${topic}核心概念`
  return {
    id: `system-${selectedBook.id}-${Date.now()}`,
    topic,
    selectedBook,
    totalDays: 14,
    stages: [
      {
        id: 'stage-1',
        title: '建立整体框架',
        dayRange: '第 1-3 天',
        startDay: 1,
        endDay: 3,
        objective: `用教材建立「${topic}」的核心概念、输入输出和学习地图。`,
        chapters: ['导论章节', '核心定义', '基础例题'],
        tasks: ['阅读教材对应章节', '查看推荐视频', '整理一页概念笔记', '完成阶段练习', '参加阶段测试'],
        recommendedVideos: [
          { title: `${topic} 入门框架讲解`, reason: '先建立全局结构，避免直接陷入细节。', duration: '18 分钟', type: 'concept' },
          { title: `${topic} 可视化案例演示`, reason: '用案例把抽象概念落到输入输出。', duration: '22 分钟', type: 'case' },
        ],
        codeResources: [
          {
            title: `${topic} 最小概念实验`,
            description: '用最少代码跑通输入、处理和输出。',
            language: 'Python',
            difficulty: '入门',
            codePreview: `data = load_demo_data()\nprint(data[0])\n# 观察 ${topic} 的输入和输出`,
          },
        ],
        testPlan: { questionCount: 5, focus: ['核心定义', '输入输出', '常见误区'], passScore: 70 },
        completed: false,
      },
      {
        id: 'stage-2',
        title: '补强薄弱点与代码理解',
        dayRange: '第 4-8 天',
        startDay: 4,
        endDay: 8,
        objective: `围绕「${weak}」补强，并用代码理解关键参数。`,
        chapters: ['关键流程', '参数解释', '代码案例'],
        tasks: ['复盘薄弱点', '查看代码实操视频', '完成配套代码', '记录 2 个易错点', '参加阶段测试'],
        recommendedVideos: [
          { title: `${weak} 专题补弱`, reason: '匹配当前 Agent 识别出的薄弱点。', duration: '20 分钟', type: 'review' },
          { title: `${topic} 代码参数逐步讲解`, reason: '帮助把概念和代码参数对应起来。', duration: '25 分钟', type: 'code' },
        ],
        codeResources: [
          {
            title: `${topic} 参数修改实验`,
            description: '修改关键参数，观察结果如何变化。',
            language: 'Python',
            difficulty: '中等',
            codePreview: `model = build_model()\nmodel.set_param('learning_rate', 0.01)\nresult = model.run()\nprint(result)`,
          },
        ],
        testPlan: { questionCount: 5, focus: [weak, '代码参数理解', '流程迁移'], passScore: 75 },
        completed: false,
      },
      {
        id: 'stage-3',
        title: '综合应用与阶段总结',
        dayRange: '第 9-14 天',
        startDay: 9,
        endDay: 14,
        objective: `把「${topic}」迁移到小案例中，形成可复盘的学习报告。`,
        chapters: ['综合案例', '拓展应用', '总结测评'],
        tasks: ['完成综合案例', '整理错题和薄弱点', '写学习总结', '完成综合测评', '决定下一步学习模式'],
        recommendedVideos: [
          { title: `${topic} 综合案例复盘`, reason: '帮助你从概念过渡到应用场景。', duration: '28 分钟', type: 'case' },
          { title: `${topic} 阶段复习`, reason: '集中回看高频错题知识点。', duration: '15 分钟', type: 'review' },
        ],
        codeResources: [
          {
            title: `${topic} 综合小实验`,
            description: '把前两阶段的概念和代码串成一个小任务。',
            language: 'Python',
            difficulty: '进阶',
            codePreview: `pipeline = build_pipeline(topic='${topic}')\nreport = pipeline.evaluate()\nprint(report.summary())`,
          },
        ],
        testPlan: { questionCount: 5, focus: ['综合应用', '结果解释', '下一步迁移'], passScore: 80 },
        completed: false,
      },
    ],
  }
}

export const createDefaultSystemStudyProgress = (plan: SystemStudyWorkspacePlan): SystemStudyProgress => ({
  planId: plan.id,
  topic: plan.topic,
  selectedBookId: plan.selectedBook.id,
  currentDay: 1,
  currentStageId: plan.stages[0]?.id || '',
  completedStageIds: [],
  completedTaskIds: [],
  progressPercent: 0,
  stageProgressPercent: 0,
  startDate: new Date().toISOString().slice(0, 10),
  expectedEndDate: addDays(new Date(), plan.totalDays),
  status: 'not_started',
  stageTestResults: [],
})

export const generateSystemStageTest = (topic: string, stage: SystemStudyWorkspacePlan['stages'][number]): StageTestQuestion[] => {
  const focus = stage.testPlan.focus
  return [
    {
      id: `${stage.id}-q1`,
      type: 'choice',
      question: `本阶段学习「${topic}」时，最先要确认哪件事？`,
      options: ['A. 输入输出和核心作用', 'B. 只背术语', 'C. 跳过案例', 'D. 不做反馈'],
      answer: 'A',
      analysis: '输入输出和核心作用是进入教材主线的第一层框架。',
      knowledgePoint: focus[0] || `${topic}核心定义`,
    },
    {
      id: `${stage.id}-q2`,
      type: 'true_false',
      question: `判断：如果无法解释「${focus[0] || topic}」，也可以直接进入下一阶段。`,
      options: ['A. 正确', 'B. 错误'],
      answer: 'B',
      analysis: '阶段推进必须先解决当前重点，否则后面会积累理解债。',
      knowledgePoint: focus[0] || `${topic}阶段重点`,
    },
    {
      id: `${stage.id}-q3`,
      type: 'concept',
      question: `下面哪种学习方式更适合巩固「${focus[1] || topic}」？`,
      options: ['A. 画流程并做一个小例子', 'B. 只看标题', 'C. 不记录错因', 'D. 跳过练习'],
      answer: 'A',
      analysis: '流程图和小例子能同时检查概念理解与应用迁移。',
      knowledgePoint: focus[1] || `${topic}流程理解`,
    },
    {
      id: `${stage.id}-q4`,
      type: 'code',
      question: '如果代码结果变化但你无法说明原因，最该回看什么？',
      options: ['A. 参数含义和处理流程', 'B. 页面颜色', 'C. 文件名长度', 'D. 跳过测试'],
      answer: 'A',
      analysis: '代码理解的核心是能解释参数、输入和结果之间的关系。',
      knowledgePoint: focus[2] || `${topic}代码理解`,
    },
    {
      id: `${stage.id}-q5`,
      type: 'application',
      question: `完成「${stage.title}」后，下一步最合理的动作是什么？`,
      options: ['A. 用错题和总结决定是否进入下一阶段', 'B. 直接删除记录', 'C. 不看反馈', 'D. 放弃教材'],
      answer: 'A',
      analysis: '系统学习需要阶段反馈来推进，不是一次性浏览完内容。',
      knowledgePoint: `${topic}阶段复盘`,
    },
  ]
}

export const evaluateStageTest = (
  answers: Record<string, string>,
  questions: StageTestQuestion[],
  passScore: number,
) => {
  const wrongQuestions = questions.filter(question => normalizeAnswer(answers[question.id]) !== normalizeAnswer(question.answer))
  const score = Math.round(((questions.length - wrongQuestions.length) / Math.max(questions.length, 1)) * 100)
  return {
    score,
    passed: score >= passScore,
    mastered: questions.filter(question => !wrongQuestions.includes(question)).map(question => question.knowledgePoint),
    weak: wrongQuestions.map(question => question.knowledgePoint),
    wrongQuestions,
  }
}

export const generateProjectTask = (topic: string, model: LearnerAgentModel): ProjectTask => {
  const baseTask = generateLegacyProjectTask(topic, learnerAgentModelToUserProfile(model))
  const weakPoints = model.diagnosticProfile.weakConcepts.slice(0, 3)
  const diagnosticScore = model.diagnosticProfile.diagnosticScore
  const hasDiagnostic = typeof diagnosticScore === 'number'
  const needsWarmup = weakPoints.length >= 2 || (hasDiagnostic && diagnosticScore < 60)

  return {
    ...baseTask,
    fitReason: needsWarmup
      ? `${baseTask.fitReason} 但当前诊断显示你还需要先补强 ${weakPoints.join('、') || '基础概念'}，所以项目会先从轻量任务开始。`
      : !hasDiagnostic
        ? `${baseTask.fitReason} 当前还没有完成正式诊断，因此项目会先采用默认的最小可运行路径。`
      : `${baseTask.fitReason} 当前诊断结果允许你直接进入项目化练习。`,
    prerequisites: unique([
      ...weakPoints,
      ...baseTask.prerequisites,
    ]),
    steps: unique([
      needsWarmup && weakPoints.length > 0 ? `先补强：${weakPoints.join('、')}，再开始项目主线` : '',
      ...baseTask.steps,
    ]),
  }
}

export const generateProjectWorkspace = (topic: string, model: LearnerAgentModel): ProjectWorkspace => {
  const task = generateProjectTask(topic, model)
  return {
    id: `project-${Date.now()}`,
    topic,
    projectName: task.projectName,
    projectGoal: task.projectGoal,
    fitReason: task.fitReason,
    expectedTime: '2 天 / 3 小时',
    finalOutputs: ['一个可运行的代码示例', '一份项目 README', '一份结果解释', '一份项目自评报告'],
    stages: [
      {
        id: 'project-stage-1',
        title: '理解任务与输入输出',
        goal: '明确项目要解决什么问题，以及输入数据和输出结果是什么。',
        estimatedTime: '35 分钟',
        tasks: ['明确输入数据是什么', '明确输出结果是什么', `理解 ${topic} 在项目中的作用`, '完成阶段检查'],
        resources: ['项目讲义', '数据模板', '常见错误'],
        checkQuestion: `你能否用一句话说明 ${topic} 在这个项目中负责什么？`,
        completed: false,
      },
      {
        id: 'project-stage-2',
        title: '准备数据与模型结构',
        goal: '把数据处理、模型结构和关键参数串起来。',
        estimatedTime: '45 分钟',
        tasks: ['准备 mock 数据', '阅读代码模板', '标记关键参数', '完成阶段检查'],
        resources: ['代码模板', '代码解释', '数据模板'],
        checkQuestion: '你能否解释代码里最关键的 2 个参数？',
        completed: false,
      },
      {
        id: 'project-stage-3',
        title: '运行代码并观察结果',
        goal: '通过结果观察理解模型是否真的完成任务。',
        estimatedTime: '45 分钟',
        tasks: ['阅读运行步骤', '模拟运行结果', '记录错误案例', '完成阶段检查'],
        resources: ['运行步骤', '常见错误', '结果解释模板'],
        checkQuestion: '如果结果不稳定，你会优先检查哪一步？',
        completed: false,
      },
      {
        id: 'project-stage-4',
        title: '解释结果并完成项目报告',
        goal: '提交 README、代码说明、结果解释和自我反思。',
        estimatedTime: '55 分钟',
        tasks: ['整理 README', '补充结果解释', '完成自我反思', '提交项目审核'],
        resources: ['项目 README 模板', '自评报告模板', '答辩问题清单'],
        checkQuestion: '你能否说明这个项目的局限和下一步改进？',
        completed: false,
      },
    ],
    codePreview: task.codeExample,
    status: 'not_started',
    completedTaskIds: [],
    currentStageId: 'project-stage-1',
  }
}

const scoreText = (value: string, keywords: string[]) => includesAny(value, keywords) ? 86 : 58

export const reviewProjectSubmission = (
  project: ProjectWorkspace,
  submission: ProjectSubmission,
): ProjectReviewResult => {
  const completenessScore = Math.min(100, 40 + submission.readmeText.length / 3 + submission.resultExplanation.length / 4)
  const understandingScore = scoreText(`${submission.readmeText} ${submission.resultExplanation}`, [project.topic, '输入', '输出', '流程', '参数'])
  const codeScore = submission.codeText && submission.codeText.length > 40 ? 82 : 58
  const explanationScore = submission.resultExplanation.length > 40 ? 82 : 55
  const summaryScore = submission.selfReflection.length > 30 ? 80 : 52
  const score = Math.round((Math.min(completenessScore, 100) + understandingScore + codeScore + explanationScore + summaryScore) / 5)

  return {
    projectId: project.id,
    score,
    passed: score >= 70,
    completenessScore: Math.round(Math.min(completenessScore, 100)),
    understandingScore,
    codeScore,
    explanationScore,
    summaryScore,
    strengths: score >= 70 ? ['项目材料完整', '能解释核心流程'] : ['已经提交基础材料'],
    weaknesses: score >= 70 ? ['可以继续补充边界案例'] : ['README、代码说明或结果解释仍不够完整'],
    revisionSuggestions: score >= 70
      ? ['补一段项目局限和下一步优化方向']
      : ['README 至少说明目标、输入、输出和流程', '代码区需要给出关键代码片段', '结果解释需要说明为什么这样判断'],
    reviewedAt: new Date().toISOString(),
  }
}

export const generateProjectDefenseQuestions = (project: ProjectWorkspace) => [
  `这个项目的输入和输出分别是什么？`,
  `${project.topic} 在项目中起到什么作用？`,
  `如果结果不理想，你会优先检查哪一步？`,
  '你认为这个项目下一步可以如何改进？',
]

export const evaluateProjectDefense = (
  project: ProjectWorkspace,
  answers: Record<string, string>,
): ProjectDefenseResult => {
  const questions = generateProjectDefenseQuestions(project)
  const evaluated = questions.map(question => {
    const answer = answers[question] || ''
    const passed = answer.length >= 10 && includesAny(answer, [project.topic, '输入', '输出', '检查', '改进', '流程', '结果'])
    return {
      question,
      userAnswer: answer || '未作答',
      feedback: passed ? '回答能覆盖关键理解点。' : '回答还偏短，建议补充输入输出、流程或改进方向。',
      passed,
    }
  })
  const score = Math.round((evaluated.filter(item => item.passed).length / Math.max(evaluated.length, 1)) * 100)
  return {
    projectId: project.id,
    score,
    passed: score >= 60,
    answers: evaluated,
  }
}

export const updateAgentModelFromLearningRecord = (model: LearnerAgentModel, learningRecord: LearningRecord): LearnerAgentModel => {
  const nextModel: LearnerAgentModel = {
    ...model,
    diagnosticProfile: {
      ...model.diagnosticProfile,
      masteredConcepts: unique([...model.diagnosticProfile.masteredConcepts, ...learningRecord.masteredKnowledgePoints]),
      weakConcepts: unique([...model.diagnosticProfile.weakConcepts, ...learningRecord.wrongKnowledgePoints]).slice(0, 8),
    },
    behaviorProfile: {
      ...model.behaviorProfile,
      learningPersistence: learningRecord.score >= 80 ? 'high' : learningRecord.score >= 60 ? 'medium' : 'needs_support',
      lastActiveAt: learningRecord.createdAt,
    },
    learningStrategy: {
      ...model.learningStrategy,
      recommendedMode: learningRecord.score >= 80 && learningRecord.mode === 'single_topic' ? 'project_task' : model.learningStrategy.recommendedMode,
      nextBestAction: learningRecord.wrongKnowledgePoints[0]
        ? `针对「${learningRecord.wrongKnowledgePoints[0]}」做一次补弱练习，再继续推进 ${learningRecord.topic}。`
        : `你可以把「${learningRecord.topic}」推进到下一层任务或项目实践。`,
    },
    memory: {
      ...model.memory,
      recentTopics: unique([learningRecord.topic, ...model.memory.recentTopics]).slice(0, 8),
      agentNotes: unique([
        `学习记录更新：${learningRecord.topic}，${learningRecord.score} 分`,
        ...model.memory.agentNotes,
      ]).slice(0, 10),
      updatedAt: new Date().toISOString(),
    },
  }
  return nextModel
}

export const updateAgentModelFromWrongQuestions = (model: LearnerAgentModel, wrongQuestions: WrongQuestion[]): LearnerAgentModel => {
  const wrongKnowledgePoints = unique(wrongQuestions.map(item => item.knowledgePoint))
  const errorTypes = unique(wrongQuestions.map(item => item.errorType || '概念混淆'))
  const latestWrongQuestions = wrongQuestions.slice(0, 5).map(item => item.question)
  const repeatedMistakes = unique([
    ...model.errorProfile.repeatedMistakes,
    ...wrongQuestions.map(item => `${item.knowledgePoint}：${item.analysis.slice(0, 24)}`),
  ]).slice(0, 8)

  const nextModel: LearnerAgentModel = {
    ...model,
    diagnosticProfile: {
      ...model.diagnosticProfile,
      weakConcepts: unique([...model.diagnosticProfile.weakConcepts, ...wrongKnowledgePoints]).slice(0, 8),
      misconceptions: unique([
        ...model.diagnosticProfile.misconceptions,
        ...wrongQuestions.map(item => `错题反映：${item.analysis}`),
      ]).slice(0, 8),
    },
    errorProfile: {
      frequentErrorTypes: unique([...model.errorProfile.frequentErrorTypes, ...errorTypes]).slice(0, 5),
      wrongKnowledgePoints: unique([...model.errorProfile.wrongKnowledgePoints, ...wrongKnowledgePoints]).slice(0, 8),
      repeatedMistakes,
      latestWrongQuestions,
    },
    learningStrategy: {
      ...model.learningStrategy,
      practiceDifficulty: 'easy',
      nextBestAction: wrongKnowledgePoints[0]
        ? `优先回到「${wrongKnowledgePoints[0]}」做单点速学和同类练习。`
        : model.learningStrategy.nextBestAction,
    },
    memory: {
      ...model.memory,
      agentNotes: unique([
        `错题更新：${wrongKnowledgePoints.join('、') || '新增错题'}`,
        ...model.memory.agentNotes,
      ]).slice(0, 10),
      updatedAt: new Date().toISOString(),
    },
  }
  return nextModel
}

export const buildAgentUpdateLog = (
  source: AgentUpdateLog['source'],
  title: string,
  summary: string,
  relatedTopic?: string,
): AgentUpdateLog => ({
  id: `${source}-${Date.now()}`,
  source,
  title,
  summary,
  createdAt: new Date().toISOString(),
  relatedTopic,
})

export const summarizeAgentModel = (model: LearnerAgentModel) => ({
  currentGoal: model.explicitProfile.statedGoal || model.memory.shortTermGoals[0] || '暂无明确目标',
  knowledgeState: model.diagnosticProfile.masteredConcepts.length > 0
    ? `已具备 ${model.diagnosticProfile.masteredConcepts.slice(0, 3).join('、')} 等基础`
    : '当前仍在建立基础认知',
  weakPoints: model.diagnosticProfile.weakConcepts,
  suitableStyle: model.behaviorProfile.preferredContentByBehavior.join(' → ') || '图解 → 练习 → 反馈',
  recommendedMode: getLearningModeLabel(model.learningStrategy.recommendedMode),
  nextBestAction: model.learningStrategy.nextBestAction,
  updatedAt: model.memory.updatedAt,
})

export const generateAgentAwareChatResponse = (
  message: string,
  context: CurrentLearningContext | null,
  model: LearnerAgentModel,
  wrongs: WrongQuestion[],
  records: LearningRecord[],
) => {
  const topic = context?.topic || model.diagnosticProfile.currentTopic || model.explicitProfile.recentTopic || '当前知识点'
  const weakPoints = unique([
    ...model.diagnosticProfile.weakConcepts,
    ...wrongs.slice(0, 3).map(item => item.knowledgePoint),
  ]).slice(0, 3)
  const latestScore = records[0]?.score
  const style = model.behaviorProfile.preferredContentByBehavior
  const responseStyle = includesAny(style.join(' '), ['代码'])
    ? '我会优先给你最小代码示例，再配逐行解释。'
    : includesAny(style.join(' '), ['图解'])
      ? '我会先画出结构和流程，再落到题目与例子。'
      : '我会先讲直觉，再补专业表达和练习建议。'

  return [
    `我会按你的个人学习 Agent 来回答这个问题。`,
    '',
    `当前知识点：${topic}`,
    `当前模式：${context ? getLearningModeLabel(context.mode) : getLearningModeLabel(model.learningStrategy.recommendedMode)}`,
    `当前目标：${model.explicitProfile.statedGoal || model.memory.shortTermGoals[0] || '尽快学懂并能应用'}`,
    weakPoints.length > 0 ? `当前薄弱点：${weakPoints.join('、')}` : '当前薄弱点：暂未明显暴露',
    latestScore !== undefined ? `最近一次得分：${latestScore} 分` : '',
    '',
    responseStyle,
    '',
    `针对你的问题“${message}”，建议按这条顺序理解：`,
    `1. 先说清 ${topic} 的输入、处理过程和输出。`,
    `2. 把 ${weakPoints[0] || '关键概念'} 放进一个例子或小代码里验证。`,
    `3. 最后用一道针对性练习检查自己是否真的掌握。`,
    '',
    `Agent 当前建议：${model.learningStrategy.nextBestAction}`,
  ].filter(Boolean).join('\n')
}
