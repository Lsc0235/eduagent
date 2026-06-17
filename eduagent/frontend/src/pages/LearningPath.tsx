import React, { useState } from 'react'
import { Card, Typography, Tag, Space, Input, Spin, message, Row, Col, Alert, Button, Descriptions, Badge } from 'antd'
import { SearchOutlined, LinkOutlined, PlayCircleOutlined, FileTextOutlined, BookOutlined, ThunderboltOutlined, GlobalOutlined, RobotOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const platformIcons: Record<string, React.ReactNode> = {
  'B站': <PlayCircleOutlined style={{ color: '#fb7299' }} />,
  'bilibili': <PlayCircleOutlined style={{ color: '#fb7299' }} />,
  'YouTube': <PlayCircleOutlined style={{ color: '#ff0000' }} />,
  'Coursera': <GlobalOutlined style={{ color: '#0056d2' }} />,
  '网易云课堂': <GlobalOutlined style={{ color: '#c9392a' }} />,
  '慕课网': <GlobalOutlined style={{ color: '#1aad19' }} />,
  'CSDN': <FileTextOutlined style={{ color: '#fc5531' }} />,
  '知乎': <FileTextOutlined style={{ color: '#0066ff' }} />,
}

const platformColors: Record<string, string> = {
  'B站': '#fb7299', 'bilibili': '#fb7299', 'YouTube': '#ff0000',
  'Coursera': '#0056d2', '网易云课堂': '#c9392a', '慕课网': '#1aad19',
  'CSDN': '#fc5531', '知乎': '#0066ff',
}

const typeIcons: Record<string, React.ReactNode> = {
  '视频教程': <PlayCircleOutlined />,
  '文章': <FileTextOutlined />,
  '课程': <BookOutlined />,
  '书籍': <BookOutlined />,
}

const LearningPathPage: React.FC = () => {
  const [query, setQuery] = useState('')
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  
  // 🆕 新增：路径调整状态
  const [adjusting, setAdjusting] = useState(false)
  const [adjustResult, setAdjustResult] = useState<any>(null)

  const searchResources = async (val?: string) => {
    const q = val || query
    if (!q.trim()) { message.warning('请输入要搜索的课程名称'); return }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch('/api/path/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResources(data.resources || [])
    } catch {
      message.error('搜索失败，请重试')
    }
    setLoading(false)
  }

  // 🆕 新增：智能调整学习路径
  const adjustPath = async () => {
    setAdjusting(true)
    try {
      const res = await fetch('/api/path/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: 'default' })
      })
      const data = await res.json()
      if (data.success) {
        setAdjustResult(data)
        message.success('路径调整完成！')
      } else {
        message.warning(data.error || '调整失败')
      }
    } catch (err) {
      message.error('路径调整失败，请重试')
    }
    setAdjusting(false)
  }

  const popularCourses = ['人工智能导论', '机器学习', 'Python入门', '深度学习', '数据结构', '计算机网络', '操作系统', '线性代数']

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Title level={3}>
          <SearchOutlined style={{ marginRight: 8, color: '#4F46E5' }} />
          学习资源搜索
        </Title>
        <Text type="secondary">输入课程名称，AI 为你找到最好的在线学习资源</Text>
      </div>

      {/* 🆕 智能路径调整区域 */}
      <Card 
        style={{ marginBottom: 24, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        variant="borderless"
      >
        <Row gutter={16} align="middle">
          <Col xs={24} md={16}>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              <RobotOutlined style={{ marginRight: 8 }} />
              智能学习路径调整
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.85)', margin: '8px 0 0' }}>
              根据你的测评成绩和学习表现，AI 会自动调整学习路径，为薄弱知识点插入补强资源
            </Paragraph>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Button 
              type="primary" 
              size="large"
              icon={<ThunderboltOutlined />}
              loading={adjusting}
              onClick={adjustPath}
              style={{ 
                background: '#fff', 
                color: '#4F46E5',
                borderColor: '#fff',
                fontWeight: 600
              }}
            >
              智能调整路径
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 🆕 路径调整结果展示 */}
      {adjustResult && (
        <Card 
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>路径调整结果</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Alert 
            type="success" 
            message={adjustResult.summary} 
            style={{ marginBottom: 16 }}
          />
          
          {adjustResult.evaluation_summary && (
            <Descriptions column={3} bordered size="small">
              <Descriptions.Item label="薄弱知识点">
                <Badge count={adjustResult.evaluation_summary.weak_points_count} showZero style={{ backgroundColor: '#ff4d4f' }} />
                <Text> 个需补强</Text>
              </Descriptions.Item>
              <Descriptions.Item label="学习效率">
                <Text strong style={{ color: adjustResult.evaluation_summary.learning_efficiency >= 60 ? '#52c41a' : '#faad14' }}>
                  {adjustResult.evaluation_summary.learning_efficiency.toFixed(1)}%
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="已完成测验">
                <Text>{adjustResult.evaluation_summary.total_quizzes} 次</Text>
              </Descriptions.Item>
            </Descriptions>
          )}

          {adjustResult.adjustments?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Title level={5}>调整详情：</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                {adjustResult.adjustments.map((adj: any, index: number) => (
                  <Card 
                    key={index} 
                    size="small" 
                    style={{ 
                      borderLeft: `4px solid ${adj.type === 'insert_reinforcement' ? '#ff4d4f' : adj.type === 'skip_topic' ? '#52c41a' : '#1890ff'}` 
                    }}
                  >
                    <Space>
                      {adj.type === 'insert_reinforcement' && <WarningOutlined style={{ color: '#ff4d4f' }} />}
                      {adj.type === 'skip_topic' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      <Text strong>{adj.topic_id || adj.type}</Text>
                      <Text type="secondary">-</Text>
                      <Text>{adj.reason}</Text>
                    </Space>
                    {adj.resources && (
                      <div style={{ marginTop: 8, marginLeft: 24 }}>
                        <Text type="secondary">补强资源：</Text>
                        <Space wrap>
                          {adj.resources.map((res: any, i: number) => (
                            <Tag key={i} color="blue">{res.title}</Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                  </Card>
                ))}
              </Space>
            </div>
          )}
        </Card>
      )}

      {/* 搜索框 */}
      <div style={{ marginBottom: 24, maxWidth: 700, margin: '0 auto 24px' }}>
        <Input.Search
          size="large"
          placeholder="输入你想学的课程，如：人工智能、Python、深度学习..."
          enterButton={<><ThunderboltOutlined /> AI 搜索</>}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onSearch={searchResources}
          loading={loading}
        />
      </div>

      {/* 热门课程标签 */}
      {!searched && (
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Text type="secondary" style={{ marginRight: 8 }}>热门课程：</Text>
          <Space wrap>
            {popularCourses.map(course => (
              <Tag 
                key={course} 
                color="blue" 
                style={{ cursor: 'pointer' }}
                onClick={() => { setQuery(course); searchResources(course) }}
              >
                {course}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {/* 搜索结果 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" tip="AI 正在为你搜索最佳资源..." /></div>
      ) : searched && resources.length === 0 ? (
        <Alert type="info" message="未找到相关资源" description="请尝试其他关键词" showIcon />
      ) : (
        <Row gutter={[16, 16]}>
          {resources.map((r, i) => {
            const p = r.platform || 'B站'
            return (
              <Col xs={24} md={12} key={i}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <Card 
                    hoverable 
                    style={{ height: '100%', borderLeft: `4px solid ${platformColors[p] || '#4F46E5'}` }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Tag color={platformColors[p] || 'default'}>
                          {platformIcons[p] || <GlobalOutlined />} {p}
                        </Tag>
                        {r.difficulty && <Tag>{r.difficulty}</Tag>}
                        {r.play_count && <Tag color="purple">播放量: {r.play_count.toLocaleString()}</Tag>}
                      </Space>
                      <Title level={5} style={{ margin: '8px 0' }}>{r.title}</Title>
                      <Text type="secondary">{r.description}</Text>
                      {r.reason && <Text type="secondary" style={{ fontStyle: 'italic' }}>推荐理由：{r.reason}</Text>}
                      <Space>
                        <LinkOutlined />
                        <Text style={{ color: '#1677ff' }}>点击访问课程</Text>
                      </Space>
                    </Space>
                  </Card>
                </a>
              </Col>
            )
          })}
        </Row>
      )}
    </div>
  )
}

export default LearningPathPage
