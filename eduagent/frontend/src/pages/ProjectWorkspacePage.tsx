import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, Col, Input, Progress, Radio, Row, Space, Statistic, Tag, Typography, message } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import BackToLearningButton from '../components/personalization/BackToLearningButton'
import {
  addLearningRecord,
  addWrongQuestions,
  readLearnerAgentModel,
  readProjectDefenseResult,
  readProjectReviewResult,
  readProjectSubmission,
  readProjectWorkspace,
  saveChatDraft,
  saveCurrentLearningContext,
  saveProjectDefenseResult,
  saveProjectReviewResult,
  saveProjectSubmission,
  saveProjectWorkspace,
} from '../services/learningData'
import type { LearningRecord, ProjectDefenseResult, ProjectReviewResult, ProjectSubmission, ProjectWorkspace, WrongQuestion } from '../types/personalization'
import { evaluateProjectDefense, generateProjectDefenseQuestions, generateProjectWorkspace, reviewProjectSubmission } from '../utils/learnerAgentEngine'

const { Paragraph, Text, Title } = Typography
const { TextArea } = Input

const statusText: Record<ProjectWorkspace['status'], string> = {
  not_started: '未开始',
  in_progress: '进行中',
  ready_to_submit: '可提交',
  submitted: '已提交',
  needs_revision: '需修改',
  completed: '已完成',
}

const ProjectWorkspacePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const topic = new URLSearchParams(location.search).get('topic') || ''
  const model = readLearnerAgentModel()
  const [workspace, setWorkspace] = useState<ProjectWorkspace>(() => {
    const stored = readProjectWorkspace()
    if (stored && (!topic || stored.topic === topic)) return stored
    const generated = generateProjectWorkspace(topic || model.diagnosticProfile.currentTopic || '当前项目', model)
    saveProjectWorkspace(generated)
    return generated
  })
  const [submission, setSubmission] = useState<ProjectSubmission>(() => readProjectSubmission() || {
    projectId: workspace.id,
    topic: workspace.topic,
    submittedAt: '',
    readmeText: '',
    codeText: workspace.codePreview,
    resultExplanation: '',
    screenshotNote: '',
    attachmentNames: [],
    selfReflection: '',
  })
  const [review, setReview] = useState<ProjectReviewResult | null>(readProjectReviewResult)
  const [defense, setDefense] = useState<ProjectDefenseResult | null>(readProjectDefenseResult)
  const [defenseAnswers, setDefenseAnswers] = useState<Record<string, string>>({})
  const [showHint, setShowHint] = useState(false)
  const [showCheck, setShowCheck] = useState(false)
  const [showCodeExplain, setShowCodeExplain] = useState(false)

  useEffect(() => {
    saveCurrentLearningContext({
      topic: workspace.topic,
      mode: 'project_task',
      currentPlanId: workspace.id,
    })
  }, [workspace])

  const currentStage = workspace.stages.find(stage => stage.id === workspace.currentStageId) || workspace.stages[0]
  const allTaskIds = workspace.stages.flatMap(stage => stage.tasks.map((_, index) => `${stage.id}-task-${index}`))
  const completionRate = Math.round((workspace.completedTaskIds.length / Math.max(allTaskIds.length, 1)) * 100)
  const readyToSubmit = completionRate >= 80
  const defenseQuestions = generateProjectDefenseQuestions(workspace)

  const saveWorkspace = (next: ProjectWorkspace) => {
    setWorkspace(next)
    saveProjectWorkspace(next)
  }

  const writeRecord = (title: string, score: number, weak: string[] = []) => {
    const record: LearningRecord = {
      id: `project-record-${Date.now()}`,
      topic: workspace.topic,
      mode: 'project_task',
      score,
      completedSteps: workspace.completedTaskIds.length,
      totalSteps: allTaskIds.length,
      wrongKnowledgePoints: weak,
      masteredKnowledgePoints: [title],
      createdAt: new Date().toISOString(),
    }
    addLearningRecord(record)
  }

  const toggleTask = (id: string, checked: boolean) => {
    const nextIds = checked
      ? Array.from(new Set([...workspace.completedTaskIds, id]))
      : workspace.completedTaskIds.filter(item => item !== id)
    const nextStatus = nextIds.length / Math.max(allTaskIds.length, 1) >= 0.8 ? 'ready_to_submit' : 'in_progress'
    saveWorkspace({
      ...workspace,
      completedTaskIds: nextIds,
      status: workspace.status === 'completed' ? 'completed' : nextStatus,
    })
    message.success(checked ? '项目阶段任务已记录' : '已取消任务完成状态')
  }

  const markStageComplete = () => {
    const stageTaskIds = currentStage.tasks.map((_, index) => `${currentStage.id}-task-${index}`)
    const nextIds = Array.from(new Set([...workspace.completedTaskIds, ...stageTaskIds]))
    const nextStage = workspace.stages.find(stage => stage.id !== currentStage.id && !stage.tasks.every((_, index) => nextIds.includes(`${stage.id}-task-${index}`)))
    const nextWorkspace = {
      ...workspace,
      completedTaskIds: nextIds,
      currentStageId: nextStage?.id || currentStage.id,
      stages: workspace.stages.map(stage => stage.id === currentStage.id ? { ...stage, completed: true } : stage),
      status: nextIds.length / Math.max(allTaskIds.length, 1) >= 0.8 ? 'ready_to_submit' as const : 'in_progress' as const,
    }
    saveWorkspace(nextWorkspace)
    writeRecord(`${currentStage.title} 完成`, 76)
    message.success(nextStage ? '本阶段已完成，已进入下一阶段' : '所有项目阶段任务已完成，可以提交验收')
  }

  const askAssistant = (text: string) => {
    saveChatDraft(text)
    navigate('/chat')
  }

  const submitProjectReview = () => {
    if (!submission.readmeText.trim() || !submission.resultExplanation.trim() || !submission.selfReflection.trim()) {
      message.warning('请至少填写 README、结果解释和自我反思')
      return
    }
    const nextSubmission = {
      ...submission,
      projectId: workspace.id,
      topic: workspace.topic,
      submittedAt: new Date().toISOString(),
    }
    const nextReview = reviewProjectSubmission(workspace, nextSubmission)
    saveProjectSubmission(nextSubmission)
    saveProjectReviewResult(nextReview)
    setSubmission(nextSubmission)
    setReview(nextReview)
    saveWorkspace({
      ...workspace,
      status: nextReview.passed ? 'submitted' : 'needs_revision',
    })
    writeRecord('提交项目审核', nextReview.score, nextReview.weaknesses)
    message[nextReview.passed ? 'success' : 'warning'](nextReview.passed ? '项目审核通过，可以进入答辩小测' : '项目审核未通过，请按建议修改')
  }

  const submitDefense = () => {
    if (defenseQuestions.some(question => !defenseAnswers[question])) {
      message.warning('请先完成全部答辩问题')
      return
    }
    const nextDefense = evaluateProjectDefense(workspace, defenseAnswers)
    setDefense(nextDefense)
    saveProjectDefenseResult(nextDefense)
    if (!nextDefense.passed) {
      addWrongQuestions(nextDefense.answers.filter(item => !item.passed).map((item): WrongQuestion => ({
        id: `project-defense-${Date.now()}-${item.question}`,
        topic: workspace.topic,
        question: item.question,
        userAnswer: item.userAnswer,
        correctAnswer: '需要覆盖项目目标、核心知识点、代码逻辑或结果解释。',
        analysis: item.feedback,
        knowledgePoint: '项目答辩表达',
        difficulty: '项目答辩',
        errorType: '项目答辩薄弱点',
        source: 'project_task',
        createdAt: new Date().toISOString(),
      })))
    }
    writeRecord('完成项目答辩', nextDefense.score, nextDefense.passed ? [] : ['项目答辩表达'])
    message[nextDefense.passed ? 'success' : 'warning'](nextDefense.passed ? '答辩小测通过，可以生成项目完成报告' : '答辩未通过，请补充回答后重试')
  }

  const generateCompletionReport = () => {
    const canComplete = completionRate >= 80 && Boolean(submission.submittedAt) && Boolean(review?.passed) && Boolean(defense?.passed)
    const nextWorkspace = {
      ...workspace,
      status: canComplete ? 'completed' as const : 'needs_revision' as const,
    }
    saveWorkspace(nextWorkspace)
    if (canComplete) {
      writeRecord('完成项目', Math.round(((review?.score || 80) + (defense?.score || 80)) / 2))
      message.success('项目完成报告已生成')
    } else {
      message.warning('完成条件还不够，请先补齐阶段任务、审核或答辩')
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space wrap>
          <BackToLearningButton topic={workspace.topic} label="返回开始学习" />
          <Button onClick={() => navigate(`/learn/project?topic=${encodeURIComponent(workspace.topic)}`)}>返回项目说明</Button>
        </Space>

        <Card>
          <Title level={3} style={{ marginBottom: 8 }}>{workspace.topic} · 项目任务工作台</Title>
          <Paragraph style={{ marginBottom: 0 }}>
            按阶段完成任务、提交产出物、通过 AI 审核和答辩小测后，系统才会确认项目完成。
          </Paragraph>
        </Card>

        <Card title="项目总览">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={10}>
              <Title level={4} style={{ marginTop: 0 }}>{workspace.projectName}</Title>
              <Paragraph>{workspace.projectGoal}</Paragraph>
              <Text>预计完成时间：{workspace.expectedTime}</Text>
            </Col>
            <Col xs={24} md={8}>
              <Statistic title="当前进度" value={completionRate} suffix="%" />
              <Progress percent={completionRate} />
              <Tag color={workspace.status === 'completed' ? 'green' : workspace.status === 'needs_revision' ? 'orange' : 'blue'}>
                {statusText[workspace.status]}
              </Tag>
            </Col>
            <Col xs={24} md={6}>
              <Text strong>最终产出</Text>
              <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
                {workspace.finalOutputs.map(item => <Text key={item}>{item}</Text>)}
              </Space>
            </Col>
          </Row>
        </Card>

        <Card title="为什么适合你">
          <Paragraph>{workspace.fitReason}</Paragraph>
          <Space wrap>
            <Tag color="blue">{model.explicitProfile.statedGoal || '项目目标'}</Tag>
            {model.diagnosticProfile.weakConcepts.slice(0, 3).map(item => <Tag color="orange" key={item}>{item}</Tag>)}
            <Tag color="red">用项目补强理解和表达</Tag>
          </Space>
        </Card>

        <Card title="项目阶段路线图">
          <Row gutter={[12, 12]}>
            {workspace.stages.map(stage => (
              <Col xs={24} md={6} key={stage.id}>
                <Card size="small" style={{ height: '100%', borderWidth: stage.id === currentStage.id ? 4 : 2 }}>
                  <Space direction="vertical" size={6}>
                    <Tag color={stage.completed ? 'green' : stage.id === currentStage.id ? 'red' : 'blue'}>{stage.completed ? '已完成' : stage.id === currentStage.id ? '当前阶段' : '待完成'}</Tag>
                    <Text strong>{stage.title}</Text>
                    <Text type="secondary">{stage.estimatedTime}</Text>
                    <Paragraph style={{ margin: 0 }}>{stage.goal}</Paragraph>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>

        <Card title="当前阶段任务">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert type="info" showIcon message={`${currentStage.title} · ${currentStage.estimatedTime}`} description={currentStage.goal} />
            {currentStage.tasks.map((task, index) => {
              const id = `${currentStage.id}-task-${index}`
              return (
                <Checkbox key={id} checked={workspace.completedTaskIds.includes(id)} onChange={event => toggleTask(id, event.target.checked)}>
                  {task}
                </Checkbox>
              )
            })}
            {showHint && <Alert type="info" message="阶段提示" description={currentStage.checkQuestion} />}
            {showCheck && <Alert type="warning" message="阶段检查" description="请确认你能回答阶段检查问题，再标记本阶段完成。" />}
            <Space wrap>
              <Button onClick={() => setShowHint(!showHint)}>查看提示</Button>
              <Button onClick={() => askAssistant(`请帮我完成项目阶段：${currentStage.title}`)}>问对话助手</Button>
              <Button type="primary" onClick={markStageComplete}>标记本阶段完成</Button>
              <Button onClick={() => setShowCheck(!showCheck)}>进入阶段检查</Button>
            </Space>
          </Space>
        </Card>

        <Row gutter={[12, 12]}>
          <Col xs={24} lg={10}>
            <Card title="配套资源" style={{ height: '100%' }}>
              <Space wrap>
                {currentStage.resources.map(item => <Tag color="blue" key={item}>{item}</Tag>)}
                <Tag>项目 README 模板</Tag>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="代码工作区" style={{ height: '100%' }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{workspace.codePreview}</pre>
                {showCodeExplain && <Alert type="info" message="逐行解释" description="先加载数据，再划分训练与测试，构建模型后观察预测结果和评价指标。当前 MVP 先提供代码理解、修改建议和结果模拟。" />}
                <Space wrap>
                  <Button onClick={() => setShowCodeExplain(!showCodeExplain)}>逐行解释</Button>
                  <Button onClick={() => message.success('已生成修改建议：先改参数，再观察结果变化')}>改造任务</Button>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card title="项目验收区">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={6}><Checkbox checked={completionRate >= 80}>已完成主要阶段任务</Checkbox></Col>
              <Col xs={24} md={6}><Checkbox checked={Boolean(submission.submittedAt)}>已提交项目产出物</Checkbox></Col>
              <Col xs={24} md={6}><Checkbox checked={Boolean(review?.passed)}>已通过 AI 项目审核</Checkbox></Col>
              <Col xs={24} md={6}><Checkbox checked={Boolean(defense?.passed)}>已完成项目答辩小测</Checkbox></Col>
            </Row>

            <TextArea rows={4} placeholder="项目 README / 项目说明" value={submission.readmeText} onChange={event => setSubmission(prev => ({ ...prev, readmeText: event.target.value }))} />
            <TextArea rows={4} placeholder="代码或代码片段" value={submission.codeText} onChange={event => setSubmission(prev => ({ ...prev, codeText: event.target.value }))} />
            <TextArea rows={3} placeholder="运行结果说明" value={submission.resultExplanation} onChange={event => setSubmission(prev => ({ ...prev, resultExplanation: event.target.value }))} />
            <TextArea rows={3} placeholder="项目总结 / 自我反思" value={submission.selfReflection} onChange={event => setSubmission(prev => ({ ...prev, selfReflection: event.target.value }))} />
            <Button type="primary" disabled={!readyToSubmit} onClick={submitProjectReview}>
              提交项目审核
            </Button>
            {!readyToSubmit && <Text type="secondary">阶段任务完成率达到 80% 后才能提交项目审核。</Text>}
          </Space>
        </Card>

        {review && (
          <Card title="AI 项目审核结果">
            <Row gutter={[12, 12]}>
              <Col xs={12} md={4}><Statistic title="总分" value={review.score} /></Col>
              <Col xs={12} md={4}><Statistic title="任务完整性" value={review.completenessScore} /></Col>
              <Col xs={12} md={4}><Statistic title="知识理解" value={review.understandingScore} /></Col>
              <Col xs={12} md={4}><Statistic title="代码实现" value={review.codeScore} /></Col>
              <Col xs={12} md={4}><Statistic title="结果解释" value={review.explanationScore} /></Col>
              <Col xs={12} md={4}><Statistic title="总结反思" value={review.summaryScore} /></Col>
            </Row>
            <Alert type={review.passed ? 'success' : 'warning'} showIcon message={review.passed ? '审核通过，可以进入答辩小测' : '审核未通过，需要修改'} description={review.revisionSuggestions.join('；')} style={{ marginTop: 12 }} />
          </Card>
        )}

        {review?.passed && (
          <Card title="项目答辩小测">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {defenseQuestions.map(question => (
                <Card key={question} size="small">
                  <Text strong>{question}</Text>
                  <TextArea rows={2} style={{ marginTop: 8 }} value={defenseAnswers[question]} onChange={event => setDefenseAnswers(prev => ({ ...prev, [question]: event.target.value }))} />
                </Card>
              ))}
              <Button type="primary" onClick={submitDefense}>提交项目答辩</Button>
            </Space>
          </Card>
        )}

        {defense && (
          <Card title="答辩结果">
            <Alert type={defense.passed ? 'success' : 'warning'} showIcon message={`答辩得分：${defense.score} 分`} description={defense.passed ? '答辩通过，可以生成项目完成报告。' : '答辩未通过，请补充回答后重新提交。'} />
            <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 12 }}>
              {defense.answers.map(item => (
                <Alert key={item.question} type={item.passed ? 'success' : 'warning'} message={item.question} description={item.feedback} />
              ))}
            </Space>
          </Card>
        )}

        <Card title="项目完成报告">
          {workspace.status === 'completed' ? (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Alert type="success" showIcon message="项目已完成" description="阶段任务、项目产出物、AI 审核和答辩小测均已通过。" />
              <Text>项目名称：{workspace.projectName}</Text>
              <Text>AI 审核评分：{review?.score || 0}</Text>
              <Text>答辩得分：{defense?.score || 0}</Text>
              <Text>已掌握能力：项目拆解、代码理解、结果解释、项目复盘</Text>
              <Text>仍需加强能力：{review?.weaknesses.join('、') || '继续做进阶项目'}</Text>
              <Space wrap>
                <Button onClick={() => message.success('已生成进阶项目建议：扩大数据量并加入可视化报告')}>进入进阶项目</Button>
                <Button onClick={() => navigate(`/learn/single-topic?topic=${encodeURIComponent(model.diagnosticProfile.weakConcepts[0] || workspace.topic)}`)}>回到单点补弱</Button>
                <Button onClick={() => message.success('已生成 README 优化建议')}>生成项目 README 优化版</Button>
                <Button onClick={() => navigate('/evaluation')}>查看学习评估</Button>
                <Button onClick={() => askAssistant(`请根据我的项目完成报告，继续追问 ${workspace.topic}`)}>问对话助手</Button>
              </Space>
            </Space>
          ) : (
            <Space direction="vertical" size={10}>
              <Paragraph>最终完成条件：阶段任务完成率 &gt;= 80%，产出物已提交，AI 审核 &gt;= 70，答辩小测 &gt;= 60。</Paragraph>
              <Button type="primary" onClick={generateCompletionReport}>生成项目完成报告</Button>
            </Space>
          )}
        </Card>
      </Space>
    </div>
  )
}

export default ProjectWorkspacePage
