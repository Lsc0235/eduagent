import type {
  AgentUpdateLog,
  CurrentLearningContext,
  LearnerAgentModel,
  LearningRecord,
  ProfileUpdateSuggestion,
  ProjectDefenseResult,
  ProjectReviewResult,
  ProjectSubmission,
  ProjectWorkspace,
  SystemStudyProgress,
  SystemStudyWorkspacePlan,
  UserProfile,
  WeaknessRecoveryPlan,
  WrongQuestion,
} from '../types/personalization'
import {
  buildAgentUpdateLog,
  getDefaultLearnerAgentModel,
  learnerAgentModelToUserProfile,
  updateAgentModelFromLearningRecord,
  updateAgentModelFromWrongQuestions,
  userProfileToLearnerAgentModel,
} from '../utils/learnerAgentEngine'

export const DEFAULT_PROFILE: UserProfile = learnerAgentModelToUserProfile(getDefaultLearnerAgentModel())

const PROFILE_KEY = 'eduagent.learning.profile'
const CONTEXT_KEY = 'eduagent.learning.context'
const WRONGS_KEY = 'eduagent.learning.wrongQuestions'
const RECORDS_KEY = 'eduagent.learning.records'
const SUGGESTION_KEY = 'eduagent.learning.profileSuggestion'
const CHAT_DRAFT_KEY = 'eduagent.learning.chatDraft'

const AGENT_MODEL_KEY = 'edugent_learner_agent_model'
const AGENT_CONTEXT_KEY = 'edugent_current_learning_context'
const AGENT_WRONGS_KEY = 'edugent_wrong_questions'
const AGENT_RECORDS_KEY = 'edugent_learning_records'
const AGENT_LOGS_KEY = 'edugent_agent_update_logs'
const SYSTEM_STUDY_PLAN_KEY = 'edugent_system_study_plan'
const SYSTEM_STUDY_PROGRESS_KEY = 'edugent_system_study_progress'
const PROJECT_WORKSPACE_KEY = 'edugent_project_workspace'
const PROJECT_SUBMISSION_KEY = 'edugent_project_submission'
const PROJECT_REVIEW_KEY = 'edugent_project_review'
const PROJECT_DEFENSE_KEY = 'edugent_project_defense'
const RECOVERY_KEY = 'eduagent.learning.recoveryPlan'

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readJson = <T,>(keys: string | string[], fallback: T): T => {
  if (!canUseStorage()) return fallback
  const keyList = Array.isArray(keys) ? keys : [keys]
  for (const key of keyList) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      continue
    }
  }
  return fallback
}

const writeJson = <T,>(keys: string | string[], value: T) => {
  if (!canUseStorage()) return
  const keyList = Array.isArray(keys) ? keys : [keys]
  keyList.forEach(key => {
    window.localStorage.setItem(key, JSON.stringify(value))
  })
}

const unique = <T,>(items: T[]) => Array.from(new Set(items.filter(Boolean)))

const syncModelWithUserProfile = (profile: UserProfile) => {
  const current = readJson<LearnerAgentModel | null>(AGENT_MODEL_KEY, null)
  const fromProfile = userProfileToLearnerAgentModel(profile, current?.userId || 'default')
  const merged: LearnerAgentModel = current
    ? {
        ...current,
        explicitProfile: {
          ...current.explicitProfile,
          ...fromProfile.explicitProfile,
        },
        behaviorProfile: {
          ...current.behaviorProfile,
          ...fromProfile.behaviorProfile,
        },
        learningStrategy: {
          ...current.learningStrategy,
          ...fromProfile.learningStrategy,
        },
        memory: {
          ...current.memory,
          shortTermGoals: unique([...fromProfile.memory.shortTermGoals, ...current.memory.shortTermGoals]).slice(0, 6),
          longTermGoals: unique([...fromProfile.memory.longTermGoals, ...current.memory.longTermGoals]).slice(0, 6),
          updatedAt: new Date().toISOString(),
        },
      }
    : fromProfile

  writeJson(AGENT_MODEL_KEY, merged)
  return merged
}

export const isMeaningfulProfile = (profile: UserProfile) =>
  Object.values(profile).some(value => value.trim().length > 0) &&
  JSON.stringify(profile) !== JSON.stringify(DEFAULT_PROFILE)

export const readLearnerAgentModel = (): LearnerAgentModel => {
  const stored = readJson<LearnerAgentModel | null>(AGENT_MODEL_KEY, null)
  if (stored) return stored

  const legacyProfile = readJson<UserProfile | null>(PROFILE_KEY, null)
  const model = legacyProfile ? userProfileToLearnerAgentModel(legacyProfile) : getDefaultLearnerAgentModel()
  writeJson(AGENT_MODEL_KEY, model)
  writeJson(PROFILE_KEY, learnerAgentModelToUserProfile(model))
  return model
}

export const saveLearnerAgentModel = (model: LearnerAgentModel) => {
  const nextModel = {
    ...model,
    memory: {
      ...model.memory,
      updatedAt: new Date().toISOString(),
    },
  }
  writeJson(AGENT_MODEL_KEY, nextModel)
  writeJson(PROFILE_KEY, learnerAgentModelToUserProfile(nextModel))
}

export const resetLearnerAgentModel = () => {
  saveLearnerAgentModel(getDefaultLearnerAgentModel())
  writeJson(AGENT_LOGS_KEY, [])
}

export const readAgentUpdateLogs = (): AgentUpdateLog[] => readJson<AgentUpdateLog[]>(AGENT_LOGS_KEY, [])

export const addAgentUpdateLog = (log: AgentUpdateLog) => {
  const next = [log, ...readAgentUpdateLogs().filter(item => item.id !== log.id)].slice(0, 50)
  writeJson(AGENT_LOGS_KEY, next)
}

export const readUserProfile = (): UserProfile => {
  const stored = readJson<UserProfile | null>(PROFILE_KEY, null)
  return stored || learnerAgentModelToUserProfile(readLearnerAgentModel())
}

export const saveUserProfile = (profile: UserProfile) => {
  writeJson(PROFILE_KEY, profile)
  syncModelWithUserProfile(profile)
}

export const buildProfileFromSetup = (setup: Record<string, string>): UserProfile => ({
  knowledgeBase: setup.knowledge_base || DEFAULT_PROFILE.knowledgeBase,
  cognitiveStyle: setup.cognitive_style || DEFAULT_PROFILE.cognitiveStyle,
  learningAbility: setup.learning_ability || DEFAULT_PROFILE.learningAbility,
  errorPreference: setup.error_patterns || DEFAULT_PROFILE.errorPreference,
  learningGoal: setup.learning_goals || DEFAULT_PROFILE.learningGoal,
  interestDirection: setup.interests || DEFAULT_PROFILE.interestDirection,
  learningHabit: setup.learning_habits || DEFAULT_PROFILE.learningHabit,
})

export const profileFromBackendDimensions = (dimensions: Record<string, any> = {}): UserProfile => ({
  knowledgeBase: dimensions.knowledge_base?.value || DEFAULT_PROFILE.knowledgeBase,
  cognitiveStyle: dimensions.cognitive_style?.value || DEFAULT_PROFILE.cognitiveStyle,
  learningAbility: dimensions.learning_ability?.value || DEFAULT_PROFILE.learningAbility,
  errorPreference: dimensions.error_patterns?.value || DEFAULT_PROFILE.errorPreference,
  learningGoal: dimensions.learning_goals?.value || DEFAULT_PROFILE.learningGoal,
  interestDirection: dimensions.interests?.value || DEFAULT_PROFILE.interestDirection,
  learningHabit: dimensions.learning_habits?.value || DEFAULT_PROFILE.learningHabit,
})

const dim = (value: string, source = 'localStorage') => ({ value, confidence: value ? 0.82 : 0, source })

export const profileToBackendDimensions = (profile: UserProfile) => ({
  knowledge_base: dim(profile.knowledgeBase),
  cognitive_style: dim(profile.cognitiveStyle),
  learning_ability: dim(profile.learningAbility),
  error_patterns: dim(profile.errorPreference),
  learning_goals: dim(profile.learningGoal),
  interests: dim(profile.interestDirection),
  learning_habits: dim(profile.learningHabit),
})

export const readCurrentLearningContext = (): CurrentLearningContext | null =>
  readJson<CurrentLearningContext | null>([AGENT_CONTEXT_KEY, CONTEXT_KEY], null)

export const saveCurrentLearningContext = (context: Omit<CurrentLearningContext, 'updatedAt'>) => {
  const next = { ...context, updatedAt: new Date().toISOString() }
  writeJson([AGENT_CONTEXT_KEY, CONTEXT_KEY], next)
}

export const readSystemStudyPlan = (): SystemStudyWorkspacePlan | null =>
  readJson<SystemStudyWorkspacePlan | null>(SYSTEM_STUDY_PLAN_KEY, null)

export const saveSystemStudyPlan = (plan: SystemStudyWorkspacePlan) => {
  writeJson(SYSTEM_STUDY_PLAN_KEY, plan)
}

export const readSystemStudyProgress = (): SystemStudyProgress | null =>
  readJson<SystemStudyProgress | null>(SYSTEM_STUDY_PROGRESS_KEY, null)

export const saveSystemStudyProgress = (progress: SystemStudyProgress) => {
  writeJson(SYSTEM_STUDY_PROGRESS_KEY, progress)
}

export const readProjectWorkspace = (): ProjectWorkspace | null =>
  readJson<ProjectWorkspace | null>(PROJECT_WORKSPACE_KEY, null)

export const saveProjectWorkspace = (workspace: ProjectWorkspace) => {
  writeJson(PROJECT_WORKSPACE_KEY, workspace)
}

export const readProjectSubmission = (): ProjectSubmission | null =>
  readJson<ProjectSubmission | null>(PROJECT_SUBMISSION_KEY, null)

export const saveProjectSubmission = (submission: ProjectSubmission) => {
  writeJson(PROJECT_SUBMISSION_KEY, submission)
}

export const readProjectReviewResult = (): ProjectReviewResult | null =>
  readJson<ProjectReviewResult | null>(PROJECT_REVIEW_KEY, null)

export const saveProjectReviewResult = (result: ProjectReviewResult) => {
  writeJson(PROJECT_REVIEW_KEY, result)
}

export const readProjectDefenseResult = (): ProjectDefenseResult | null =>
  readJson<ProjectDefenseResult | null>(PROJECT_DEFENSE_KEY, null)

export const saveProjectDefenseResult = (result: ProjectDefenseResult) => {
  writeJson(PROJECT_DEFENSE_KEY, result)
}

export const readWrongQuestions = (): WrongQuestion[] => readJson<WrongQuestion[]>([AGENT_WRONGS_KEY, WRONGS_KEY], [])

export const syncAgentFromWrongQuestions = (questions = readWrongQuestions()) => {
  if (questions.length === 0) return
  const nextModel = updateAgentModelFromWrongQuestions(readLearnerAgentModel(), questions)
  saveLearnerAgentModel(nextModel)
  addAgentUpdateLog(buildAgentUpdateLog(
    'wrong_questions',
    '来自错题本的更新',
    `已根据 ${questions.length} 道错题更新薄弱知识点和下一步建议。`,
    questions[0]?.topic,
  ))
}

export const addWrongQuestions = (questions: WrongQuestion[]) => {
  if (questions.length === 0) return
  const existing = readWrongQuestions()
  const byId = new Map(existing.map(question => [question.id, question]))
  questions.forEach(question => byId.set(question.id, question))
  const next = Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  writeJson([AGENT_WRONGS_KEY, WRONGS_KEY], next)
  syncAgentFromWrongQuestions(questions)
}

export const markLocalWrongQuestionMastered = (id: string) => {
  const next = readWrongQuestions().map(question => (
    question.id === id ? { ...question, reviewed: true } : question
  ))
  writeJson([AGENT_WRONGS_KEY, WRONGS_KEY], next)
}

export const clearLocalWrongQuestions = () => writeJson([AGENT_WRONGS_KEY, WRONGS_KEY], [])

export const groupWrongQuestions = (questions = readWrongQuestions()) => {
  const groups = new Map<string, WrongQuestion[]>()
  questions.forEach(question => {
    const key = question.knowledgePoint || question.topic || '未分类'
    groups.set(key, [...(groups.get(key) || []), question])
  })
  return Array.from(groups.entries()).map(([knowledgePoint, items]) => ({
    knowledgePoint,
    questions: items,
    total: items.length,
    mastered: items.filter(item => item.reviewed).length,
  }))
}

export const readLearningRecords = (): LearningRecord[] => readJson<LearningRecord[]>([AGENT_RECORDS_KEY, RECORDS_KEY], [])

export const syncAgentFromLearningRecords = (records = readLearningRecords()) => {
  if (records.length === 0) return
  const latest = records[0]
  const nextModel = updateAgentModelFromLearningRecord(readLearnerAgentModel(), latest)
  saveLearnerAgentModel(nextModel)
  addAgentUpdateLog(buildAgentUpdateLog(
    'learning_record',
    '来自学习记录的更新',
    `已同步「${latest.topic}」学习结果，最近得分 ${latest.score} 分。`,
    latest.topic,
  ))
}

export const addLearningRecord = (record: LearningRecord) => {
  const next = [record, ...readLearningRecords().filter(item => item.id !== record.id)].slice(0, 50)
  writeJson([AGENT_RECORDS_KEY, RECORDS_KEY], next)
  syncAgentFromLearningRecords([record])
}

export const saveLatestProfileSuggestion = (suggestion: ProfileUpdateSuggestion) => {
  writeJson(SUGGESTION_KEY, suggestion)
}

export const readLatestProfileSuggestion = (): ProfileUpdateSuggestion | null =>
  readJson<ProfileUpdateSuggestion | null>(SUGGESTION_KEY, null)

export const applyProfileSuggestion = (profile: UserProfile, suggestion: ProfileUpdateSuggestion): UserProfile => {
  const weaknessText = suggestion.weakness.length > 0
    ? `需重点补强：${suggestion.weakness.join('、')}`
    : profile.errorPreference

  return {
    ...profile,
    learningAbility: suggestion.suggestedLearningAbility || profile.learningAbility,
    errorPreference: weaknessText,
    learningGoal: suggestion.suggestedGoal || profile.learningGoal,
    learningHabit: suggestion.suggestedHabit || profile.learningHabit,
  }
}

export const getLearningOverview = () => {
  const records = readLearningRecords()
  const wrongs = readWrongQuestions()
  const systemPlan = readSystemStudyPlan()
  const systemProgress = readSystemStudyProgress()
  const projectWorkspace = readProjectWorkspace()
  const projectReview = readProjectReviewResult()
  const projectDefense = readProjectDefenseResult()
  const topics = new Set(records.map(record => record.topic).filter(Boolean))
  const averageScore = records.length
    ? Math.round(records.reduce((sum, record) => sum + record.score, 0) / records.length)
    : 0
  const weakPointCounts = wrongs.reduce<Record<string, number>>((acc, question) => {
    acc[question.knowledgePoint] = (acc[question.knowledgePoint] || 0) + 1
    return acc
  }, {})
  const errorTypeCounts = wrongs.reduce<Record<string, number>>((acc, question) => {
    const key = question.errorType || '概念混淆'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const weakPoints = Object.entries(weakPointCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([point]) => point)
    .slice(0, 5)
  const frequentErrorTypes = Object.entries(errorTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type)
    .slice(0, 3)

  return {
    records,
    wrongs,
    topicCount: topics.size,
    completedPlanCount: records.length,
    averageScore,
    wrongCount: wrongs.length,
    weakPoints,
    frequentErrorTypes,
    latestRecord: records[0] || null,
    agentModel: readLearnerAgentModel(),
    agentLogs: readAgentUpdateLogs(),
    systemStudy: {
      plan: systemPlan,
      progress: systemProgress,
      completedStageCount: systemProgress?.completedStageIds.length || 0,
      stageTestCount: systemProgress?.stageTestResults.length || 0,
    },
    project: {
      workspace: projectWorkspace,
      review: projectReview,
      defense: projectDefense,
      completedCount: projectWorkspace?.status === 'completed' ? 1 : 0,
      averageScore: projectReview ? Math.round((projectReview.score + (projectDefense?.score || projectReview.score)) / 2) : 0,
      weakAbilities: [
        ...(projectReview?.weaknesses || []),
        ...(projectDefense && !projectDefense.passed ? ['项目答辩表达'] : []),
      ],
    },
  }
}

export const saveChatDraft = (draft: string) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(CHAT_DRAFT_KEY, draft)
}

export const consumeChatDraft = () => {
  if (!canUseStorage()) return ''
  const draft = window.localStorage.getItem(CHAT_DRAFT_KEY) || ''
  window.localStorage.removeItem(CHAT_DRAFT_KEY)
  return draft
}

export const setChatDraftFromWrongQuestion = (question: {
  question?: string
  knowledge_point?: string
  knowledgePoint?: string
  correct_answer?: string
  correctAnswer?: string
  explanation?: string
  analysis?: string
}) => {
  saveChatDraft(
    `请根据我的错题讲解：${question.question || ''}\n` +
    `知识点：${question.knowledge_point || question.knowledgePoint || '未分类'}\n` +
    `正确答案：${question.correct_answer || question.correctAnswer || ''}\n` +
    `解析：${question.explanation || question.analysis || ''}`
  )
}

export const saveWeaknessRecoveryPlan = (plan: WeaknessRecoveryPlan) => {
  writeJson(RECOVERY_KEY, plan)
}
