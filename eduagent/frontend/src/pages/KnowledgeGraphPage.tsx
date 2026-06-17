import React, { useState, useEffect } from 'react'
import { Card, Typography, Spin, Tag, Row, Col, Space, Alert, Steps } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, NodeIndexOutlined } from '@ant-design/icons'
import MermaidDiagram from '../components/MermaidDiagram'

const { Title, Text } = Typography

const levelLabels: Record<number, string> = { 1: '基础', 2: '核心', 3: '进阶', 4: '算法', 5: '应用' }
const levelColors: Record<number, string> = { 1: '#4F46E5', 2: '#7C3AED', 3: '#2563EB', 4: '#D97706', 5: '#DC2626' }

const KnowledgeGraphPage: React.FC = () => {
  const [graph, setGraph] = useState<any>(null)
  const [recommendation, setRecommendation] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/graph/graph').then(r => r.json()),
      fetch('/api/graph/recommend/default').then(r => r.json()).catch(() => null),
    ])
      .then(([graphData, recData]) => {
        setGraph(graphData.graph)
        setRecommendation(recData?.success ? recData : null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>
  if (!graph) return <div style={{ padding: 24 }}><Alert type="error" message="加载失败" /></div>

  // 生成 Mermaid 流程图
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  let mermaidCode = 'graph TD\n'
  edges.forEach((e: any) => {
    const fromNode = nodes.find((n: any) => n.id === e.from)
    const toNode = nodes.find((n: any) => n.id === e.to)
    if (fromNode && toNode) {
      mermaidCode += `    ${fromNode.id}["${fromNode.name}"] --> ${toNode.id}["${toNode.name}"]\n`
    }
  })

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}><NodeIndexOutlined style={{ marginRight: 8, color: '#4F46E5' }} />知识图谱</Title>
        <Text type="secondary">人工智能导论课程知识点关系与画像驱动推荐路径</Text>
      </div>

      {/* 图例 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text type="secondary">知识层级：</Text>
          {[1, 2, 3, 4, 5].map(level => (
            <Tag key={level} color={levelColors[level]}>{level}. {levelLabels[level]}</Tag>
          ))}
        </Space>
      </Card>

      {recommendation && (
        <Card title="画像驱动推荐路径" style={{ marginBottom: 16 }}>
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message={recommendation.strategy}
            description={recommendation.profile_used ? '系统已读取学习画像、测验记录和薄弱点，生成当前推荐顺序。' : '暂无完整画像，当前使用知识先修关系推荐。'}
          />
          <Steps
            direction="vertical"
            size="small"
            items={(recommendation.path || []).slice(0, 8).map((node: any) => ({
              title: (
                <Space wrap>
                  <Text strong>{node.name}</Text>
                  <Tag color={node.color}>L{node.level} {levelLabels[node.level]}</Tag>
                  <Tag color={node.status === 'mastered' ? 'green' : node.status === 'weak' ? 'orange' : 'blue'}>
                    {node.status === 'mastered' ? '已掌握' : node.status === 'weak' ? '需补强' : '推荐学习'}
                  </Tag>
                </Space>
              ),
              description: (
                <Space direction="vertical" size={2}>
                  <Text type="secondary">{node.reason}</Text>
                  <Text type="secondary"><ClockCircleOutlined /> 预计 {node.estimated_time}</Text>
                </Space>
              ),
              icon: node.status === 'mastered' ? <CheckCircleOutlined /> : undefined,
            }))}
          />
          {recommendation.weak_points?.length > 0 && (
            <Space wrap style={{ marginTop: 12 }}>
              <Text type="secondary">薄弱点：</Text>
              {recommendation.weak_points.map((point: string, index: number) => (
                <Tag key={index} color="orange">{point}</Tag>
              ))}
            </Space>
          )}
        </Card>
      )}

      {/* Mermaid 图表 */}
      <Card title="知识点关系流程图" style={{ marginBottom: 16 }}>
        <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, overflow: 'auto' }}>
          <div id="mermaid-graph" style={{ padding: 16, background: '#fafafa', borderRadius: 8, textAlign: 'center' }}>
            {mermaidCode && <MermaidDiagram code={mermaidCode} />}
          </div>
        </div>
        <Alert type="info" style={{ marginTop: 12 }} showIcon
          description="Mermaid 流程图展示知识点之间的学习顺序和依赖关系。先学基础，再学进阶。" />
      </Card>

      {/* 知识点卡片 */}
      <Title level={4}>全部知识点</Title>
      <Row gutter={[12, 12]}>
        {nodes.map((node: any) => (
          <Col xs={12} sm={8} md={6} lg={4} key={node.id}>
            <Card hoverable size="small" style={{ borderTop: `3px solid ${node.color || '#4F46E5'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{node.name}</div>
              <Tag color={node.color || 'blue'} style={{ marginTop: 4, fontSize: 11 }}>
                L{node.level} {levelLabels[node.level]}
              </Tag>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginTop: 16, background: '#f0f5ff' }} size="small">
        <Text type="secondary">
          学习建议：先掌握 L1-L2 的基础概念，再逐步深入 L3-L5 的算法和应用。
          建议按照箭头方向依次学习，每个节点对应一个知识模块。
        </Text>
      </Card>
    </div>
  )
}

export default KnowledgeGraphPage
