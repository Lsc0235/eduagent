import React from 'react'
import { Card, Space, Tag, Typography } from 'antd'
import type { WeaknessRecoveryPlan as Plan } from '../../types/personalization'

const { Text, Paragraph } = Typography

const WeaknessRecoveryPlan: React.FC<{ plan: Plan }> = ({ plan }) => (
  <Card title="错题补弱方案" style={{ marginBottom: 24 }}>
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>{plan.reviewPoints.map(point => <Tag color="red" key={point}>{point}</Tag>)}</Space>
      <div>
        <Text strong>推荐学习顺序</Text>
        {plan.sequence.map(item => <Paragraph key={item} style={{ margin: '6px 0 0' }}>{item}</Paragraph>)}
      </div>
      <div>
        <Text strong>对应讲解资源</Text>
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
          {plan.resources.map(resource => (
            <Card size="small" key={resource.title}>
              <Text strong>{resource.title}</Text>
              <Paragraph style={{ margin: '6px 0 0' }}>{resource.contentPreview}</Paragraph>
            </Card>
          ))}
        </Space>
      </div>
      <Text>建议回到开始学习模块学习：<strong>{plan.returnTopic}</strong></Text>
    </Space>
  </Card>
)

export default WeaknessRecoveryPlan
