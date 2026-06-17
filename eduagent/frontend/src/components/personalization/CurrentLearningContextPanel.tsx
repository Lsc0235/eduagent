import React from 'react'
import { Button, Card, Empty, Space, Tag, Typography } from 'antd'
import type { CurrentLearningContext, LearnerAgentModel, LearningRecord, UserProfile, WrongQuestion } from '../../types/personalization'
import { getLearningModeLabel } from '../../utils/personalizationEngine'

const { Text } = Typography

interface Props {
  context: CurrentLearningContext | null
  profile: UserProfile
  model?: LearnerAgentModel
  wrongs: WrongQuestion[]
  records: LearningRecord[]
  onAsk: (question: string) => void
}

const CurrentLearningContextPanel: React.FC<Props> = ({ context, profile, model, wrongs, records, onAsk }) => {
  const weakPoints = Array.from(new Set([
    ...(model?.diagnosticProfile.weakConcepts || []),
    ...wrongs.slice(0, 3).map(question => question.knowledgePoint),
  ])).slice(0, 3)
  const goal = model?.explicitProfile.statedGoal || model?.memory.shortTermGoals[0] || profile.learningGoal
  const suggestions = [
    `用生活例子解释${context?.topic || '当前知识点'}`,
    `给我讲一下${weakPoints[0] || '薄弱点'}为什么难`,
    '根据我的错题再出 3 道题',
    `我适合直接做${context?.topic || '这个'}项目吗？`,
  ]

  return (
    <aside style={{ width: 300, padding: 16, background: '#fff', borderLeft: '4px solid #121212', overflow: 'auto' }}>
      <Card title="当前学习上下文" size="small">
        {context ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Text>当前知识点：<strong>{context.topic}</strong></Text>
            <Text>当前模式：<Tag color="blue">{getLearningModeLabel(context.mode)}</Tag></Text>
            <Text>当前目标：{goal}</Text>
            <Text>学习偏好：{model?.behaviorProfile.preferredContentByBehavior.join('、') || profile.cognitiveStyle}</Text>
            <Text>近期薄弱点：{weakPoints.join('、') || '暂无'}</Text>
            {wrongs[0] && <Text>最近错题：{wrongs[0].knowledgePoint}</Text>}
            {records[0] && <Text>最近得分：{records[0].score} 分</Text>}
            <Text strong>建议提问</Text>
            {suggestions.map(item => (
              <Button key={item} block onClick={() => onAsk(item)}>{item}</Button>
            ))}
          </Space>
        ) : (
          <Empty description="暂无学习上下文，先在开始学习模块选择知识点" />
        )}
      </Card>
    </aside>
  )
}

export default CurrentLearningContextPanel
