import React, { useState } from 'react'
import { Card, Button, Space, Typography, Tag, Radio, Progress, Alert, message, Empty } from 'antd'
import { CheckCircleOutlined, BulbOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

interface Question {
  id: number
  question: string
  options: string[]
  answer: string
  explanation?: string
}

interface EnhancedQuizProps {
  questions: Question[]
  onFinish: (results: { questionId: number; userAnswer: string; isCorrect: boolean }[]) => void
}

const EnhancedQuiz: React.FC<EnhancedQuizProps> = ({ questions, onFinish }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const [results, setResults] = useState<Record<number, { isCorrect: boolean; feedback: string }>>({})
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({})

  // 空状态检查
  if (!questions || questions.length === 0) {
    return (
      <Card style={{ textAlign: 'center', borderRadius: 12 }}>
        <Empty description="暂无测试题目" />
      </Card>
    )
  }

  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100
  const allSubmitted = questions.every(q => submitted[q.id])
  const correctCount = Object.values(results).filter(r => r.isCorrect).length

  const checkAnswer = (questionId: number, userAnswer: string) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return { isCorrect: false, feedback: '题目不存在' }

    const isCorrect = userAnswer === question.answer
    const feedback = isCorrect ? '✅ 回答正确！' : `❌ 正确答案是：${question.answer}`

    return { isCorrect, feedback }
  }

  const submitAnswer = () => {
    const userAnswer = answers[currentQuestion.id] || ''
    if (!userAnswer.trim()) {
      message.warning('请先选择一个选项')
      return
    }

    const result = checkAnswer(currentQuestion.id, userAnswer)
    setResults(prev => ({ ...prev, [currentQuestion.id]: result }))
    setSubmitted(prev => ({ ...prev, [currentQuestion.id]: true }))
  }

  const handleFinish = () => {
    const finalResults = questions.map(q => ({
      questionId: q.id,
      userAnswer: answers[q.id] || '',
      isCorrect: results[q.id]?.isCorrect || false,
    }))
    onFinish(finalResults)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 进度条 */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text strong>
            📝 第 {currentIndex + 1}/{questions.length} 题
          </Text>
          <Space>
            <Tag color="green">正确: {correctCount}</Tag>
            <Tag color="red">错误: {Object.keys(results).length - correctCount}</Tag>
          </Space>
        </div>
        <Progress percent={progress} strokeColor="#667eea" showInfo={false} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 4 }}>
          {questions.map((_, index) => (
            <div
              key={index}
              onClick={() => setCurrentIndex(index)}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                cursor: 'pointer',
                background: index === currentIndex
                  ? '#667eea'
                  : submitted[questions[index].id]
                    ? results[questions[index].id]?.isCorrect ? '#52c41a' : '#ff4d4f'
                    : '#f0f0f0',
                color: index === currentIndex || submitted[questions[index].id] ? '#fff' : '#666',
                transition: 'all 0.3s',
              }}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </Card>

      {/* 题目卡片 */}
      <Card
        title={
          <Space>
            <Tag color="blue">选择题</Tag>
            <span style={{ fontSize: 15 }}>{currentQuestion.question}</span>
          </Space>
        }
        style={{ borderRadius: 12, marginBottom: 16 }}
      >
        {/* 选项 */}
        <Radio.Group
          value={answers[currentQuestion.id]}
          onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
          disabled={submitted[currentQuestion.id]}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentQuestion.id] === option
              const isCorrectOption = option === currentQuestion.answer
              const isSubmitted = submitted[currentQuestion.id]

              let bgColor = '#fafafa'
              let borderColor = '#d9d9d9'

              if (isSubmitted) {
                if (isCorrectOption) {
                  bgColor = '#f6ffed'
                  borderColor = '#b7eb8f'
                } else if (isSelected && !isCorrectOption) {
                  bgColor = '#fff2f0'
                  borderColor = '#ffa39e'
                }
              } else if (isSelected) {
                bgColor = '#e6f7ff'
                borderColor = '#91d5ff'
              }

              return (
                <Radio
                  key={index}
                  value={option}
                  style={{
                    display: 'block',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    margin: 0,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{option}</span>
                  {isSubmitted && isCorrectOption && (
                    <CheckCircleOutlined style={{ marginLeft: 8, color: '#52c41a' }} />
                  )}
                </Radio>
              )
            })}
          </Space>
        </Radio.Group>

        {/* 操作按钮 */}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            {!submitted[currentQuestion.id] ? (
              <Button type="primary" onClick={submitAnswer}>
                提交答案
              </Button>
            ) : (
              <Button
                onClick={() => setShowExplanation(prev => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }))}
              >
                {showExplanation[currentQuestion.id] ? '隐藏解析' : '查看解析'}
              </Button>
            )}
            {currentIndex < questions.length - 1 && (
              <Button onClick={() => setCurrentIndex(currentIndex + 1)}>
                下一题
              </Button>
            )}
          </Space>
        </div>

        {/* 答题反馈 */}
        {submitted[currentQuestion.id] && results[currentQuestion.id] && (
          <Alert
            type={results[currentQuestion.id].isCorrect ? 'success' : 'warning'}
            message={results[currentQuestion.id].feedback}
            style={{ marginTop: 16 }}
            showIcon
          />
        )}

        {/* 显示解析 */}
        {showExplanation[currentQuestion.id] && currentQuestion.explanation && (
          <Alert
            type="info"
            message="解析"
            description={currentQuestion.explanation}
            style={{ marginTop: 16 }}
            icon={<BulbOutlined />}
          />
        )}
      </Card>

      {/* 题目导航 */}
      <Card size="small" style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              ← 上一题
            </Button>
            <Button
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              下一题 →
            </Button>
          </Space>
          {allSubmitted && (
            <Button type="primary" onClick={handleFinish}>
              完成测验
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

export default EnhancedQuiz
