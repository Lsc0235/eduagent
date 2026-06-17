import React from 'react'
import { Alert, Card, Col, Row, Space, Tag, Typography } from 'antd'
import { CodeOutlined } from '@ant-design/icons'
import type { ProjectTask } from '../../types/personalization'

const { Title, Text, Paragraph } = Typography

const ProjectTaskPanel: React.FC<{ task: ProjectTask }> = ({ task }) => (
  <div>
    <Alert type="info" showIcon message="项目任务区域" description={task.fitReason} style={{ marginBottom: 16 }} />
    <Card title={task.projectName} style={{ marginBottom: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>项目目标</Title>
        <Paragraph>{task.projectGoal}</Paragraph>
        <Space wrap>{task.prerequisites.map(item => <Tag key={item}>{item}</Tag>)}</Space>
        <Alert type="warning" message="任务背景" description={task.background} showIcon />
      </Space>
    </Card>

    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card title="分步骤任务" style={{ height: '100%' }}>
          <Space direction="vertical">
            {task.steps.map((step, index) => <Text key={step}>{index + 1}. {step}</Text>)}
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title={<Space><CodeOutlined />代码示例</Space>} style={{ height: '100%' }}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{task.codeExample}</pre>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="检查标准">
          <Space direction="vertical">{task.checklist.map(item => <Text key={item}>□ {item}</Text>)}</Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="拓展方向">
          <Space wrap>{task.extensions.map(item => <Tag color="blue" key={item}>{item}</Tag>)}</Space>
        </Card>
      </Col>
    </Row>
  </div>
)

export default ProjectTaskPanel
