import React, { useEffect } from 'react'
import { Alert, Button, Card, Col, Row, Space, Tag, Typography, message } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import BackToLearningButton from '../components/personalization/BackToLearningButton'
import ProjectTaskPanel from '../components/personalization/ProjectTaskPanel'
import { readLearnerAgentModel, saveCurrentLearningContext, saveProjectWorkspace } from '../services/learningData'
import { generateProjectTask, generateProjectWorkspace } from '../utils/learnerAgentEngine'

const { Paragraph, Title } = Typography

const ProjectTaskPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const topic = new URLSearchParams(location.search).get('topic') || ''
  const model = readLearnerAgentModel()
  const task = topic ? generateProjectTask(topic, model) : null
  const diagnosticScore = model.diagnosticProfile.diagnosticScore
  const shouldWarmup = model.diagnosticProfile.weakConcepts.length >= 2 || (typeof diagnosticScore === 'number' && diagnosticScore < 60)

  useEffect(() => {
    if (!topic) return
    saveCurrentLearningContext({
      topic,
      mode: 'project_task',
    })
  }, [topic])

  const enterProjectWorkspace = () => {
    const workspace = generateProjectWorkspace(topic, model)
    saveProjectWorkspace(workspace)
    saveCurrentLearningContext({
      topic,
      mode: 'project_task',
      currentPlanId: workspace.id,
    })
    message.success('已生成项目任务工作台')
    navigate(`/learn/project-workspace?topic=${encodeURIComponent(topic)}&project=${encodeURIComponent(workspace.id)}`)
  }

  if (!topic || !task) {
    return (
      <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
        <BackToLearningButton />
        <Alert type="warning" showIcon message="缺少学习主题" description="请先回到开始学习页输入知识点。" style={{ marginTop: 16 }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <BackToLearningButton topic={topic} />

        <Card>
          <Title level={3} style={{ marginBottom: 8 }}>{topic} · 项目任务</Title>
          <Paragraph style={{ marginBottom: 0 }}>
            项目任务由个人学习 Agent 根据你的目标、诊断结果和薄弱点生成，不再是只按主题返回通用模板。
          </Paragraph>
        </Card>

        {shouldWarmup && (
          <Alert
            type="warning"
            showIcon
            message="建议先完成基础补强"
            description={`当前诊断显示你还需要先补强：${model.diagnosticProfile.weakConcepts.slice(0, 3).join('、') || '基础概念'}。下面的任务已自动调整为轻量版项目。`}
          />
        )}

        <ProjectTaskPanel task={task} />

        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Card title="为什么适合当前用户">
              <Space wrap>
                <Tag color="blue">{model.explicitProfile.statedGoal || '目标驱动'}</Tag>
                <Tag color="orange">{model.behaviorProfile.preferredContentByBehavior.join('、') || '案例优先'}</Tag>
                {model.diagnosticProfile.weakConcepts.slice(0, 2).map(item => <Tag color="red" key={item}>{item}</Tag>)}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="完成任务后会发生什么">
              <Paragraph style={{ margin: 0 }}>
                完成记录会回写到 Agent，更新最近学习主题、掌握情况和下一步建议，供后续的错题本、评估页和对话助手继续使用。
              </Paragraph>
            </Card>
          </Col>
        </Row>

        <Button type="primary" onClick={enterProjectWorkspace}>
          进入项目任务工作台
        </Button>
      </Space>
    </div>
  )
}

export default ProjectTaskPage
