import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, Col, Collapse, Progress, Radio, Row, Space, Tag, Typography, message } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import BackToLearningButton from '../components/personalization/BackToLearningButton'
import {
  addLearningRecord,
  addWrongQuestions,
  readLearnerAgentModel,
  readSystemStudyPlan,
  readSystemStudyProgress,
  saveChatDraft,
  saveCurrentLearningContext,
  saveSystemStudyPlan,
  saveSystemStudyProgress,
} from '../services/learningData'
import type { LearningRecord, StageTestQuestion, SystemStudyProgress, SystemStudyWorkspacePlan, WrongQuestion } from '../types/personalization'
import { createDefaultSystemStudyProgress, evaluateStageTest, generateSystemStageTest, generateSystemStudyPlan, generateSystemStudyWorkspacePlan } from '../utils/learnerAgentEngine'

const { Paragraph, Text, Title } = Typography

const statusLabel: Record<SystemStudyProgress['status'], string> = {
  not_started: '未开始',
  in_progress: '进行中',
  ahead: '超前',
  on_track: '正常',
  behind: '落后',
  completed: '已完成',
}

const videoTypeLabel: Record<string, string> = {
  concept: '概念讲解',
  case: '案例演示',
  code: '代码实操',
  review: '阶段复习',
}

const getStageWorkIds = (stage: SystemStudyWorkspacePlan['stages'][number]) => [
  ...stage.tasks.map((_, index) => `${stage.id}-task-${index}`),
  ...stage.recommendedVideos.map((_, index) => `${stage.id}-video-${index}`),
  ...stage.codeResources.map((_, index) => `${stage.id}-code-${index}`),
]

const loadWorkspaceState = (topic: string, bookId: string) => {
  const storedPlan = readSystemStudyPlan()
  const storedProgress = readSystemStudyProgress()
  if (storedPlan && storedProgress && (!topic || storedPlan.topic === topic)) {
    return { plan: storedPlan, progress: storedProgress }
  }
  if (!topic) return { plan: null, progress: null }

  const model = readLearnerAgentModel()
  const recommendation = generateSystemStudyPlan(topic, model)
  const book = recommendation.recommendedBooks.find(item => item.id === bookId) || recommendation.recommendedBooks[0]
  const generatedPlan = generateSystemStudyWorkspacePlan(topic, {
    id: book.id,
    title: book.title,
    author: book.author,
  }, model)
  const generatedProgress = createDefaultSystemStudyProgress(generatedPlan)
  saveSystemStudyPlan(generatedPlan)
  saveSystemStudyProgress(generatedProgress)
  return { plan: generatedPlan, progress: generatedProgress }
}

const recalcProgress = (plan: SystemStudyWorkspacePlan, progress: SystemStudyProgress): SystemStudyProgress => {
  const currentStage = plan.stages.find(stage => stage.id === progress.currentStageId) || plan.stages[0]
  const allWorkIds = plan.stages.flatMap(getStageWorkIds)
  const currentWorkIds = currentStage ? getStageWorkIds(currentStage) : []
  const completedWork = progress.completedTaskIds.filter(id => allWorkIds.includes(id)).length
  const stageCompletedWork = progress.completedTaskIds.filter(id => currentWorkIds.includes(id)).length
  const stageTestWeight = progress.completedStageIds.includes(currentStage?.id || '') ? 1 : 0
  const totalUnits = allWorkIds.length + plan.stages.length
  const completedUnits = completedWork + progress.completedStageIds.length
  const progressPercent = Math.round((completedUnits / Math.max(totalUnits, 1)) * 100)
  const stageProgressPercent = Math.round(((stageCompletedWork + stageTestWeight) / Math.max(currentWorkIds.length + 1, 1)) * 100)
  return {
    ...progress,
    progressPercent,
    stageProgressPercent,
    status: progressPercent >= 100 ? 'completed' : progress.status === 'not_started' ? 'not_started' : 'on_track',
    lastStudyDate: new Date().toISOString(),
  }
}

const SystemStudyWorkspacePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const topic = new URLSearchParams(location.search).get('topic') || ''
  const bookId = new URLSearchParams(location.search).get('book') || ''
  const initialWorkspace = loadWorkspaceState(topic, bookId)
  const [plan] = useState(initialWorkspace.plan)
  const [progress, setProgress] = useState(initialWorkspace.progress)
  const [testQuestions, setTestQuestions] = useState<StageTestQuestion[]>([])
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<ReturnType<typeof evaluateStageTest> | null>(null)
  const [explainedCodeId, setExplainedCodeId] = useState('')

  useEffect(() => {
    if (!plan || !progress) return
    saveCurrentLearningContext({
      topic: plan.topic,
      mode: 'system_study',
      selectedBook: plan.selectedBook.title,
      currentPlanId: plan.id,
    })
  }, [plan, progress])

  if (!plan || !progress || (topic && plan.topic !== topic)) {
    return (
      <div style={{ padding: 24, maxWidth: 1120, margin: '0 auto' }}>
        <BackToLearningButton topic={topic} label="返回系统学习" />
        <Alert type="warning" showIcon message="还没有系统学习计划" description="请先在系统学习页选择一本教材生成学习计划。" style={{ marginTop: 16 }} />
      </div>
    )
  }

  const currentStage = plan.stages.find(stage => stage.id === progress.currentStageId) || plan.stages[0]
  const completed = progress.status === 'completed' || progress.completedStageIds.length === plan.stages.length
  const averageScore = progress.stageTestResults.length
    ? Math.round(progress.stageTestResults.reduce((sum, item) => sum + item.score, 0) / progress.stageTestResults.length)
    : 0

  const updateProgress = (nextProgress: SystemStudyProgress) => {
    const recalced = recalcProgress(plan, nextProgress)
    setProgress(recalced)
    saveSystemStudyProgress(recalced)
  }

  const startStage = () => {
    updateProgress({
      ...progress,
      status: 'in_progress',
      lastStudyDate: new Date().toISOString(),
    })
    addLearningRecord({
      id: `system-stage-start-${Date.now()}`,
      topic: plan.topic,
      mode: 'system_study',
      score: 60,
      completedSteps: progress.completedTaskIds.length,
      totalSteps: plan.stages.flatMap(getStageWorkIds).length,
      wrongKnowledgePoints: [],
      masteredKnowledgePoints: [currentStage.title],
      createdAt: new Date().toISOString(),
    })
    message.success('已开始当前阶段学习')
  }

  const toggleWork = (id: string, checked: boolean) => {
    const nextIds = checked
      ? Array.from(new Set([...progress.completedTaskIds, id]))
      : progress.completedTaskIds.filter(item => item !== id)
    updateProgress({
      ...progress,
      completedTaskIds: nextIds,
      status: progress.status === 'not_started' ? 'in_progress' : progress.status,
    })
    message.success(checked ? '已更新学习进度' : '已取消完成标记')
  }

  const askAssistant = (question: string) => {
    saveChatDraft(question)
    navigate('/chat')
  }

  const startTest = () => {
    setTestQuestions(generateSystemStageTest(plan.topic, currentStage))
    setTestAnswers({})
    setTestResult(null)
    message.success('阶段测试已生成')
  }

  const submitTest = () => {
    if (testQuestions.some(question => !testAnswers[question.id])) {
      message.warning('请先完成全部阶段测试题')
      return
    }
    const result = evaluateStageTest(testAnswers, testQuestions, currentStage.testPlan.passScore)
    setTestResult(result)

    const wrongs: WrongQuestion[] = result.wrongQuestions.map(question => ({
      id: `${question.id}-${Date.now()}`,
      topic: plan.topic,
      question: question.question,
      userAnswer: testAnswers[question.id] || '未作答',
      correctAnswer: question.answer,
      analysis: question.analysis,
      knowledgePoint: question.knowledgePoint,
      difficulty: '阶段测试',
      errorType: '系统学习阶段测试错题',
      source: 'system_study',
      createdAt: new Date().toISOString(),
    }))
    addWrongQuestions(wrongs)

    const nextCompletedStages = result.passed
      ? Array.from(new Set([...progress.completedStageIds, currentStage.id]))
      : progress.completedStageIds
    const nextStage = result.passed
      ? plan.stages.find(stage => !nextCompletedStages.includes(stage.id))
      : currentStage
    const nextProgress = recalcProgress(plan, {
      ...progress,
      currentStageId: nextStage?.id || currentStage.id,
      currentDay: nextStage?.startDay || plan.totalDays,
      completedStageIds: nextCompletedStages,
      status: nextCompletedStages.length === plan.stages.length ? 'completed' : progress.status === 'not_started' ? 'in_progress' : progress.status,
      stageTestResults: [
        ...progress.stageTestResults.filter(item => item.stageId !== currentStage.id),
        {
          stageId: currentStage.id,
          score: result.score,
          passed: result.passed,
          wrongKnowledgePoints: result.weak,
          completedAt: new Date().toISOString(),
        },
      ],
    })
    setProgress(nextProgress)
    saveSystemStudyProgress(nextProgress)

    const record: LearningRecord = {
      id: `system-test-${Date.now()}`,
      topic: plan.topic,
      mode: 'system_study',
      score: result.score,
      completedSteps: nextCompletedStages.length,
      totalSteps: plan.stages.length,
      wrongKnowledgePoints: result.weak,
      masteredKnowledgePoints: result.mastered,
      createdAt: new Date().toISOString(),
    }
    addLearningRecord(record)
    message[result.passed ? 'success' : 'warning'](result.passed ? '阶段测试通过，已推进到下一阶段' : '阶段测试未通过，请先补弱后重测')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space wrap>
          <BackToLearningButton topic={plan.topic} label="返回开始学习" />
          <Button onClick={() => navigate(`/learn/system?topic=${encodeURIComponent(plan.topic)}`)}>返回系统学习</Button>
        </Space>

        <Card>
          <Title level={3} style={{ marginBottom: 8 }}>{plan.selectedBook.title} · 系统学习工作台</Title>
          <Paragraph style={{ marginBottom: 0 }}>
            基于你的学习状态，系统已为你生成教材学习路径、阶段任务、配套资源和测评安排。
          </Paragraph>
        </Card>

        <Card title="学习进度总览">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}><Text>当前教材：<strong>{plan.selectedBook.title}</strong></Text></Col>
            <Col xs={24} md={8}><Text>当前知识点：<strong>{plan.topic}</strong></Text></Col>
            <Col xs={24} md={8}><Text>预计完成时间：<strong>{plan.totalDays} 天</strong></Text></Col>
            <Col xs={24} md={8}><Text>当前进度：第 {progress.currentDay} 天 / 共 {plan.totalDays} 天</Text></Col>
            <Col xs={24} md={8}><Text>当前阶段：{currentStage.title}</Text></Col>
            <Col xs={24} md={8}><Text>预计结束日期：{progress.expectedEndDate}</Text></Col>
            <Col xs={24} md={8}><Text>当前状态：<Tag color="blue">{statusLabel[progress.status]}</Tag></Text></Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Text strong>总完成度：{progress.progressPercent}%</Text>
            <Progress percent={progress.progressPercent} />
            <Text strong>当前阶段进度：{progress.stageProgressPercent}%</Text>
            <Progress percent={progress.stageProgressPercent} strokeColor="#1d4ed8" />
          </div>
          <Space wrap style={{ marginTop: 12 }}>
            <Button type="primary" onClick={startStage}>开始阶段学习</Button>
            <Button onClick={() => {
              toggleWork(`${currentStage.id}-task-today`, true)
              message.success('今日完成状态已记录')
            }}>
              标记今日完成
            </Button>
          </Space>
        </Card>

        {completed ? (
          <Card title="系统学习完成报告">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}><Text>总学习天数：{plan.totalDays} 天</Text></Col>
              <Col xs={24} md={8}><Text>完成阶段数：{progress.completedStageIds.length}</Text></Col>
              <Col xs={24} md={8}><Text>平均测试分数：{averageScore || '暂无'}</Text></Col>
            </Row>
            <Paragraph style={{ marginTop: 12 }}>
              掌握较好的内容：{progress.stageTestResults.flatMap(item => item.wrongKnowledgePoints).length === 0 ? plan.topic : '阶段核心概念已完成闭环'}
            </Paragraph>
            <Paragraph>仍需加强内容：{progress.stageTestResults.flatMap(item => item.wrongKnowledgePoints).join('、') || '暂无明显薄弱点'}</Paragraph>
            <Space wrap>
              <Button type="primary" onClick={() => navigate(`/learn/project-workspace?topic=${encodeURIComponent(plan.topic)}`)}>进入项目任务</Button>
              <Button onClick={() => message.success('综合测评已加入下一轮计划')}>生成综合测评</Button>
              <Button onClick={() => {
                const latestResult = progress.stageTestResults[progress.stageTestResults.length - 1]
                navigate(`/learn/single-topic?topic=${encodeURIComponent(latestResult?.wrongKnowledgePoints[0] || plan.topic)}`)
              }}>
                复习薄弱点
              </Button>
              <Button onClick={() => navigate('/evaluation')}>查看学习评估</Button>
              <Button onClick={() => askAssistant(`请根据我的系统学习完成报告，给出 ${plan.topic} 的下一步建议`)}>问对话助手</Button>
            </Space>
          </Card>
        ) : (
          <>
            <Card title="当前阶段学习任务">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert type="info" showIcon message={`${currentStage.title} · ${currentStage.dayRange}`} description={currentStage.objective} />
                <Text>推荐章节：{currentStage.chapters.join('、')}</Text>
                {currentStage.tasks.map((task, index) => {
                  const id = `${currentStage.id}-task-${index}`
                  return (
                    <Checkbox key={id} checked={progress.completedTaskIds.includes(id)} onChange={event => toggleWork(id, event.target.checked)}>
                      {task}
                    </Checkbox>
                  )
                })}
              </Space>
            </Card>

            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}>
                <Card title="推荐视频" style={{ height: '100%' }}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {currentStage.recommendedVideos.map((video, index) => {
                      const id = `${currentStage.id}-video-${index}`
                      return (
                        <Card key={id} size="small">
                          <Space direction="vertical" size={6}>
                            <Space wrap><Tag color="blue">{videoTypeLabel[video.type]}</Tag><Text strong>{video.title}</Text></Space>
                            <Text>{video.reason}</Text>
                            <Text type="secondary">预计时长：{video.duration}</Text>
                            <Space wrap>
                              <Button size="small" onClick={() => toggleWork(id, true)}>标记已看</Button>
                              <Button size="small" onClick={() => askAssistant(`请结合我的学习进度讲解视频：${video.title}`)}>问对话助手</Button>
                            </Space>
                          </Space>
                        </Card>
                      )
                    })}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="配套代码" style={{ height: '100%' }}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {currentStage.codeResources.map((code, index) => {
                      const id = `${currentStage.id}-code-${index}`
                      return (
                        <Card key={id} size="small">
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Space wrap><Tag color="orange">{code.language}</Tag><Tag>{code.difficulty}</Tag><Text strong>{code.title}</Text></Space>
                            <Text>{code.description}</Text>
                            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{code.codePreview}</pre>
                            {explainedCodeId === id && <Alert type="info" message="逐行解释" description="先读取数据，再设置关键参数，最后观察输出结果。请重点解释每个变量和结果之间的关系。" />}
                            <Space wrap>
                              <Button size="small" onClick={() => setExplainedCodeId(explainedCodeId === id ? '' : id)}>逐行解释</Button>
                              <Button size="small" onClick={() => toggleWork(id, true)}>标记完成</Button>
                            </Space>
                          </Space>
                        </Card>
                      )
                    })}
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card title="阶段测试安排">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Text>测试题数：{currentStage.testPlan.questionCount}</Text>
                <Text>测试重点：{currentStage.testPlan.focus.join('、')}</Text>
                <Text>通过分数：{currentStage.testPlan.passScore}</Text>
                <Alert type="info" showIcon message={progress.stageProgressPercent >= 60 ? '当前可以开始测试' : '建议先完成更多阶段任务再测试'} />
                <Button type="primary" onClick={startTest}>开始阶段测试</Button>

                {testQuestions.length > 0 && (
                  <Card size="small" title="阶段测试题">
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {testQuestions.map((question, index) => (
                        <Card key={question.id} size="small">
                          <Text strong>{index + 1}. {question.question}</Text>
                          <Radio.Group value={testAnswers[question.id]} onChange={event => setTestAnswers(prev => ({ ...prev, [question.id]: event.target.value }))} style={{ display: 'block', marginTop: 8 }}>
                            <Space direction="vertical">
                              {question.options.map(option => <Radio key={option} value={option}>{option}</Radio>)}
                            </Space>
                          </Radio.Group>
                        </Card>
                      ))}
                      <Button type="primary" onClick={submitTest}>提交阶段测试</Button>
                    </Space>
                  </Card>
                )}

                {testResult && (
                  <Alert
                    type={testResult.passed ? 'success' : 'warning'}
                    showIcon
                    message={`阶段得分：${testResult.score} 分，${testResult.passed ? '已通过' : '未通过'}`}
                    description={testResult.passed
                      ? '当前阶段已完成，可以进入下一阶段。'
                      : `薄弱内容：${testResult.weak.join('、') || '当前阶段重点'}。请先生成专项练习或重测。`}
                  />
                )}

                {testResult && !testResult.passed && (
                  <Button onClick={() => message.success('已生成阶段补弱练习，请先回看错题知识点再重测')}>生成专项练习</Button>
                )}
              </Space>
            </Card>
          </>
        )}
      </Space>
    </div>
  )
}

export default SystemStudyWorkspacePage
