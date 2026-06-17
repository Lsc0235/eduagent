import React, { useState } from 'react'
import { Alert, Button, Card, Collapse, Input, Space, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import AgentDiagnosticPanel from '../components/personalization/AgentDiagnosticPanel'
import AgentInterviewPanel from '../components/personalization/AgentInterviewPanel'
import AgentMemoryCard from '../components/personalization/AgentMemoryCard'
import AgentUpdateLogPanel from '../components/personalization/AgentUpdateLog'
import {
  addAgentUpdateLog,
  readAgentUpdateLogs,
  readLearnerAgentModel,
  resetLearnerAgentModel,
  saveLearnerAgentModel,
} from '../services/learningData'
import type { DiagnosticQuestion, InterviewAnswers, LearnerAgentModel } from '../types/personalization'
import {
  buildAgentModelFromInterview,
  buildAgentUpdateLog,
  evaluateDiagnosticResult,
  generateDiagnosticQuestions,
  generateInterviewFollowUps,
} from '../utils/learnerAgentEngine'

const { Paragraph, Text, Title } = Typography
const { TextArea } = Input

const emptyAnswers: InterviewAnswers = {
  recentTopic: '',
  topicReason: '',
  goal: '',
  currentLevel: '',
  desiredOutcome: '',
  foundation: '',
  stuckPoints: '',
  supportPreference: '',
  availableTime: '',
  major: '',
  grade: '',
  projectStyle: '',
  topicUnderstanding: '',
  codingSupport: '',
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'idle' | 'interview' | 'diagnostic' | 'summary'>('idle')
  const [answers, setAnswers] = useState<InterviewAnswers>(emptyAnswers)
  const [agentModel, setAgentModel] = useState<LearnerAgentModel>(readLearnerAgentModel())
  const [draftModel, setDraftModel] = useState<LearnerAgentModel | null>(null)
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<DiagnosticQuestion[]>([])
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState(readAgentUpdateLogs)
  const [manualGoal, setManualGoal] = useState(agentModel.explicitProfile.statedGoal || '')
  const [manualInterest, setManualInterest] = useState(agentModel.explicitProfile.interestDirection || '')
  const [manualResources, setManualResources] = useState(agentModel.learningStrategy.resourcePriority.join('、'))
  const [manualNotes, setManualNotes] = useState(agentModel.memory.agentNotes.join('\n'))
  const [manualCorrection, setManualCorrection] = useState('')

  const refreshFromStorage = () => {
    const model = readLearnerAgentModel()
    setAgentModel(model)
    setManualGoal(model.explicitProfile.statedGoal || '')
    setManualInterest(model.explicitProfile.interestDirection || '')
    setManualResources(model.learningStrategy.resourcePriority.join('、'))
    setManualNotes(model.memory.agentNotes.join('\n'))
    setLogs(readAgentUpdateLogs())
  }

  const startInit = () => {
    setAnswers(emptyAnswers)
    setDiagnosticAnswers({})
    setDiagnosticQuestions([])
    setDraftModel(null)
    setPhase('interview')
  }

  const reinitialize = () => {
    resetLearnerAgentModel()
    addAgentUpdateLog(buildAgentUpdateLog('manual', '重新初始化 Agent', '已重置为默认 Agent 模型。'))
    refreshFromStorage()
    setPhase('interview')
  }

  const createDraftAgent = () => {
    if (!answers.recentTopic.trim() || !answers.goal.trim()) {
      message.warning('请至少填写学习主题和学习目标')
      return
    }
    setSaving(true)
    const nextModel = buildAgentModelFromInterview(answers)
    saveLearnerAgentModel(nextModel)
    addAgentUpdateLog(buildAgentUpdateLog(
      'interview',
      '来自目标访谈的更新',
      `已根据访谈生成初始 Agent，当前主题为「${answers.recentTopic}」。`,
      answers.recentTopic,
    ))
    const nextQuestions = generateDiagnosticQuestions(answers.recentTopic, nextModel)
    setDraftModel(nextModel)
    setDiagnosticQuestions(nextQuestions)
    setDiagnosticAnswers({})
    refreshFromStorage()
    setPhase('diagnostic')
    setSaving(false)
  }

  const submitDiagnostic = () => {
    if (diagnosticQuestions.some(question => !diagnosticAnswers[question.id])) {
      message.warning('请先完成全部诊断题')
      return
    }
    const baseModel = draftModel || agentModel
    const nextModel = evaluateDiagnosticResult(answers.recentTopic, diagnosticAnswers, diagnosticQuestions, baseModel)
    saveLearnerAgentModel(nextModel)
    addAgentUpdateLog(buildAgentUpdateLog(
      'diagnostic',
      '来自诊断测试的更新',
      `完成「${answers.recentTopic}」入门诊断，得分 ${nextModel.diagnosticProfile.diagnosticScore || 0} 分。`,
      answers.recentTopic,
    ))
    refreshFromStorage()
    setPhase('summary')
  }

  const applyManualEdit = () => {
    const nextModel: LearnerAgentModel = {
      ...agentModel,
      explicitProfile: {
        ...agentModel.explicitProfile,
        statedGoal: manualGoal,
        interestDirection: manualInterest,
      },
      learningStrategy: {
        ...agentModel.learningStrategy,
        resourcePriority: manualResources.split(/[、,，]/).map(item => item.trim()).filter(Boolean),
      },
      memory: {
        ...agentModel.memory,
        agentNotes: [
          ...manualNotes.split('\n').map(item => item.trim()).filter(Boolean),
          ...(manualCorrection.trim() ? [`手动修正：${manualCorrection.trim()}`] : []),
        ].slice(0, 10),
        updatedAt: new Date().toISOString(),
      },
    }
    saveLearnerAgentModel(nextModel)
    addAgentUpdateLog(buildAgentUpdateLog(
      'manual',
      '手动修正 Agent 记忆',
      manualCorrection.trim() || '已手动更新学习目标、兴趣方向或资源偏好。',
      nextModel.explicitProfile.recentTopic,
    ))
    refreshFromStorage()
    message.success('Agent 记忆已更新')
  }

  const followUps = generateInterviewFollowUps(answers)
  const showSummary = phase === 'summary' || phase === 'idle'

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Title level={3} style={{ marginBottom: 8 }}>个人学习 Agent 中心</Title>
              <Paragraph style={{ marginBottom: 0 }}>
                通过访谈、诊断、错题和学习记录，持续理解你的学习状态。
              </Paragraph>
            </div>
            <Alert
              type="info"
              showIcon
              message="欢迎建立你的个人学习 Agent。"
              description="我会通过目标访谈和知识诊断，了解你的学习目标、基础水平、薄弱点和适合的学习方式，然后为你生成专属学习策略。"
            />
            <Space wrap>
              <Button type="primary" onClick={startInit}>开始 Agent 初始化</Button>
              <Button onClick={reinitialize}>重新初始化</Button>
              <Button onClick={() => setPhase('summary')}>查看当前 Agent 记忆</Button>
            </Space>
          </Space>
        </Card>

        {phase === 'interview' && (
          <AgentInterviewPanel
            answers={answers}
            followUps={followUps}
            loading={saving}
            onChange={(key, value) => setAnswers(prev => ({ ...prev, [key]: value }))}
            onSubmit={createDraftAgent}
          />
        )}

        {phase === 'diagnostic' && (
          <AgentDiagnosticPanel
            topic={answers.recentTopic}
            questions={diagnosticQuestions}
            answers={diagnosticAnswers}
            onAnswer={(questionId, value) => setDiagnosticAnswers(prev => ({ ...prev, [questionId]: value }))}
            onSubmit={submitDiagnostic}
          />
        )}

        {showSummary && (
          <>
            <AgentMemoryCard model={agentModel} />
            <Space wrap>
              <Button type="primary" onClick={() => navigate(`/learning?topic=${encodeURIComponent(agentModel.explicitProfile.recentTopic || agentModel.diagnosticProfile.currentTopic || '')}`)}>
                进入开始学习
              </Button>
              <Button onClick={() => setPhase('interview')}>修正这条记忆</Button>
              <Button onClick={() => {
                const topic = agentModel.explicitProfile.recentTopic || agentModel.diagnosticProfile.currentTopic
                if (!topic) {
                  message.info('当前还没有主题可重诊断，请先开始初始化')
                  return
                }
                setDiagnosticQuestions(generateDiagnosticQuestions(topic, agentModel))
                setDiagnosticAnswers({})
                setAnswers(prev => ({ ...prev, recentTopic: topic }))
                setDraftModel(agentModel)
                setPhase('diagnostic')
              }}>
                重新诊断
              </Button>
            </Space>
          </>
        )}

        <Collapse
          items={[
            {
              key: 'manual-edit',
              label: '高级编辑 / 手动修正 Agent 记忆',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Input value={manualGoal} placeholder="学习目标" onChange={event => setManualGoal(event.target.value)} />
                  <Input value={manualInterest} placeholder="兴趣方向" onChange={event => setManualInterest(event.target.value)} />
                  <Input value={manualResources} placeholder="资源偏好，使用 、 分隔" onChange={event => setManualResources(event.target.value)} />
                  <TextArea rows={4} value={manualNotes} placeholder="Agent 备注" onChange={event => setManualNotes(event.target.value)} />
                  <TextArea rows={3} value={manualCorrection} placeholder="错误的推断或需要修正的点" onChange={event => setManualCorrection(event.target.value)} />
                  <Button type="primary" onClick={applyManualEdit}>保存手动修正</Button>
                </Space>
              ),
            },
          ]}
        />

        <AgentUpdateLogPanel logs={logs} />

        <Card title="当前 Agent 记忆摘要">
          <Space direction="vertical" size={8}>
            <Text>当前主题：{agentModel.explicitProfile.recentTopic || agentModel.diagnosticProfile.currentTopic || '暂无'}</Text>
            <Text>推荐模式：{agentModel.learningStrategy.recommendedMode}</Text>
            <Text>诊断得分：{agentModel.diagnosticProfile.diagnosticScore ?? '暂无'}</Text>
            <Text>最近记录更新时间：{agentModel.memory.updatedAt.replace('T', ' ').slice(0, 16)}</Text>
          </Space>
        </Card>
      </Space>
    </div>
  )
}

export default ProfilePage
