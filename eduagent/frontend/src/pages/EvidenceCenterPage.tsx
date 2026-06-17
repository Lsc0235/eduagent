import React, { useEffect, useState } from 'react'
import { Button, Card, Col, Row, Space, Statistic, Tag, Timeline, Typography } from 'antd'
import {
  BarChartOutlined,
  BookOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

interface EvidenceStatus {
  profileFilled: number
  resourceCount: number
  qualityResourceCount: number
  qualityScore: number
  graphNodes: number
  evaluationScore: number
  wrongTotal: number
  wrongUnmastered: number
  agentTraceCount: number
}

const evidenceLinks = [
  {
    title: '动态学生画像',
    desc: '展示 7 个画像维度、置信度和画像版本',
    route: '/profile',
    icon: <UserOutlined />,
    color: '#0891b2',
  },
  {
    title: '智能错题本',
    desc: '展示持久化错题、知识点分组、复习和变式练习',
    route: '/wrong-book',
    icon: <FileSearchOutlined />,
    color: '#d97706',
  },
  {
    title: '个性化资源',
    desc: '展示讲解、思维导图、练习题、代码案例和动画分镜',
    route: '/resources',
    icon: <BookOutlined />,
    color: '#059669',
  },
  {
    title: '知识图谱',
    desc: '展示人工智能导论知识点依赖关系和推荐学习顺序',
    route: '/path',
    icon: <NodeIndexOutlined />,
    color: '#7c3aed',
  },
  {
    title: '学习评估',
    desc: '展示画像、资源、测验、错题共同形成的评估报告',
    route: '/evaluation',
    icon: <BarChartOutlined />,
    color: '#dc2626',
  },
  {
    title: '资源搜索',
    desc: '展示本地资源检索和推荐能力',
    route: '/search',
    icon: <SearchOutlined />,
    color: '#2563eb',
  },
  {
    title: '智能练习',
    desc: '展示题目生成、答题批改和薄弱点识别',
    route: '/quiz',
    icon: <ExperimentOutlined />,
    color: '#ea580c',
  },
  {
    title: '智能对话',
    desc: '展示多智能体协作记录和对话式学习入口',
    route: '/chat',
    icon: <MessageOutlined />,
    color: '#4f46e5',
  },
]

const EvidenceCenterPage: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<EvidenceStatus>({
    profileFilled: 0,
    resourceCount: 0,
    qualityResourceCount: 0,
    qualityScore: 0,
    graphNodes: 0,
    evaluationScore: 0,
    wrongTotal: 0,
    wrongUnmastered: 0,
    agentTraceCount: 0,
  })

  useEffect(() => {
    const load = async () => {
      const next = { ...status }
      try {
        const profile = await (await fetch('/api/profile/default')).json()
        const dimensions = profile.dimensions || {}
        next.profileFilled = Object.values(dimensions).filter((value: any) => value?.value).length
      } catch {}
      try {
        const resources = await (await fetch('/api/resource/list/default')).json()
        const resourceList = Array.isArray(resources) ? resources : (resources.resources || [])
        next.resourceCount = Array.isArray(resources) ? resources.length : Number(resources.count || resourceList.length || 0)
        const qualityChecks = resourceList
          .map((item: any) => item.extra_data?.quality_check)
          .filter((item: any) => item && typeof item.score === 'number')
        next.qualityResourceCount = qualityChecks.length
        next.qualityScore = qualityChecks.length
          ? Math.round(qualityChecks.reduce((sum: number, item: any) => sum + Number(item.score || 0), 0) / qualityChecks.length)
          : 0
        const resourceTraces = resourceList.flatMap((item: any) => item.extra_data?.agent_trace || [])
        next.agentTraceCount = Math.max(next.agentTraceCount, resourceTraces.length)
      } catch {}
      try {
        const graph = await (await fetch('/api/graph/graph')).json()
        next.graphNodes = Number(graph.graph?.nodes?.length || 0)
      } catch {}
      try {
        const evaluation = await (await fetch('/api/evaluation/report/default')).json()
        next.evaluationScore = Number(evaluation.report?.overall_score || 0)
        next.qualityResourceCount = Math.max(next.qualityResourceCount, Number(evaluation.report?.evidence?.quality_resource_count || 0))
        next.qualityScore = Math.max(next.qualityScore, Number(evaluation.report?.evidence?.avg_resource_quality || 0))
        next.agentTraceCount = Math.max(next.agentTraceCount, Number(evaluation.report?.evidence?.agent_trace_count || 0))
      } catch {}
      try {
        const wrong = await (await fetch('/api/wrong-book/stats/default')).json()
        next.wrongTotal = Number(wrong.total || 0)
        next.wrongUnmastered = Number(wrong.unmastered || 0)
      } catch {}
      try {
        const messages = await (await fetch('/api/chat/messages/demo-a3')).json()
        next.agentTraceCount = Array.isArray(messages)
          ? next.agentTraceCount + messages.filter((msg: any) => Array.isArray(msg.extra_data?.agents) && msg.extra_data.agents.length > 0).length
          : next.agentTraceCount
      } catch {}
      setStatus(next)
    }
    load()
  }, [])

  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ marginBottom: 4 }}>证据中心</Title>
        <Text type="secondary">把分散功能收纳为答辩证据，主线只围绕“错因驱动个性化学习闭环”。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="画像维度" value={status.profileFilled} suffix="/7" />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="资源" value={status.resourceCount} suffix="份" />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="质检" value={status.qualityScore} suffix="分" />
            <Text type="secondary">{status.qualityResourceCount} 份</Text>
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="图谱节点" value={status.graphNodes} />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="错题" value={status.wrongTotal} suffix="道" />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="Agent记录" value={status.agentTraceCount} suffix="条" />
          </Card>
        </Col>
        <Col xs={12} md={4}>
          <Card>
            <Statistic title="评估" value={status.evaluationScore} suffix="分" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {evidenceLinks.map(item => (
          <Col xs={24} sm={12} lg={6} key={item.route}>
            <Card
              hoverable
              onClick={() => navigate(item.route)}
              style={{ height: '100%', borderTop: `3px solid ${item.color}` }}
            >
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Space>
                  <span style={{ color: item.color, fontSize: 20 }}>{item.icon}</span>
                  <Text strong>{item.title}</Text>
                </Space>
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{item.desc}</Paragraph>
                <Button size="small" onClick={(event) => { event.stopPropagation(); navigate(item.route) }}>查看</Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="闭环证据链" style={{ marginTop: 16 }}>
        <Timeline
          items={[
            { color: 'blue', children: `画像覆盖 ${status.profileFilled}/7，为个性化资源生成提供输入` },
            { color: 'green', children: `已沉淀 ${status.resourceCount} 份学习资源，覆盖讲解、导图、题目、阅读和代码` },
            { color: 'cyan', children: `${status.qualityResourceCount} 份资源带自动质检，平均质检 ${status.qualityScore || 0} 分` },
            { color: 'purple', children: `知识图谱包含 ${status.graphNodes} 个节点，用于学习路径和先修关系说明` },
            { color: 'orange', children: `错题本保留 ${status.wrongTotal} 道错题，其中 ${status.wrongUnmastered} 道待补强` },
            { color: 'red', children: `评估报告当前 ${status.evaluationScore} 分，融合测评、错因和学习记录` },
          ]}
        />
        <Space wrap>
          <Tag color="cyan">可演示</Tag>
          <Tag color="green">可验证</Tag>
          <Tag color="orange">可解释</Tag>
          <Tag color="blue">可扩展</Tag>
        </Space>
      </Card>
    </div>
  )
}

export default EvidenceCenterPage
