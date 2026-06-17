import React, { useState, useMemo } from 'react'
import { Card, Typography, Collapse, Space } from 'antd'
import { DownOutlined, RightOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { Title, Paragraph } = Typography

interface Section {
  title: string
  content: string
  level: number
}

const parseMarkdownSections = (markdown: string): Section[] => {
  if (!markdown) return []

  const lines = markdown.split('\n')
  const sections: Section[] = []
  let currentSection: Section | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        title: headingMatch[2].trim(),
        content: '',
        level: headingMatch[1].length
      }
    } else if (currentSection) {
      currentSection.content += line + '\n'
    } else {
      if (line.trim()) {
        currentSection = {
          title: '概述',
          content: line + '\n',
          level: 1
        }
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
}

const CollapsibleSection: React.FC<{ section: Section; index: number }> = ({ section, index }) => {
  const [expanded, setExpanded] = useState(index < 3)

  return (
    <div
      style={{
        marginBottom: 8,
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        overflow: 'hidden',
        background: expanded ? '#fafafa' : '#fff',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: expanded ? 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' : 'transparent',
          transition: 'background 0.3s',
          borderLeft: `4px solid ${expanded ? '#667eea' : '#d9d9d9'}`,
        }}
      >
        {expanded ? (
          <DownOutlined style={{ fontSize: 12, color: '#667eea' }} />
        ) : (
          <RightOutlined style={{ fontSize: 12, color: '#999' }} />
        )}
        <span
          style={{
            fontWeight: 600,
            fontSize: section.level <= 2 ? 16 : 14,
            color: expanded ? '#1a1a2e' : '#333',
          }}
        >
          {section.title}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: '#999',
          }}
        >
          {expanded ? '收起' : '展开'}
        </span>
      </div>
      {expanded && (
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid #e8e8e8',
            background: '#fff',
          }}
        >
          <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.8 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

interface CollapsibleLearningPlanProps {
  content: string
  title?: string
}

const CollapsibleLearningPlan: React.FC<CollapsibleLearningPlanProps> = ({ content, title = '学习计划' }) => {
  const sections = useMemo(() => parseMarkdownSections(content), [content])

  if (sections.length === 0) {
    return (
      <Card title={title} style={{ borderRadius: 16 }}>
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title={
        <Space>
          <span style={{ fontSize: 18 }}>📋</span>
          <span>{title}</span>
        </Space>
      }
      style={{ borderRadius: 16 }}
      extra={
        <span style={{ fontSize: 12, color: '#999' }}>
          共 {sections.length} 个章节，点击展开查看详情
        </span>
      }
    >
      <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: 4 }}>
        {sections.map((section, index) => (
          <CollapsibleSection key={index} section={section} index={index} />
        ))}
      </div>
    </Card>
  )
}

export default CollapsibleLearningPlan
