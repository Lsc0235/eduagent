import React, { useState } from 'react'
import { Card, Typography, Tag, Space, Input, Spin, message, Row, Col, Alert } from 'antd'
import { SearchOutlined, LinkOutlined, PlayCircleOutlined, FileTextOutlined, BookOutlined, ThunderboltOutlined, GlobalOutlined, TrophyOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const platformColors: Record<string, string> = {
  'B站': '#fb7299', 'bilibili': '#fb7299', 'YouTube': '#ff0000',
  '慕课网': '#1aad19', 'CSDN': '#fc5531', '知乎': '#0066ff', '掘金': '#1e80ff',
}
const platformIcons: Record<string, React.ReactNode> = {
  'B站': <PlayCircleOutlined />, 'bilibili': <PlayCircleOutlined />, 'YouTube': <PlayCircleOutlined />,
  '慕课网': <BookOutlined />, 'CSDN': <FileTextOutlined />, '知乎': <FileTextOutlined />, '掘金': <FileTextOutlined />,
}
const difficultyColors: Record<string, string> = {
  '入门': 'green', '进阶': 'orange', '高级': 'red',
}
const orderLabels = ['第1步（先学）', '第2步（其次）', '第3步（然后）', '第4步（再学）', '第5步（最后）']

const ResourceSearchPage: React.FC = () => {
  const [query, setQuery] = useState('')
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [profileHint, setProfileHint] = useState('')
  const popular = ['人工智能导论', '机器学习', 'Python入门', '深度学习', '数据结构', '计算机网络', '操作系统']

  const searchResources = async (q?: string) => {
    const val = q || query
    if (!val.trim()) { message.warning('请输入课程名称'); return }
    setLoading(true); setSearched(true)
    try {
      const res = await fetch('/api/path/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: val.trim(), student_id: 'default' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResources(data.resources || [])
      setProfileHint(data.profile_hint || '')
    } catch { message.error('搜索失败') }
    setLoading(false)
  }

  // 按推荐顺序排序
  const sorted = [...resources].sort((a, b) => (a.order || 99) - (b.order || 99))

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Title level={3}><SearchOutlined style={{ marginRight: 8, color: '#4F46E5' }} />个性化资源搜索</Title>
        <Text type="secondary">根据你的学习画像，AI 为你推荐最适合的学习资源和学习顺序</Text>
      </div>

      <div style={{ marginBottom: 24, maxWidth: 700, margin: '0 auto 24px' }}>
        <Input.Search size="large" placeholder="输入课程，如：人工智能、Python、深度学习..."
          enterButton={<><ThunderboltOutlined /> 个性化搜索</>} value={query}
          onChange={e => setQuery(e.target.value)} onSearch={searchResources} loading={loading} />
      </div>

      {!searched && (
        <div style={{ marginBottom: 24, maxWidth: 700, margin: '0 auto 24px', textAlign: 'center' }}>
          <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>热门搜索：</Text>
          <Space wrap>
            {popular.map(c => <Tag key={c} style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }} onClick={() => { setQuery(c); searchResources(c) }}>{c}</Tag>)}
          </Space>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /><Paragraph type="secondary" style={{ marginTop: 12 }}>AI 根据你的画像生成个性化推荐...</Paragraph></div>}

      {!loading && searched && sorted.length === 0 && <Alert type="info" message="未找到资源" description="请尝试其他关键词" showIcon />}

      {!loading && sorted.length > 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Alert type="success" showIcon style={{ marginBottom: 12 }}
              message={`已根据你的学习画像为 "${query}" 生成个性化推荐`} />
            <Text type="secondary">找到 {sorted.length} 个资源，按推荐学习顺序排列</Text>
          </div>

          {sorted.map((r, i) => {
            const p = r.platform || '其他'
            const order = (r.order || i + 1) - 1
            return (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: 12 }}>
                <Card hoverable className="resource-card" style={{ borderLeft: `4px solid ${platformColors[p] || '#4F46E5'}` }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {/* 顺序标签 */}
                    <div style={{ minWidth: 80, textAlign: 'center' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i === 0 ? '#f0f5ff' : '#fafafa', border: `2px solid ${i === 0 ? '#4F46E5' : '#e8e8e8'}`,
                        fontSize: 18, fontWeight: 700, color: i === 0 ? '#4F46E5' : '#999'
                      }}>
                        {r.order || i + 1}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                        {orderLabels[order] || `第${r.order || i + 1}步`}
                      </Text>
                    </div>

                    {/* 内容 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <Tag color={platformColors[p] || 'default'}>{platformIcons[p] || <GlobalOutlined />} {p}</Tag>
                        <Tag color={difficultyColors[r.difficulty] || 'default'}>{r.difficulty || '未知'}</Tag>
                      </div>
                      <Text strong style={{ fontSize: 16 }}>{r.title}</Text>
                      <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>{r.description}</Paragraph>
                      {r.reason && (
                        <div style={{ marginTop: 4, padding: '4px 8px', background: '#f6ffed', borderRadius: 4, fontSize: 12, color: '#52c41a' }}>
                          <TrophyOutlined style={{ marginRight: 4 }} />推荐理由：{r.reason}
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 12, color: '#999' }}>
                        点击将在{p}搜索 "{r.title}" 的课程
                      </div>
                    </div>

                    <LinkOutlined style={{ color: '#999', fontSize: 16, marginTop: 8 }} />
                  </div>
                </Card>
              </a>
            )
          })}

          <Card style={{ marginTop: 16, background: '#f0f5ff' }} size="small">
            <Text type="secondary">
              以上资源已按推荐学习顺序排列。建议从第1步开始，逐步深入。点击卡片将在新标签页打开对应平台。
            </Text>
          </Card>
        </>
      )}
    </div>
  )
}

export default ResourceSearchPage
