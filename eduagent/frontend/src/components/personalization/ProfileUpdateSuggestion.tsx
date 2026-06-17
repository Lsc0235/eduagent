import React from 'react'
import { Alert, Button, Card, Space, Tag, Typography } from 'antd'
import type { ProfileUpdateSuggestion as Suggestion } from '../../types/personalization'

const { Text, Paragraph } = Typography

interface Props {
  suggestion: Suggestion | null
  onApply: () => void
}

const ProfileUpdateSuggestion: React.FC<Props> = ({ suggestion, onApply }) => (
  <Card title="来自最近学习记录的画像更新建议" style={{ marginBottom: 16 }}>
    {suggestion ? (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          {suggestion.mastered.map(item => <Tag color="green" key={item}>已掌握：{item}</Tag>)}
          {suggestion.weakness.map(item => <Tag color="red" key={item}>需加强：{item}</Tag>)}
        </Space>
        <Paragraph style={{ margin: 0 }}>{suggestion.suggestedProfileChange}</Paragraph>
        {suggestion.suggestedLearningAbility && <Text>学习能力建议：{suggestion.suggestedLearningAbility}</Text>}
        {suggestion.suggestedHabit && <Text>学习方式建议：{suggestion.suggestedHabit}</Text>}
        <Button type="primary" onClick={onApply}>应用更新建议</Button>
      </Space>
    ) : (
      <Alert type="info" showIcon message="完成单点速学练习后，这里会出现可应用的画像更新建议。" />
    )}
  </Card>
)

export default ProfileUpdateSuggestion
