import React, { useEffect, useState } from 'react'
import { Card, Spin, Alert, Typography, Empty, Button, Tooltip } from 'antd'
import { ExpandOutlined, CompressOutlined } from '@ant-design/icons'

const { Text } = Typography

interface MarkmapMindmapProps {
  markdown: string
  height?: number
  title?: string
}

// 解析markdown
const parseMarkdown = (md: string) => {
  if (!md) return null

  const lines = md.split('\n').filter(l => l.trim())
  const root: any = { text: '学习导图', children: [] }
  let section: any = null

  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('```') || t.startsWith('# ')) continue

    if (t.startsWith('## ')) {
      section = { text: t.replace(/^##\s*/, '').split('：')[0].split(':')[0], children: [] }
      root.children.push(section)
    } else if (t.startsWith('- ') && section) {
      const text = t.replace(/^-\s*/, '').split('：')[0].split(':')[0].slice(0, 12)
      section.children.push({ text, children: [] })
    }
  }

  // 限制子节点数量
  root.children.forEach((s: any) => {
    s.children = s.children.slice(0, 4)
  })

  return root.children.length > 0 ? root : null
}

// 配色
const palette = [
  { main: '#6366f1', light: '#e0e7ff', bg: '#6366f1' },  // 靛蓝
  { main: '#8b5cf6', light: '#ede9fe', bg: '#8b5cf6' },  // 紫色
  { main: '#06b6d4', light: '#cffafe', bg: '#06b6d4' },  // 青色
  { main: '#10b981', light: '#d1fae5', bg: '#10b981' },  // 绿色
  { main: '#f59e0b', light: '#fef3c7', bg: '#f59e0b' },  // 琥珀
  { main: '#ec4899', light: '#fce7f3', bg: '#ec4899' },  // 粉色
]

const MindmapVisualization: React.FC<{ data: any }> = ({ data }) => {
  if (!data || !data.children || data.children.length === 0) {
    return <Empty description="暂无数据" />
  }

  const centerX = 450
  const centerY = 60
  const mainRadius = 36
  const sectionRadius = 28
  const leafRadius = 20
  const sectionGap = 130
  const leafGap = 70

  return (
    <svg width="100%" height="320" viewBox="0 0 900 320">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="rootGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* 中心节点 */}
      <circle cx={centerX} cy={centerY} r={mainRadius + 6} fill="#6366f120" />
      <circle cx={centerX} cy={centerY} r={mainRadius} fill="url(#rootGrad)" filter="url(#glow)" />
      <text x={centerX} y={centerY + 5} textAnchor="middle" fill="white" fontSize={13} fontWeight={700}>
        {data.text}
      </text>

      {/* 分支节点 */}
      {data.children.map((section: any, si: number) => {
        const color = palette[si % palette.length]
        const sectionX = centerX + (si - (data.children.length - 1) / 2) * sectionGap
        const sectionY = centerY + 100

        return (
          <g key={si}>
            {/* 连线到中心 */}
            <path
              d={`M${centerX},${centerY + mainRadius} Q${centerX},${sectionY - 30} ${sectionX},${sectionY - sectionRadius}`}
              stroke={color.main}
              strokeWidth={2.5}
              fill="none"
              opacity={0.5}
            />

            {/* 分支节点 */}
            <circle cx={sectionX} cy={sectionY} r={sectionRadius + 3} fill={`${color.main}15`} />
            <circle cx={sectionX} cy={sectionY} r={sectionRadius} fill="white" stroke={color.main} strokeWidth={2.5} />
            <text x={sectionX} y={sectionY + 4} textAnchor="middle" fill={color.main} fontSize={11} fontWeight={600}>
              {section.text.length > 5 ? section.text.slice(0, 5) : section.text}
            </text>

            {/* 叶子节点 */}
            {section.children.map((leaf: any, li: number) => {
              const leafX = sectionX + (li - (section.children.length - 1) / 2) * leafGap
              const leafY = sectionY + 70

              return (
                <g key={li}>
                  <path
                    d={`M${sectionX},${sectionY + sectionRadius} Q${sectionX},${leafY - 20} ${leafX},${leafY}`}
                    stroke={color.main}
                    strokeWidth={1.5}
                    fill="none"
                    opacity={0.3}
                  />
                  <circle cx={leafX} cy={leafY} r={leafRadius} fill={color.light} stroke={color.main} strokeWidth={1.5} />
                  <text x={leafX} y={leafY + 4} textAnchor="middle" fill="#374151" fontSize={9} fontWeight={500}>
                    {leaf.text}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

const MarkmapMindmap: React.FC<MarkmapMindmapProps> = ({
  markdown,
  height = 350,
  title = '学习思维导图',
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [treeData, setTreeData] = useState<any>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (markdown) {
      setLoading(true)
      try {
        const data = parseMarkdown(markdown)
        setTreeData(data)
      } catch (e: any) {
        setError(e.message)
      }
      setLoading(false)
    }
  }, [markdown])

  return (
    <Card
      title={
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          🧠 {title}
        </span>
      }
      style={{
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
      }}
      extra={
        <Tooltip title={expanded ? '收起' : '展开'}>
          <Button
            type="text"
            size="small"
            onClick={() => setExpanded(!expanded)}
            icon={expanded ? <CompressOutlined /> : <ExpandOutlined />}
          />
        </Tooltip>
      }
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #fafbff 0%, #f5f3ff 100%)',
          borderRadius: 12,
          padding: '12px 0',
          minHeight: expanded ? 500 : height,
          overflow: 'auto',
          transition: 'all 0.3s',
        }}
      >
        {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
        {error && <Alert type="error" message="加载失败" />}
        {!loading && !error && !treeData && <Empty description="暂无数据" />}
        {!loading && !error && treeData && <MindmapVisualization data={treeData} />}
      </div>
    </Card>
  )
}

export default MarkmapMindmap
