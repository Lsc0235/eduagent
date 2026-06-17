import React, { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Row, Space, Tag, Typography, message } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import BackToLearningButton from '../components/personalization/BackToLearningButton'
import { readLearnerAgentModel, saveCurrentLearningContext, saveSystemStudyPlan, saveSystemStudyProgress } from '../services/learningData'
import { createDefaultSystemStudyProgress, generateSystemStudyPlan, generateSystemStudyWorkspacePlan } from '../utils/learnerAgentEngine'

const { Paragraph, Text, Title } = Typography

const SystemStudyPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const topic = new URLSearchParams(location.search).get('topic') || ''
  const model = readLearnerAgentModel()
  const plan = topic ? generateSystemStudyPlan(topic, model) : null
  const [loadingBookId, setLoadingBookId] = useState('')

  useEffect(() => {
    if (!topic) return
    saveCurrentLearningContext({
      topic,
      mode: 'system_study',
    })
  }, [topic])

  const selectBook = (book: NonNullable<typeof plan>['recommendedBooks'][number]) => {
    setLoadingBookId(book.id)
    const workspacePlan = generateSystemStudyWorkspacePlan(topic, {
      id: book.id,
      title: book.title,
      author: book.author,
    }, model)
    const progress = createDefaultSystemStudyProgress(workspacePlan)
    saveSystemStudyPlan(workspacePlan)
    saveSystemStudyProgress(progress)
    saveCurrentLearningContext({
      topic,
      mode: 'system_study',
      selectedBook: book.title,
      currentPlanId: workspacePlan.id,
    })
    message.success('已为你生成系统学习计划')
    setTimeout(() => {
      navigate(`/learn/system-workspace?topic=${encodeURIComponent(topic)}&book=${encodeURIComponent(book.id)}`)
    }, 250)
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
          <Title level={3} style={{ marginBottom: 8 }}>{topic} · 系统学习</Title>
          <Paragraph style={{ marginBottom: 0 }}>
            系统学习选书页只负责推荐教材、解释推荐理由，并让你选择一本书生成学习计划。
          </Paragraph>
        </Card>

        <Card title="推荐教材">
          <Row gutter={[12, 12]}>
            {plan.recommendedBooks.map(book => (
              <Col xs={24} md={12} key={book.id}>
                <Card size="small" style={{ height: '100%' }}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap>
                      <Tag color="blue">{book.level}</Tag>
                      <Tag color="gold">匹配度 {book.score}</Tag>
                    </Space>
                    <Title level={5} style={{ margin: 0 }}>{book.title}</Title>
                    <Text type="secondary">{book.author}</Text>
                    <Paragraph style={{ margin: 0 }}>{book.benefit}</Paragraph>
                    <Alert
                      type="info"
                      showIcon
                      message="为什么推荐这本书？"
                      description={`${book.personalizedReason} ${book.fitReason}`}
                    />
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={loadingBookId === book.id}
                        onClick={() => selectBook(book)}
                      >
                        选择本书生成学习计划
                      </Button>
                      {book.ebookUrl && (
                        <a href={book.ebookUrl} target="_blank" rel="noreferrer">
                          <Button>查看电子版</Button>
                        </a>
                      )}
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Space>
    </div>
  )
}

export default SystemStudyPage
