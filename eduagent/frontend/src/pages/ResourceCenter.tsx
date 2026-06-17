import React, { useState, useEffect } from 'react'
import { Card, Typography, Tag, Space, Button, Select, Empty, Spin, message, Row, Col, Input, Modal, Alert, Tabs } from 'antd'
import { BookOutlined, FileTextOutlined, BranchesOutlined, FormOutlined, CodeOutlined, ReadOutlined, ThunderboltOutlined, VideoCameraOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import MermaidDiagram from '../components/MermaidDiagram'

const { Title, Text } = Typography
const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  document: { label: '课程讲解', icon: <FileTextOutlined />, color: 'blue' },
  mindmap: { label: '思维导图', icon: <BranchesOutlined />, color: 'purple' },
  quiz: { label: '练习题', icon: <FormOutlined />, color: 'green' },
  reading: { label: '拓展阅读', icon: <ReadOutlined />, color: 'orange' },
  code: { label: '代码案例', icon: <CodeOutlined />, color: 'red' },
  storyboard: { label: '动画分镜', icon: <VideoCameraOutlined />, color: 'volcano' },
}

const getPersonalization = (resource: any) => resource?.extra_data?.personalization || {}
const getQualityCheck = (resource: any) => resource?.extra_data?.quality_check || null

const ResourceCenter: React.FC = () => {
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [topic, setTopic] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['document', 'quiz'])
  const [detail, setDetail] = useState<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => { fetchResources() }, [])

  const fetchResources = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/resource/list/default')
      if (!res.ok) throw new Error()
      setResources(await res.json())
    } catch { setError(true) }
    setLoading(false)
  }

  const generateResource = async () => {
    if (!topic.trim()) { message.warning('请输入知识点主题'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/resource/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), resource_types: selectedTypes, student_id: 'default' }),
      })
      const data = await res.json()
      if (data.success) { message.success(`已生成 ${data.count} 份学习资料`); fetchResources() }
      else message.error(data.message || '生成失败')
    } catch { message.error('生成失败，请检查后端服务') }
    setGenerating(false)
  }

  const viewDetail = async (resourceId: string) => {
    try {
      const res = await fetch(`/api/resource/detail/${resourceId}`)
      setDetail(await res.json())
    } catch { message.error('获取详情失败') }
  }

  if (error) return <div style={{ padding: 24 }}><Alert type="warning" message="无法连接后端" description="请确认后端服务已启动，然后刷新页面。" showIcon /></div>

  const isMindmap = detail?.type === 'mindmap'

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}><BookOutlined style={{ marginRight: 8, color: '#4F46E5' }} />资源中心</Title>
        <Text type="secondary">输入知识点，AI 自动生成个性化学习资料</Text>
      </div>

      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f4fd 100%)' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input.Search
            placeholder="输入知识点，如：神经网络、线性回归、CNN、决策树..."
            enterButton={<><ThunderboltOutlined /> 生成资料</>}
            size="large" value={topic} onChange={e => setTopic(e.target.value)}
            onSearch={generateResource} loading={generating}
          />
          <Space>
            <Text>生成类型：</Text>
            <Select mode="multiple" value={selectedTypes} onChange={setSelectedTypes} style={{ minWidth: 300 }}
              options={Object.entries(typeConfig).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Space>
        </Space>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={detail?.title}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={isMindmap ? 900 : 800}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        {detail && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {getPersonalization(detail).personalized && (
              <Alert
                type="info"
                showIcon
                message="个性化生成依据"
                description={
                  <Space direction="vertical" size={4}>
                    <Text>画像维度：{getPersonalization(detail).profile_dimensions || 0} 个</Text>
                    <Space wrap>
                      {(getPersonalization(detail).weak_points || []).map((point: string) => (
                        <Tag key={point} color="orange">{point}</Tag>
                      ))}
                    </Space>
                  </Space>
                }
              />
            )}
            {getQualityCheck(detail) && (
              <Alert
                type={getQualityCheck(detail).passed ? 'success' : 'warning'}
                showIcon
                message={`资源质检：${getQualityCheck(detail).score} 分`}
                description={
                  <Space direction="vertical" size={4}>
                    <Text>{getQualityCheck(detail).passed ? '可用于学习' : '建议补充后使用'}</Text>
                    <Space wrap>
                      {((getQualityCheck(detail).criteria || getQualityCheck(detail).reasons || [])).map((item: string) => (
                        <Tag key={item} color="cyan">{item}</Tag>
                      ))}
                    </Space>
                    {(getQualityCheck(detail).suggestions || []).length > 0 && (
                      <Text type="secondary">建议：{getQualityCheck(detail).suggestions.join('；')}</Text>
                    )}
                  </Space>
                }
              />
            )}
            <Tabs defaultActiveKey="rendered" items={[
              {
                key: 'rendered',
                label: isMindmap ? '思维导图' : '预览',
                children: isMindmap ? (
                  <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, textAlign: 'center' }}>
                    <MermaidDiagram code={detail.content?.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '').trim() || ''} />
                  </div>
                ) : (
                  <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content}</ReactMarkdown></div>
                )
              },
              {
                key: 'source',
                label: '源码',
                children: <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: '60vh' }}>{detail.content}</pre>
              }
            ]} />
          </Space>
        )}
      </Modal>

      <Title level={4}>已有资源 {resources.length > 0 && <Tag>{resources.length}</Tag>}</Title>
      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> :
        resources.length === 0 ? <Card><Empty description="暂无资源，在上方输入知识点生成" /></Card> :
        <Row gutter={[16, 16]}>
          {resources.map(res => {
            const cfg = typeConfig[res.type] || { label: res.type, icon: <FileTextOutlined />, color: 'default' }
            return (
              <Col xs={24} sm={12} lg={8} key={res.resource_id}>
                <Card hoverable className="resource-card" onClick={() => viewDetail(res.resource_id)}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>
                      <Tag>{res.difficulty}</Tag>
                    </div>
                    {getPersonalization(res).personalized && (
                      <Space wrap size={4}>
                        <Tag color="cyan">画像驱动</Tag>
                        {(getPersonalization(res).weak_points || []).length > 0 && <Tag color="orange">错因驱动</Tag>}
                      </Space>
                    )}
                    {getQualityCheck(res) && (
                      <Tag color={getQualityCheck(res).passed ? 'green' : 'gold'}>
                        质检 {getQualityCheck(res).score}
                      </Tag>
                    )}
                    <Text strong style={{ fontSize: 14 }}>{res.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{new Date(res.created_at).toLocaleString('zh-CN')}</Text>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      }
    </div>
  )
}

export default ResourceCenter
