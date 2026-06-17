import React from 'react'
import { Alert, Button, Card, Collapse, Space, Tag, Typography } from 'antd'
import { RobotOutlined, UserOutlined } from '@ant-design/icons'
import type { LearningStrategySummary } from '../../types/personalization'
import { getLearningModeLabel } from '../../utils/personalizationEngine'

const { Paragraph, Text } = Typography

interface Props {
  topic: string
  summary: LearningStrategySummary
  onOpenAgent?: () => void
}

const AIStrategyPanel: React.FC<Props> = ({ topic, summary, onOpenAgent }) => (
  <Card
    title={<Space><RobotOutlined />AI 个性化学习策略</Space>}
    style={{ marginBottom: 16 }}
  >
    <Space direction="vertical" size={14} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={`当前学习知识点：${topic}`}
        description="AI 已结合你的个人学习 Agent，为你生成本次学习策略。"
      />

      <Card size="small" style={{ background: '#fffbe6' }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space wrap>
            <Text strong>推荐学习模式</Text>
            <Tag color="red">{getLearningModeLabel(summary.recommendedMode)}</Tag>
          </Space>
          <Paragraph style={{ margin: 0 }}>{summary.reason}</Paragraph>
        </Space>
      </Card>

      <Card size="small" title="本次定制策略">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {summary.strategies.map(item => <Text key={item}>{item}</Text>)}
        </Space>
      </Card>

      <Collapse
        items={[
          {
            key: 'basis',
            label: '查看推荐依据',
            children: (
              <Paragraph style={{ margin: 0 }}>
                本次推荐参考了你的当前目标、诊断结果、薄弱知识点、错题记录和学习偏好。如需修改，请前往“个人学习 Agent”模块。
              </Paragraph>
            ),
          },
        ]}
      />

      {onOpenAgent && (
        <Button icon={<UserOutlined />} onClick={onOpenAgent}>
          前往个人学习 Agent
        </Button>
      )}
    </Space>
  </Card>
)

export default AIStrategyPanel
