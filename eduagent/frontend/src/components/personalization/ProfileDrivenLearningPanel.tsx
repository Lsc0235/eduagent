import React from 'react'
import { Alert, Button, Card, Col, Row, Space, Tag, Typography } from 'antd'
import { ThunderboltOutlined, UserOutlined } from '@ant-design/icons'
import type { LearningMode, UserProfile } from '../../types/personalization'
import { getLearningModeLabel } from '../../utils/personalizationEngine'
import { isMeaningfulProfile } from '../../services/learningData'

const { Text, Paragraph } = Typography

interface Props {
  topic: string
  profile: UserProfile
  recommendedMode: LearningMode
  reason: string
  onDirectLearning: () => void
  onProfileClick: () => void
}

const summaryFields = [
  ['知识基础', 'knowledgeBase'],
  ['认知风格', 'cognitiveStyle'],
  ['学习目标', 'learningGoal'],
  ['易错点偏好', 'errorPreference'],
  ['兴趣方向', 'interestDirection'],
  ['学习习惯', 'learningHabit'],
] as const

const ProfileDrivenLearningPanel: React.FC<Props> = ({
  topic,
  profile,
  recommendedMode,
  reason,
  onDirectLearning,
  onProfileClick,
}) => {
  const hasProfile = isMeaningfulProfile(profile)

  return (
    <Card
      title={<Space><UserOutlined />画像驱动学习推荐区</Space>}
      style={{ marginBottom: 16 }}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type={hasProfile ? 'info' : 'warning'}
          showIcon
          message={`当前学习知识点：${topic || '未选择'}`}
          description={hasProfile ? '系统已读取你的本地/后端画像，用于生成学习模式和资源推荐。' : '你还没有完善学习画像，系统将使用默认画像生成学习方案。'}
        />

        <Row gutter={[12, 12]}>
          {summaryFields.map(([label, key]) => (
            <Col xs={24} md={12} lg={8} key={key}>
              <Card size="small" className="profile-summary-card">
                <Tag color="blue">{label}</Tag>
                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: '8px 0 0' }}>
                  {profile[key] || '暂未填写'}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>

        <Card size="small" style={{ background: '#fffbe6' }}>
          <Space direction="vertical" size={8}>
            <Space wrap>
              <Text strong>推荐学习模式</Text>
              <Tag color="red">{getLearningModeLabel(recommendedMode)}</Tag>
            </Space>
            <Paragraph style={{ margin: 0 }}>{reason}</Paragraph>
          </Space>
        </Card>

        <Space wrap>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={onDirectLearning}>
            根据画像直接学习
          </Button>
          {!hasProfile && <Button onClick={onProfileClick}>去完善学习画像</Button>}
        </Space>
      </Space>
    </Card>
  )
}

export default ProfileDrivenLearningPanel
