import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import type { LearnerAgentModel } from '../../types/personalization'
import { summarizeAgentModel } from '../../utils/learnerAgentEngine'

const { Paragraph, Text } = Typography

const AgentMemoryCard: React.FC<{ model: LearnerAgentModel }> = ({ model }) => {
  const summary = summarizeAgentModel(model)

  return (
    <Card title="个人学习 Agent 已生成" style={{ marginBottom: 16 }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <Text strong>当前学习目标：</Text>
          <Paragraph style={{ margin: '6px 0 0' }}>{summary.currentGoal}</Paragraph>
        </div>
        <div>
          <Text strong>当前知识状态：</Text>
          <Paragraph style={{ margin: '6px 0 0' }}>{summary.knowledgeState}</Paragraph>
        </div>
        <div>
          <Text strong>主要薄弱点：</Text>
          <div style={{ marginTop: 6 }}>
            {summary.weakPoints.length > 0
              ? summary.weakPoints.map(item => <Tag color="orange" key={item}>{item}</Tag>)
              : <Text type="secondary">暂无明显薄弱点</Text>}
          </div>
        </div>
        <div>
          <Text strong>适合学习方式：</Text>
          <Paragraph style={{ margin: '6px 0 0' }}>{summary.suitableStyle}</Paragraph>
        </div>
        <div>
          <Text strong>推荐学习模式：</Text>
          <Tag color="red">{summary.recommendedMode}</Tag>
        </div>
        <div>
          <Text strong>下一步建议：</Text>
          <Paragraph style={{ margin: '6px 0 0' }}>{summary.nextBestAction}</Paragraph>
        </div>
        <Text type="secondary">Agent 记忆更新时间：{summary.updatedAt.replace('T', ' ').slice(0, 16)}</Text>
      </Space>
    </Card>
  )
}

export default AgentMemoryCard
