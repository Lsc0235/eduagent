import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  message,
  Progress,
  Row,
  Space,
  Statistic,
  Steps,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import {
  BarChartOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  RocketOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

interface LoopStatus {
  apiReady: boolean
  profileVersion: number
  profileFilled: number
  resourceCount: number
  qualityResourceCount: number
  qualityScore: number
  graphNodes: number
  graphEdges: number
  evaluationScore: number
  quizCount: number
  learningMinutes: number
  wrongQuestionCount: number
  unmasteredWrongCount: number
  agentTraceCount: number
  latestAgents: string[]
}

const emptyStatus: LoopStatus = {
  apiReady: false,
  profileVersion: 0,
  profileFilled: 0,
  resourceCount: 0,
  qualityResourceCount: 0,
  qualityScore: 0,
  graphNodes: 0,
  graphEdges: 0,
  evaluationScore: 0,
  quizCount: 0,
  learningMinutes: 0,
  wrongQuestionCount: 0,
  unmasteredWrongCount: 0,
  agentTraceCount: 0,
  latestAgents: [],
}

const loopSteps = [
  { title: '画像', description: '识别基础、目标、习惯、易错点', icon: <UserOutlined /> },
  { title: '规划', description: 'Planner 调度专职智能体', icon: <RobotOutlined /> },
  { title: '资源', description: '生成讲解、导图、题目、代码、分镜', icon: <BookOutlined /> },
  { title: '测评', description: '在线批改并定位薄弱点', icon: <ExperimentOutlined /> },
  { title: '错因', description: '错题持久化和变式练习', icon: <FileSearchOutlined /> },
  { title: '评估', description: '用证据更新下一步建议', icon: <BarChartOutlined /> },
]

const evidenceTimeline = [
  { color: 'blue', children: '不是简单聊天：复杂任务会进入 Planner -> 多 Agent 并行执行 -> Aggregator 聚合' },
  { color: 'green', children: '不是固定资料：资源生成会结合画像、学习目标和薄弱点' },
  { color: 'orange', children: '不是做完即止：测验错题会持久化，后续用于复习和变式训练' },
  { color: 'red', children: '不是只展示分数：评估报告同时读取画像、资源、成绩、错题和学习记录' },
]

const pitchCards = [
  {
    time: '0:00 - 0:30',
    title: '一句话定位',
    content: '我们不是做普通学习平台，而是让学生错因驱动下一轮个性化资源生成。',
  },
  {
    time: '0:30 - 1:20',
    title: '跑主线闭环',
    content: '从画像、资源、测评、错题、补强到评估，按页面上的六步闭环讲，不展开旁支功能。',
  },
  {
    time: '1:20 - 2:20',
    title: '讲创新证据',
    content: '打开资源或证据中心，展示画像维度、错因标签、多智能体记录和评估分数。',
  },
  {
    time: '2:20 - 3:00',
    title: '回答落地性',
    content: '强调错题、学习记录和资源都持久化保存，系统重启后仍可继续补强。',
  },
]

const CompetitionDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<LoopStatus>(emptyStatus)
  const [loading, setLoading] = useState(true)

  const loadStatus = async () => {
    setLoading(true)
    const next: LoopStatus = { ...emptyStatus }

    try {
      const apiRes = await fetch('/api/test')
      next.apiReady = apiRes.ok
    } catch {
      next.apiReady = false
    }

    try {
      const profileRes = await fetch('/api/profile/default')
      const profile = await profileRes.json()
      const dimensions = profile.dimensions || {}
      next.profileVersion = Number(profile.profile_version || 0)
      next.profileFilled = Object.values(dimensions).filter((value: any) => value?.value).length
    } catch {
      next.profileVersion = 0
    }

    try {
      const resourceRes = await fetch('/api/resource/list/default')
      const payload = await resourceRes.json()
      const resources = Array.isArray(payload) ? payload : (payload.resources || [])
      if (Array.isArray(payload)) {
        next.resourceCount = payload.length
      } else {
        next.resourceCount = Number(payload.count ?? resources.length ?? 0)
      }
      const qualityChecks = resources
        .map((item: any) => item.extra_data?.quality_check)
        .filter((item: any) => item && typeof item.score === 'number')
      next.qualityResourceCount = qualityChecks.length
      next.qualityScore = qualityChecks.length
        ? Math.round(qualityChecks.reduce((sum: number, item: any) => sum + Number(item.score || 0), 0) / qualityChecks.length)
        : 0
      const resourceTraces = resources.flatMap((item: any) => item.extra_data?.agent_trace || [])
      if (resourceTraces.length) {
        next.agentTraceCount = resourceTraces.length
        next.latestAgents = resourceTraces.slice(-6).map((step: any) => step.agent).filter(Boolean)
      }
    } catch {
      next.resourceCount = 0
      next.qualityResourceCount = 0
      next.qualityScore = 0
    }

    try {
      const graphRes = await fetch('/api/graph/graph')
      const graph = await graphRes.json()
      next.graphNodes = Number(graph.graph?.nodes?.length || 0)
      next.graphEdges = Number(graph.graph?.edges?.length || 0)
    } catch {
      next.graphNodes = 0
      next.graphEdges = 0
    }

    try {
      const evaluationRes = await fetch('/api/evaluation/report/default')
      const evaluation = await evaluationRes.json()
      const report = evaluation.report || {}
      next.evaluationScore = Number(report.overall_score || 0)
      next.quizCount = Number(report.evidence?.quiz_count || 0)
      next.learningMinutes = Number(report.evidence?.learning_minutes || 0)
      next.qualityResourceCount = Math.max(next.qualityResourceCount, Number(report.evidence?.quality_resource_count || 0))
      next.qualityScore = Math.max(next.qualityScore, Number(report.evidence?.avg_resource_quality || 0))
      next.agentTraceCount = Math.max(next.agentTraceCount, Number(report.evidence?.agent_trace_count || 0))
    } catch {
      next.evaluationScore = 0
    }

    try {
      const wrongBookRes = await fetch('/api/wrong-book/stats/default')
      const wrongBook = await wrongBookRes.json()
      next.wrongQuestionCount = Number(wrongBook.total || 0)
      next.unmasteredWrongCount = Number(wrongBook.unmastered || 0)
    } catch {
      next.wrongQuestionCount = 0
      next.unmasteredWrongCount = 0
    }

    try {
      const msgRes = await fetch('/api/chat/messages/demo-a3')
      const messages = await msgRes.json()
      const agentMessages = Array.isArray(messages)
        ? messages.filter((msg: any) => Array.isArray(msg.extra_data?.agents) && msg.extra_data.agents.length > 0)
        : []
      next.agentTraceCount += agentMessages.length
      if (!next.latestAgents.length && agentMessages.length) {
        next.latestAgents = agentMessages[agentMessages.length - 1].extra_data?.agents || []
      }
    } catch {
      // 对话记录只是辅助证据，失败时保留资源和评估报告里已经统计到的 Agent 轨迹。
    }

    setStatus(next)
    setLoading(false)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const seedDemo = async () => {
    const hide = message.loading('正在准备闭环演示数据...', 0)
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error()
      hide()
      message.success('闭环演示数据已准备')
      await loadStatus()
    } catch {
      hide()
      message.error('演示数据准备失败，请确认后端服务已启动')
    }
  }

  const readiness = useMemo(() => {
    const checks = [
      status.apiReady,
      status.profileFilled >= 6,
      status.resourceCount >= 5,
      status.qualityResourceCount >= 3 && status.qualityScore >= 75,
      status.graphNodes >= 10,
      status.quizCount >= 2,
      status.wrongQuestionCount >= 1,
      status.agentTraceCount >= 1,
      status.evaluationScore >= 80,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [status])

  const agentTags = status.latestAgents.length
    ? status.latestAgents
    : ['profiler', 'doc_generator', 'quiz_generator', 'evaluator']

  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '1 1 420px', minWidth: 260 }}>
          <Space align="center" style={{ marginBottom: 6, display: 'flex' }}>
            <TrophyOutlined style={{ fontSize: 26, color: '#0f766e' }} />
            <Title level={3} style={{ margin: 0 }}>错因驱动的个性化学习闭环</Title>
          </Space>
          <Text type="secondary">基于大模型的个性化资源生成与学习多智能体系统</Text>
        </div>
        <Space wrap>
          <Tag color={status.apiReady ? 'green' : 'red'}>{status.apiReady ? '后端在线' : '后端离线'}</Tag>
          <Tag color="blue">画像 v{status.profileVersion}</Tag>
          <Button onClick={seedDemo}>准备演示数据</Button>
          <Button type="primary" icon={<RocketOutlined />} onClick={() => navigate('/learning')}>
            开始闭环演示
          </Button>
        </Space>
      </div>

      {!status.apiReady && !loading && (
        <Alert
          type="warning"
          showIcon
          message="后端服务未连接"
          description="请先启动后端服务，再刷新当前页面查看完整实时指标。"
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={15}>
          <Card style={{ height: '100%', borderTop: '4px solid #0f766e' }}>
            <Tag color="cyan" style={{ marginBottom: 12 }}>唯一突出创新点</Tag>
            <Title level={4} style={{ marginTop: 0 }}>把“学生错因”变成下一轮资源生成的发动机</Title>
            <Paragraph style={{ fontSize: 15, marginBottom: 16 }}>
              系统先用画像理解学生，再由多智能体生成资源和测验；测验产生的错题被持久化为错因证据，
              随后驱动补强资料、变式练习和评估报告更新，形成可解释、可复用、可展示的学习闭环。
            </Paragraph>
            <Space wrap>
              <Tag color="blue">画像识别</Tag>
              <Tag color="geekblue">多智能体调度</Tag>
              <Tag color="green">个性化资源</Tag>
              <Tag color="orange">错因补强</Tag>
              <Tag color="red">评估闭环</Tag>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card style={{ height: '100%' }}>
            <Statistic title="演示成熟度" value={readiness} suffix="%" prefix={<CheckCircleOutlined />} />
            <Progress percent={readiness} strokeColor="#0f766e" />
            <Text type="secondary">由画像、资源、图谱、测评、错题、多智能体证据共同计算</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="画像覆盖" value={status.profileFilled} suffix="/7" prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="生成资源" value={status.resourceCount} suffix="份" prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="资源质检" value={status.qualityScore || 0} suffix="分" prefix={<CheckCircleOutlined />} />
            <Text type="secondary">{status.qualityResourceCount} 份带质检</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="未掌握错题" value={status.unmasteredWrongCount} suffix="道" prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="学习评估" value={status.evaluationScore || 0} suffix="分" prefix={<BarChartOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title={<Space><RocketOutlined /> 主线闭环</Space>} style={{ marginBottom: 16 }}>
        <Steps
          current={5}
          responsive
          items={loopSteps.map(step => ({
            title: step.title,
            description: step.description,
            icon: step.icon,
          }))}
        />
      </Card>

      <Card title={<Space><TrophyOutlined /> 3 分钟答辩路线</Space>} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {pitchCards.map(card => (
            <Col xs={24} md={12} lg={6} key={card.time}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, height: '100%', background: '#fff' }}>
                <Tag color="green" style={{ marginBottom: 8 }}>{card.time}</Tag>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>{card.title}</Text>
                <Text type="secondary">{card.content}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<Space><RobotOutlined /> 多智能体证据</Space>} style={{ height: '100%' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color={status.agentTraceCount > 0 ? 'blue' : 'default'}>{status.agentTraceCount} 条协作记录</Tag>
                {agentTags.map(agent => <Tag color="geekblue" key={agent}>{agent}</Tag>)}
              </Space>
              <Text type="secondary">
                复杂任务触发 Planner，由文档、导图、练习、代码、分镜、质检、评估和路径规划等专职智能体协作完成。
              </Text>
              <Button onClick={() => navigate('/chat')}>查看智能对话</Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><NodeIndexOutlined /> 可验证支撑</Space>} style={{ height: '100%' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="purple">{status.graphNodes} 个知识节点</Tag>
                <Tag color="purple">{status.graphEdges} 条依赖边</Tag>
                <Tag color="green">{status.qualityResourceCount} 份质检资源</Tag>
                <Tag color="orange">{status.learningMinutes} 分钟学习记录</Tag>
              </Space>
              <Text type="secondary">
                画像、资源、图谱、错题和评估都保留在数据库中，评委追问时可在证据中心逐项打开。
              </Text>
              <Button onClick={() => navigate('/evidence')}>打开证据中心</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="评委应该记住的点" style={{ marginTop: 16 }}>
        <Timeline items={evidenceTimeline} />
      </Card>
    </div>
  )
}

export default CompetitionDashboard
