import React, { useState, useEffect } from 'react'
import { Card, Typography, Tag, Space, Button, Input, Spin, message, Progress, Radio, Alert, Row, Col, Statistic } from 'antd'
import { ExperimentOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined, TrophyOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

interface Question {
  id: number; type: string; question: string; options?: string[]; answer?: string; explanation?: string
}

const QuizPage: React.FC = () => {
  const [state, setState] = useState<'idle' | 'generating' | 'taking' | 'grading' | 'result'>('idle')
  const [topic, setTopic] = useState('')
  const [quizId, setQuizId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [result, setResult] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { loadAnalysis() }, [])

  const loadAnalysis = async () => {
    try {
      const res = await fetch('/api/quiz/analysis/default')
      const data = await res.json()
      if (data.success) setAnalysis(data.analysis)
    } catch { /* ignore */ }
  }

  const generateQuiz = async () => {
    if (!topic.trim()) { message.warning('请输入知识点'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), count: 5, difficulty: 'medium', student_id: 'default' }),
      })
      const data = await res.json()
      if (data.success) {
        setQuizId(data.quiz_id); setQuestions(data.questions || []); setAnswers({}); setState('taking')
      }
    } catch { message.error('生成失败') }
    setGenerating(false)
  }

  const submitQuiz = async () => {
    const unanswered = questions.filter(q => !answers[q.id])
    if (unanswered.length > 0) { message.warning(`还有 ${unanswered.length} 题未作答`); return }
    setState('grading')
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: quizId,
          answers: questions.map(q => ({ question_id: q.id, answer: answers[q.id] || '' })),
          student_id: 'default',
        }),
      })
      const data = await res.json()
      if (data.success) { setResult(data); setState('result'); loadAnalysis() }
    } catch { message.error('提交失败'); setState('taking') }
  }

  const reset = () => { setState('idle'); setQuestions([]); setAnswers({}); setResult(null); setQuizId('') }
  const scoreColor = (s: number) => s >= 80 ? '#52c41a' : s >= 60 ? '#faad14' : '#ff4d4f'
  const gradingLabel = (method?: string) => {
    if (!method) return '规则判分'
    if (method.includes('short_answer')) return '语义判分'
    if (method.includes('choice')) return '选项归一化'
    if (method.includes('fill')) return '关键词判分'
    return '规则判分'
  }

  if (state === 'generating' || state === 'grading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 16 }}>
        <Spin size="large" />
        <Text>{state === 'generating' ? `AI 正在为 "${topic}" 出题...` : 'AI 正在批改你的答案...'}</Text>
      </div>
    )
  }

  if (state === 'result' && result) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Card style={{ marginBottom: 16, textAlign: 'center' }}>
          <TrophyOutlined style={{ fontSize: 48, color: scoreColor(result.score) }} />
          <Title level={2} style={{ color: scoreColor(result.score), margin: '8px 0' }}>{result.score} 分</Title>
          <Progress percent={result.score} strokeColor={scoreColor(result.score)} style={{ maxWidth: 400, margin: '0 auto' }} />
          <Text type="secondary">{result.correct_count}/{result.total} 题正确</Text>
        </Card>
        {result.wrong_topics?.length > 0 && (
          <Alert type="warning" style={{ marginBottom: 16 }} message="薄弱环节" showIcon
            description={`答错的知识点：${result.wrong_topics.join('、')}`} />
        )}
        <Title level={4}>答题详情</Title>
        {result.results?.map((r: any) => (
          <Card key={r.question_id} size="small"
            style={{ marginBottom: 8, borderLeft: r.is_correct ? '3px solid #52c41a' : '3px solid #ff4d4f' }}>
            <div>
              <Space style={{ marginBottom: 4 }}>
                {r.is_correct ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                <Text strong>{r.question}</Text>
                <Tag color={r.is_correct ? 'green' : (r.grade_score >= 60 ? 'gold' : 'red')}>评分 {r.grade_score ?? (r.is_correct ? 100 : 0)}</Tag>
                <Tag color="blue">{gradingLabel(r.grading_method)}</Tag>
                {r.grading_basis && <Tag color="cyan">{r.grading_basis}</Tag>}
                {r.pass_score && <Tag>通过线 {r.pass_score}</Tag>}
              </Space>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">你的答案: </Text>
                <Text style={{ color: r.is_correct ? '#52c41a' : '#ff4d4f' }}>{r.user_answer}</Text>
                {!r.is_correct && <><Text type="secondary"> | 正确答案: </Text><Text style={{ color: '#52c41a' }}>{r.correct_answer}</Text></>}
              </div>
              {(r.grade_feedback || r.explanation) && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>批改: {r.grade_feedback || r.explanation}</Text>}
              {r.matched_points?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {r.matched_points.map((p: string, i: number) => <Tag key={i} color="green">{p}</Tag>)}
                </div>
              )}
              {r.missing_points?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {r.missing_points.map((p: string, i: number) => <Tag key={i} color="orange">{p}</Tag>)}
                </div>
              )}
              {r.explanation && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>解析: {r.explanation}</Text>}
            </div>
          </Card>
        ))}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button type="primary" size="large" onClick={reset}>继续练习</Button>
        </div>
      </div>
    )
  }

  if (state === 'taking') {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4}>{topic} 练习题</Title>
          <Tag color="blue">{Object.keys(answers).length}/{questions.length} 已答</Tag>
        </div>
        <Progress percent={Math.round(Object.keys(answers).length / Math.max(questions.length, 1) * 100)} style={{ marginBottom: 16 }} showInfo={false} />
        {questions.map((q, i) => (
          <Card key={q.id} style={{ marginBottom: 12 }}
            title={<Space><Tag color={q.type === 'choice' ? 'blue' : q.type === 'fill' ? 'green' : 'orange'}>
              {q.type === 'choice' ? '选择题' : q.type === 'fill' ? '填空题' : '简答题'}
            </Tag>{'第 ' + (i + 1) + ' 题'}</Space>}>
            <Paragraph style={{ fontSize: 15 }}>{q.question}</Paragraph>
            {q.type === 'choice' && q.options && (
              <Radio.Group value={answers[q.id]} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}>
                <Space direction="vertical">
                  {q.options.map((opt, j) => <Radio key={j} value={opt}>{opt}</Radio>)}
                </Space>
              </Radio.Group>
            )}
            {q.type === 'fill' && (
              <Input placeholder="请输入答案" value={answers[q.id] || ''}
                onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} style={{ maxWidth: 400 }} />
            )}
            {q.type === 'short_answer' && (
              <Input.TextArea rows={3} placeholder="请输入你的回答" value={answers[q.id] || ''}
                onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} />
            )}
          </Card>
        ))}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button type="primary" size="large" icon={<ThunderboltOutlined />}
            onClick={submitQuiz}>提交批改</Button>
          <Button style={{ marginLeft: 12 }} onClick={reset}>放弃</Button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}><ExperimentOutlined style={{ marginRight: 8, color: '#4F46E5' }} />智能练习</Title>
        <Text type="secondary">AI 根据知识点出题，在线答题，自动批改，分析薄弱环节</Text>
      </div>
      {analysis && analysis.total_quizzes > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24} align="middle">
            <Col span={6}><Statistic title="练习次数" value={analysis.total_quizzes} suffix="次" /></Col>
            <Col span={6}><Statistic title="平均分" value={analysis.avg_score} suffix="分" valueStyle={{ color: scoreColor(analysis.avg_score) }} /></Col>
            <Col span={12}>
              <Text type="secondary">薄弱知识点：</Text>
              <div style={{ marginTop: 4 }}>{analysis.weak_topics?.slice(0, 3).map((t: string, i: number) => <Tag key={i} color="red">{t}</Tag>)}</div>
            </Col>
          </Row>
        </Card>
      )}
      <Card style={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f4fd 100%)' }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Title level={4}>输入知识点，开始练习</Title>
          <Paragraph type="secondary">AI 会根据你输入的知识点生成针对性练习题</Paragraph>
          <div style={{ maxWidth: 500, margin: '16px auto' }}>
            <Input.Search size="large" placeholder="如：神经网络、线性回归、决策树..."
              enterButton={<><ThunderboltOutlined /> 出题</>}
              value={topic} onChange={e => setTopic(e.target.value)}
              onSearch={generateQuiz} loading={generating} />
          </div>
          <Space style={{ marginTop: 12 }}>
            {['神经网络', '线性回归', '决策树', '过拟合'].map(c => (
              <Tag key={c} style={{ cursor: 'pointer', padding: '4px 12px' }}
                onClick={() => { setTopic(c); setTimeout(generateQuiz, 100) }}>{c}</Tag>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  )
}

export default QuizPage
