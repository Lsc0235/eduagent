export type LearningMode = 'single_topic' | 'system_study' | 'project_task'
export type EstimatedLevel = 'unknown' | 'beginner' | 'basic' | 'intermediate' | 'advanced'
export type ExplanationDepth = 'simple' | 'normal' | 'advanced'
export type PracticeDifficulty = 'easy' | 'medium' | 'hard'

export interface UserProfile {
  knowledgeBase: string
  cognitiveStyle: string
  learningAbility: string
  errorPreference: string
  learningGoal: string
  interestDirection: string
  learningHabit: string
}

export interface LearnerAgentModel {
  userId: string
  explicitProfile: {
    major?: string
    grade?: string
    statedGoal?: string
    interestDirection?: string
    availableTime?: string
    preferredResources: string[]
    recentTopic?: string
  }
  diagnosticProfile: {
    currentTopic?: string
    estimatedLevel: EstimatedLevel
    masteredConcepts: string[]
    weakConcepts: string[]
    misconceptions: string[]
    diagnosticScore?: number
    lastDiagnosticAt?: string
  }
  behaviorProfile: {
    preferredContentByBehavior: string[]
    frequentlySkippedContent: string[]
    repeatedViewedContent: string[]
    averageSessionTime?: string
    learningPersistence?: string
    lastActiveAt?: string
  }
  errorProfile: {
    frequentErrorTypes: string[]
    wrongKnowledgePoints: string[]
    repeatedMistakes: string[]
    latestWrongQuestions: string[]
  }
  learningStrategy: {
    recommendedMode: LearningMode
    explanationDepth: ExplanationDepth
    resourcePriority: string[]
    practiceDifficulty: PracticeDifficulty
    nextBestAction: string
  }
  memory: {
    longTermGoals: string[]
    shortTermGoals: string[]
    recentTopics: string[]
    agentNotes: string[]
    updatedAt: string
  }
}

export interface InterviewAnswers {
  recentTopic: string
  topicReason: string
  goal: string
  currentLevel: string
  desiredOutcome: string
  foundation: string
  stuckPoints: string
  supportPreference: string
  availableTime?: string
  major?: string
  grade?: string
  projectStyle?: string
  topicUnderstanding?: string
  codingSupport?: string
}

export interface DiagnosticQuestion {
  id: string
  type: 'concept' | 'true_false' | 'choice' | 'code' | 'scenario'
  question: string
  options: string[]
  answer: string
  explanation: string
  knowledgePoint: string
  difficulty: string
}

export interface LearningStrategySummary {
  recommendedMode: LearningMode
  reason: string
  strategies: string[]
}

export interface SystemStudyPlan {
  topic: string
  recommendedBooks: Array<{
    id: string
    title: string
    author: string
    level: string
    score: number
    benefit: string
    personalizedReason: string
    fitReason: string
    ebookUrl?: string
  }>
  longTermPlan: Array<{
    stage: string
    duration: string
    goal: string
    output: string
  }>
  videoSuggestions: string[]
  codeSuggestions: string[]
  milestoneAssessments: string[]
}

export interface SystemStudyWorkspacePlan {
  id: string
  topic: string
  selectedBook: {
    id: string
    title: string
    author?: string
  }
  totalDays: number
  stages: Array<{
    id: string
    title: string
    dayRange: string
    startDay: number
    endDay: number
    objective: string
    chapters: string[]
    tasks: string[]
    recommendedVideos: Array<{
      title: string
      reason: string
      duration: string
      type: 'concept' | 'case' | 'code' | 'review'
    }>
    codeResources: Array<{
      title: string
      description: string
      language: string
      difficulty: string
      codePreview: string
    }>
    testPlan: {
      questionCount: number
      focus: string[]
      passScore: number
    }
    completed: boolean
  }>
}

export interface SystemStudyProgress {
  planId: string
  topic: string
  selectedBookId: string
  currentDay: number
  currentStageId: string
  completedStageIds: string[]
  completedTaskIds: string[]
  progressPercent: number
  stageProgressPercent: number
  startDate: string
  expectedEndDate: string
  lastStudyDate?: string
  status: 'not_started' | 'in_progress' | 'ahead' | 'on_track' | 'behind' | 'completed'
  stageTestResults: Array<{
    stageId: string
    score: number
    passed: boolean
    wrongKnowledgePoints: string[]
    completedAt: string
  }>
}

export interface StageTestQuestion {
  id: string
  type: 'choice' | 'true_false' | 'concept' | 'code' | 'application'
  question: string
  options: string[]
  answer: string
  analysis: string
  knowledgePoint: string
}

export type ProjectStatus = 'not_started' | 'in_progress' | 'ready_to_submit' | 'submitted' | 'needs_revision' | 'completed'

export interface ProjectWorkspace {
  id: string
  topic: string
  projectName: string
  projectGoal: string
  fitReason: string
  expectedTime: string
  finalOutputs: string[]
  stages: Array<{
    id: string
    title: string
    goal: string
    estimatedTime: string
    tasks: string[]
    resources: string[]
    checkQuestion: string
    completed: boolean
  }>
  codePreview: string
  status: ProjectStatus
  completedTaskIds: string[]
  currentStageId: string
}

export interface ProjectSubmission {
  projectId: string
  topic: string
  submittedAt: string
  readmeText: string
  codeText?: string
  resultExplanation: string
  screenshotNote?: string
  attachmentNames?: string[]
  selfReflection: string
}

export interface ProjectReviewResult {
  projectId: string
  score: number
  passed: boolean
  completenessScore: number
  understandingScore: number
  codeScore: number
  explanationScore: number
  summaryScore: number
  strengths: string[]
  weaknesses: string[]
  revisionSuggestions: string[]
  reviewedAt: string
}

export interface ProjectDefenseResult {
  projectId: string
  score: number
  passed: boolean
  answers: Array<{
    question: string
    userAnswer: string
    feedback: string
    passed: boolean
  }>
}

export interface AgentUpdateLog {
  id: string
  source: 'interview' | 'diagnostic' | 'learning_record' | 'wrong_questions' | 'evaluation' | 'chat' | 'manual'
  title: string
  summary: string
  createdAt: string
  relatedTopic?: string
}

export interface CurrentLearningContext {
  topic: string
  mode: LearningMode
  selectedBook?: string
  currentPlanId?: string
  updatedAt: string
}

export interface PersonalizedResource {
  type: string
  title: string
  reason: string
  contentPreview: string
}

export interface PersonalizedExercise {
  id: string
  type: string
  question: string
  options?: string[]
  answer: string
  analysis: string
  knowledgePoint: string
  difficulty: string
}

export interface PersonalizedPlan {
  topic: string
  recommendedMode: LearningMode
  reason: string
  learningGoals: string[]
  learningPath: Array<{
    step: number
    title: string
    duration: string
    description: string
    resourceType: string
  }>
  explanations: {
    beginner: string
    analogy: string
    professional: string
  }
  resources: PersonalizedResource[]
  exercises: PersonalizedExercise[]
  nextTopics: string[]
}

export interface ProjectTask {
  topic: string
  projectName: string
  projectGoal: string
  fitReason: string
  prerequisites: string[]
  background: string
  steps: string[]
  codeExample: string
  checklist: string[]
  extensions: string[]
}

export interface WrongQuestion {
  id: string
  topic: string
  question: string
  userAnswer: string
  correctAnswer: string
  analysis: string
  knowledgePoint: string
  difficulty: string
  errorType?: string
  source: LearningMode | 'diagnostic'
  createdAt: string
  reviewed?: boolean
}

export interface LearningRecord {
  id: string
  topic: string
  mode: LearningMode
  score: number
  completedSteps: number
  totalSteps: number
  wrongKnowledgePoints: string[]
  masteredKnowledgePoints: string[]
  createdAt: string
}

export interface ProfileUpdateSuggestion {
  id: string
  createdAt: string
  mastered: string[]
  weakness: string[]
  suggestedProfileChange: string
  suggestedLearningAbility?: string
  suggestedGoal?: string
  suggestedHabit?: string
}

export interface ExerciseEvaluationResult {
  score: number
  correctCount: number
  wrongCount: number
  masteredKnowledgePoints: string[]
  weakKnowledgePoints: string[]
  wrongQuestions: WrongQuestion[]
  profileUpdateSuggestion: ProfileUpdateSuggestion
}

export interface WeaknessRecoveryPlan {
  reviewPoints: string[]
  sequence: string[]
  exercises: PersonalizedExercise[]
  resources: PersonalizedResource[]
  returnTopic: string
}
