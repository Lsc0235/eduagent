import React, { useState, useEffect } from 'react'
import { Card, Typography, Tag, Space, Progress, Row, Col, Spin, Statistic } from 'antd'
import { DashboardOutlined, TrophyOutlined, BookOutlined, ExperimentOutlined, RocketOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/profile/default').then(r => r.json()).catch(() => ({})),
      fetch('/api/quiz/analysis/default').then(r => r.json()).catch(() => ({})),
      fetch('/api/resource/list/default').then(r => r.json()).catch(() => []),
    ]).then(([profile, quiz, resources]) => {
      setData({ profile, quiz, resources })
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Spin size="large" /></div>

  const dp = data || {}
  const quizData = (dp.quiz || {}).analysis || {}
  const resources = Array.isArray(dp.resources) ? dp.resources : (dp.resources || {}).resources || []
  const profile = (dp.profile || {}).dimensions || {}

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}><DashboardOutlined style={{ marginRight: 8, color: '#4F46E5' }} />学习进度</Title>
        <Text type="secondary">你的学习数据一览</Text>
      </div>

      {/* 关键数据 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/learning')} style={{ textAlign: 'center', cursor: 'pointer' }}>
            <RocketOutlined style={{ fontSize: 28, color: '#4F46E5' }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#4F46E5' }}>{quizData.total_quizzes || 0}</div>
            <Text type="secondary">学习次数</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate('/learning')} style={{ textAlign: 'center', cursor: 'pointer' }}>
            <TrophyOutlined style={{ fontSize: 28, color: '#52c41a' }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>{quizData.avg_score || '-'}</div>
            <Text type="secondary">平均分</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ textAlign: 'center' }}>
            <BookOutlined style={{ fontSize: 28, color: '#faad14' }} />
            <div style={{ fontSize: 28, fontWeight: 700 }}>{resources.length}</div>
            <Text type="secondary">生成资料</Text>
          </Card>
        </Col>
        <Col span={6} onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <Card style={{ textAlign: 'center' }}>
            <ExperimentOutlined style={{ fontSize: 28, color: '#722ed1' }} />
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {Object.values(profile).filter((v: any) => v?.value).length}
            </div>
            <Text type="secondary">画像维度</Text>
          </Card>
        </Col>
      </Row>

      {/* 薄弱点 */}
      {quizData.weak_topics?.length > 0 && (
        <Card title="⚠️ 需要加强的知识点" style={{ marginBottom: 16 }}>
          <Space wrap>
            {quizData.weak_topics.map((t: string, i: number) => (
              <Tag key={i} color="red" style={{ padding: '4px 12px', fontSize: 13 }}>{t}</Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* 行动引导 */}
      <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', textAlign: 'center' }}>
        <Title level={4} style={{ color: 'white' }}>准备好学习了？</Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
          AI 将根据你的水平生成资料 + 测试 + 补强
        </Text>
        <div style={{ marginTop: 16 }}>
          <Tag style={{ cursor: 'pointer', padding: '6px 20px', fontSize: 14, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)' }}
            onClick={() => navigate('/learning')}>
            🚀 开始学习
          </Tag>
        </div>
      </Card>

      {/* 最近生成资料 */}
      {resources.length > 0 && (
        <Card title="📚 最近生成的学习资料" style={{ marginTop: 16 }}>
          {resources.slice(0, 5).map((r: any, i: number) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Space>
                <Tag>{r.resource_type}</Tag>
                <Text>{r.title}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{r.topic}</Text>
              </Space>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

export default DashboardPage
