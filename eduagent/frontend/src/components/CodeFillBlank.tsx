import React, { useState } from 'react'
import { Card, Button, Space, Typography, Input, Tag, Alert, message, Divider } from 'antd'
import { CheckCircleOutlined, EditOutlined, BulbOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

interface CodeBlank {
  id: string
  placeholder: string
  answer: string
  hint?: string
}

interface CodeFillBlankProps {
  title: string
  description: string
  codeTemplate: string
  blanks: CodeBlank[]
  onComplete?: (answers: Record<string, string>, isCorrect: boolean) => void
}

const CodeFillBlank: React.FC<CodeFillBlankProps> = ({
  title,
  description,
  codeTemplate,
  blanks,
  onComplete,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<Record<string, { isCorrect: boolean; userAnswer: string }>>({})

  const handleSubmit = () => {
    // 检查是否所有空都已填写
    const unanswered = blanks.filter(b => !answers[b.id]?.trim())
    if (unanswered.length > 0) {
      message.warning(`还有 ${unanswered.length} 个空未填写`)
      return
    }

    // 检查答案
    const newResults: Record<string, { isCorrect: boolean; userAnswer: string }> = {}
    let allCorrect = true

    blanks.forEach(blank => {
      const userAnswer = (answers[blank.id] || '').trim()
      const isCorrect = userAnswer.toLowerCase() === blank.answer.toLowerCase()
      if (!isCorrect) allCorrect = false
      newResults[blank.id] = { isCorrect, userAnswer }
    })

    setResults(newResults)
    setSubmitted(true)

    if (allCorrect) {
      message.success('🎉 太棒了！全部正确！')
    } else {
      message.warning('部分答案不正确，请查看标注')
    }

    onComplete?.(answers, allCorrect)
  }

  const handleReset = () => {
    setAnswers({})
    setSubmitted(false)
    setResults({})
  }

  // 渲染带有填空的代码
  const renderCodeWithBlanks = () => {
    const parts = codeTemplate.split(/(\{blank:.*?\})/)
    return parts.map((part, index) => {
      const blankMatch = part.match(/\{blank:(.*?)\}/)
      if (blankMatch) {
        const blankId = blankMatch[1]
        const blank = blanks.find(b => b.id === blankId)
        if (!blank) return part

        const result = results[blankId]
        return (
          <span key={index} style={{ display: 'inline-flex', alignItems: 'center', margin: '0 4px' }}>
            <Input
              size="small"
              placeholder={blank.placeholder}
              value={answers[blankId] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [blankId]: e.target.value }))}
              disabled={submitted}
              style={{
                width: Math.max(120, blank.answer.length * 12),
                fontFamily: 'Monaco, Menlo, monospace',
                fontSize: 13,
                borderColor: submitted
                  ? (result?.isCorrect ? '#52c41a' : '#ff4d4f')
                  : '#d9d9d9',
                background: submitted
                  ? (result?.isCorrect ? '#f6ffed' : '#fff2f0')
                  : '#fff',
              }}
              status={submitted && !result?.isCorrect ? 'error' : undefined}
            />
            {submitted && result && (
              result.isCorrect
                ? <CheckCircleOutlined style={{ marginLeft: 4, color: '#52c41a' }} />
                : <span style={{ marginLeft: 4, color: '#ff4d4f', fontSize: 12 }}>
                    正确答案：{blank.answer}
                  </span>
            )}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <Card
      title={
        <Space>
          <EditOutlined style={{ color: '#667eea' }} />
          <span>{title}</span>
        </Space>
      }
      style={{ borderRadius: 12 }}
    >
      <Paragraph type="secondary">{description}</Paragraph>

      <Card
        size="small"
        style={{
          background: '#1e1e1e',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <pre style={{
          color: '#d4d4d4',
          fontFamily: 'Monaco, Menlo, monospace',
          fontSize: 13,
          margin: 0,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
        }}>
          {renderCodeWithBlanks()}
        </pre>
      </Card>

      {/* 提示信息 */}
      {blanks.some(b => b.hint) && (
        <Alert
          type="info"
          icon={<BulbOutlined />}
          message="提示"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {blanks.filter(b => b.hint).map(b => (
                <li key={b.id} style={{ marginBottom: 4 }}>
                  <Text code>{b.placeholder}</Text>: {b.hint}
                </li>
              ))}
            </ul>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 操作按钮 */}
      <div style={{ textAlign: 'right' }}>
        <Space>
          {!submitted ? (
            <Button type="primary" onClick={handleSubmit}>
              提交答案
            </Button>
          ) : (
            <Button onClick={handleReset}>
              重新填写
            </Button>
          )}
        </Space>
      </div>

      {/* 答题统计 */}
      {submitted && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Tag color={Object.values(results).every(r => r.isCorrect) ? 'success' : 'warning'}>
            {Object.values(results).filter(r => r.isCorrect).length}/{blanks.length} 个空正确
          </Tag>
        </div>
      )}
    </Card>
  )
}

export default CodeFillBlank
