import React, { useEffect, useState } from 'react'
import { Alert, Card, Input, Space, Tag, Typography } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import AIStrategyPanel from '../components/personalization/AIStrategyPanel'
import LearningModeSelector from '../components/personalization/LearningModeSelector'
import { readLearnerAgentModel, saveCurrentLearningContext } from '../services/learningData'
import type { LearningMode, LearningStrategySummary } from '../types/personalization'
import { generateLearningStrategySummary } from '../utils/learnerAgentEngine'

const { Paragraph, Title } = Typography

const quickTopics = ['神经网络', 'CNN 卷积', '线性回归', '决策树', '推荐系统']

const LearningPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const initialTopic = new URLSearchParams(location.search).get('topic') || ''
  const [topic, setTopic] = useState(initialTopic)
  const [currentTopic, setCurrentTopic] = useState(initialTopic)
  const [strategy, setStrategy] = useState<LearningStrategySummary | null>(null)

  useEffect(() => {
    if (!initialTopic.trim()) return
    const model = readLearnerAgentModel()
    setCurrentTopic(initialTopic)
    setStrategy(generateLearningStrategySummary(initialTopic, model))
  }, [initialTopic])

  const searchTopic = (value?: string) => {
    const nextTopic = (value || topic).trim()
    if (!nextTopic) return
    const model = readLearnerAgentModel()
    const nextStrategy = generateLearningStrategySummary(nextTopic, model)
    setTopic(nextTopic)
    setCurrentTopic(nextTopic)
    setStrategy(nextStrategy)
    saveCurrentLearningContext({
      topic: nextTopic,
      mode: nextStrategy.recommendedMode,
    })
  }

  const enterMode = (mode: LearningMode) => {
    if (!currentTopic.trim()) return
    const routeMap: Record<LearningMode, string> = {
      single_topic: '/learn/single-topic',
      system_study: '/learn/system',
      project_task: '/learn/project-workspace',
    }
    saveCurrentLearningContext({
      topic: currentTopic,
      mode,
    })
    navigate(`${routeMap[mode]}?topic=${encodeURIComponent(currentTopic)}`)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: '0 auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>学习入口页</Title>
            <Paragraph style={{ marginBottom: 0 }}>
              搜索知识点后，系统会先读取你的个人学习 Agent，再给出本次学习策略和模式入口。
            </Paragraph>
          </div>

          <Input.Search
            size="large"
            value={topic}
            placeholder="输入你想学的知识点，如：CNN 卷积、神经网络、线性回归"
            enterButton="开始分析"
            onChange={event => setTopic(event.target.value)}
            onSearch={() => searchTopic()}
          />

          <Space wrap>
            {quickTopics.map(item => (
              <Tag
                key={item}
                color={currentTopic === item ? 'red' : 'default'}
                style={{ cursor: 'pointer', padding: '4px 10px' }}
                onClick={() => searchTopic(item)}
              >
                {item}
              </Tag>
            ))}
          </Space>
        </Space>
      </Card>

      {!strategy && (
        <Alert
          type="info"
          showIcon
          message="先输入一个知识点开始"
          description="开始学习页现在只负责知识点输入、AI 个性化学习策略和学习模式选择。"
          style={{ marginBottom: 16 }}
        />
      )}

      {strategy && currentTopic && (
        <>
          <AIStrategyPanel
            topic={currentTopic}
            summary={strategy}
            onOpenAgent={() => navigate('/profile')}
          />
          <LearningModeSelector activeMode={strategy.recommendedMode} onSelect={enterMode} />
        </>
      )}
    </div>
  )
}

export default LearningPage
