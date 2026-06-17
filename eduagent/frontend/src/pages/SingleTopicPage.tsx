import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Row, Space, Tag, Typography, message } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import BackToLearningButton from '../components/personalization/BackToLearningButton'
import SingleTopicLearningPlan from '../components/personalization/SingleTopicLearningPlan'
import { addLearningRecord, addWrongQuestions, readLearnerAgentModel, saveChatDraft, saveCurrentLearningContext, saveLatestProfileSuggestion } from '../services/learningData'
import type { ExerciseEvaluationResult, LearningRecord } from '../types/personalization'
import { evaluateExerciseResult } from '../utils/personalizationEngine'
import { generateSingleTopicPlan, learnerAgentModelToUserProfile } from '../utils/learnerAgentEngine'

const { Paragraph, Text, Title } = Typography

const SingleTopicPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const topic = new URLSearchParams(location.search).get('topic') || ''
  const model = readLearnerAgentModel()
  const plan = topic ? generateSingleTopicPlan(topic, model) : null
  const [result, setResult] = useState<ExerciseEvaluationResult | null>(null)
  const [showSpecialPractice, setShowSpecialPractice] = useState(false)

  useEffect(() => {
    if (!topic) return
    saveCurrentLearningContext({
      topic,
      mode: 'single_topic',
    })
  }, [topic])

  const submitExercises = (answers: Record<string, string>) => {
    if (!topic || !plan) return
    const nextResult = evaluateExerciseResult(topic, answers, plan.exercises, learnerAgentModelToUserProfile(model))
    setResult(nextResult)
    addWrongQuestions(nextResult.wrongQuestions.map(item => ({
      ...item,
      errorType: '知识点理解偏差',
    })))
    const record: LearningRecord = {
      id: `single-topic-${Date.now()}`,
      topic,
      mode: 'single_topic',
      score: nextResult.score,
      completedSteps: 4,
      totalSteps: 4,
      wrongKnowledgePoints: nextResult.weakKnowledgePoints,
      masteredKnowledgePoints: nextResult.masteredKnowledgePoints,
      createdAt: new Date().toISOString(),
    }
    addLearningRecord(record)
    saveLatestProfileSuggestion(nextResult.profileUpdateSuggestion)
    message.success('练习结果已写入学习记录，错题已同步到错题本')
  }

  const masteryText = (score: number) => {
    if (score >= 80) return '已基本掌握，可以进入下一阶段。'
    if (score >= 60) return '基本理解，但需要补弱。'
    return '暂不建议进入项目任务，建议重学薄弱点。'
  }

  const askAssistant = () => {
    saveChatDraft(`请根据我刚才的单点速学结果讲解薄弱点：${result?.weakKnowledgePoints.join('、') || topic}`)
    navigate('/chat')
  }

  if (!topic || !plan) {
    return (
      <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
        <BackToLearningButton />
        <Alert type="warning" showIcon message="缺少学习主题" description="请先回到开始学习页输入知识点。" style={{ marginTop: 16 }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <BackToLearningButton topic={topic} />

        <Card>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Title level={3} style={{ margin: 0 }}>{topic} · 单点速学</Title>
            <Text strong>Agent 个性化学习说明</Text>
            <Paragraph style={{ margin: 0 }}>{plan.reason}</Paragraph>
            <div>
              {model.diagnosticProfile.weakConcepts.slice(0, 3).map(item => <Tag color="orange" key={item}>{item}</Tag>)}
            </div>
          </Space>
        </Card>

        <SingleTopicLearningPlan plan={plan} result={result} onSubmitExercises={submitExercises} />

        {result && (
          <Card title="单点速学结果区">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type={result.score >= 80 ? 'success' : result.score >= 60 ? 'warning' : 'error'}
                showIcon
                message={`本次得分：${result.score} 分`}
                description={masteryText(result.score)}
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Card size="small" title="掌握状态">
                    <Text>已掌握：{result.masteredKnowledgePoints.join('、') || '暂无'}</Text>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" title="本次薄弱知识点">
                    <Text>{result.weakKnowledgePoints.join('、') || '暂无明显薄弱点'}</Text>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" title="易错类型">
                    <Text>{result.wrongQuestions.length > 0 ? '知识点理解偏差 / 选项辨析不稳' : '暂无'}</Text>
                  </Card>
                </Col>
              </Row>

              <Card size="small" title="错题解析">
                {result.wrongQuestions.length === 0 ? (
                  <Alert type="success" showIcon message="本轮没有错题" description="可以进入系统学习或项目任务继续推进。" />
                ) : (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {result.wrongQuestions.map(question => (
                      <Card key={question.id} size="small">
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Text strong>{question.question}</Text>
                          <Text>用户答案：{question.userAnswer}</Text>
                          <Text>正确答案：{question.correctAnswer}</Text>
                          <Text>错误原因：{question.analysis}</Text>
                          <Text>对应知识点：<Tag color="orange">{question.knowledgePoint}</Tag></Text>
                          <Text type="secondary">建议回看内容：{question.knowledgePoint} 的概念解释、案例应用和同类练习。</Text>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>

              <Alert
                type="info"
                showIcon
                message="学习记录写入提示"
                description="本次练习已经写入 learningRecords；错题已经写入 wrongQuestions，并反向更新个人学习 Agent。"
              />

              {showSpecialPractice && (
                <Card size="small" title="专项练习已生成">
                  <Space direction="vertical" size={8}>
                    {(result.weakKnowledgePoints.length ? result.weakKnowledgePoints : [`${topic}核心概念`]).map((point, index) => (
                      <Text key={point}>{`${index + 1}. 用一个例子解释「${point}」，并写出它最容易混淆的地方。`}</Text>
                    ))}
                  </Space>
                </Card>
              )}

              <Space wrap>
                <Button onClick={() => {
                  setShowSpecialPractice(false)
                  message.info('已回到薄弱点复盘，请从三层解释和资源卡重新查看')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}>
                  重学薄弱点
                </Button>
                <Button onClick={() => {
                  setShowSpecialPractice(true)
                  message.success('已生成专项练习')
                }}>
                  生成专项练习
                </Button>
                <Button type="primary" onClick={() => navigate(`/learn/project-workspace?topic=${encodeURIComponent(topic)}`)}>
                  进入项目任务
                </Button>
                <Button onClick={() => navigate(`/learn/system?topic=${encodeURIComponent(topic)}`)}>
                  进入系统学习
                </Button>
                <Button onClick={askAssistant}>问对话助手</Button>
                <Button onClick={() => navigate('/evaluation')}>查看学习评估</Button>
              </Space>
            </Space>
          </Card>
        )}
      </Space>
    </div>
  )
}

export default SingleTopicPage
