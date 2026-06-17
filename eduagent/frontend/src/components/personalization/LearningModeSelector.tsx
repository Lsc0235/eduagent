import React from 'react'
import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import { AppstoreOutlined, BookOutlined, CodeOutlined } from '@ant-design/icons'
import type { LearningMode } from '../../types/personalization'

const { Text, Paragraph } = Typography

const modes: Array<{
  key: LearningMode
  title: string
  desc: string
  content: string
  icon: React.ReactNode
  tone: string
}> = [
  {
    key: 'single_topic',
    title: '单点速学',
    desc: '适合只想快速学懂一个知识点。',
    content: '解释、图解、关键概念、练习题、下一步推荐。',
    icon: <AppstoreOutlined />,
    tone: 'red',
  },
  {
    key: 'system_study',
    title: '系统学习',
    desc: '适合系统学习一门课程或一本教材。',
    content: '教材推荐、长期计划、配套视频、代码、测评。',
    icon: <BookOutlined />,
    tone: 'blue',
  },
  {
    key: 'project_task',
    title: '项目任务',
    desc: '适合通过项目实践掌握知识点。',
    content: '项目案例、任务步骤、代码示例、检查标准。',
    icon: <CodeOutlined />,
    tone: 'gold',
  },
]

interface Props {
  activeMode: LearningMode
  onSelect: (mode: LearningMode) => void
  buttonLabels?: Partial<Record<LearningMode, string>>
}

const defaultButtonLabels: Record<LearningMode, string> = {
  single_topic: '进入单点速学',
  system_study: '进入系统学习',
  project_task: '进入项目任务',
}

const LearningModeSelector: React.FC<Props> = ({ activeMode, onSelect, buttonLabels }) => (
  <Card title="学习模式选择区" style={{ marginBottom: 16 }}>
    <Row gutter={[12, 12]}>
      {modes.map(mode => (
        <Col xs={24} md={8} key={mode.key}>
          <Card hoverable style={{ height: '100%', borderWidth: activeMode === mode.key ? 4 : undefined }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space>
                <Tag color={mode.tone}>{mode.icon}</Tag>
                <Text strong>{mode.title}</Text>
              </Space>
              <Paragraph style={{ margin: 0 }}>{mode.desc}</Paragraph>
              <Text type="secondary">{mode.content}</Text>
              <button
                type="button"
                onClick={() => onSelect(mode.key)}
                style={{
                  marginTop: 8,
                  height: 40,
                  border: '2px solid #121212',
                  background: activeMode === mode.key ? '#d91c1c' : '#ffffff',
                  color: activeMode === mode.key ? '#ffffff' : '#121212',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {buttonLabels?.[mode.key] || defaultButtonLabels[mode.key]}
              </button>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
)

export default LearningModeSelector
