import React from 'react'
import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import type { PersonalizedResource } from '../../types/personalization'

const { Text, Paragraph } = Typography

const PersonalizedResourceGrid: React.FC<{ resources: PersonalizedResource[] }> = ({ resources }) => (
  <Card title="个性化资源卡片" style={{ marginTop: 16 }}>
    <Row gutter={[12, 12]}>
      {resources.map(resource => (
        <Col xs={24} md={8} key={`${resource.type}-${resource.title}`}>
          <Card size="small" style={{ height: '100%' }}>
            <Space direction="vertical" size={8}>
              <Tag color="purple">{resource.type}</Tag>
              <Text strong>{resource.title}</Text>
              <Paragraph style={{ margin: 0 }}>{resource.reason}</Paragraph>
              <Text type="secondary">{resource.contentPreview}</Text>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
)

export default PersonalizedResourceGrid
