import React, { useState, useEffect } from 'react'
import { Card, Typography, Tag, Space, Button, Spin, message, Alert, Progress, Row, Col, Collapse, Empty, Popconfirm, Radio, Badge, Statistic, Tooltip } from 'antd'
import { BookOutlined, CheckCircleOutlined, DeleteOutlined, ReloadOutlined, TrophyOutlined, BulbOutlined, ExperimentOutlined, ClockCircleOutlined, StarOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import WeaknessRecoveryPlanPanel from '../components/personalization/WeaknessRecoveryPlan'
import type { WeaknessRecoveryPlan as WeaknessRecoveryPlanType } from '../types/personalization'
import {
  clearLocalWrongQuestions,
  groupWrongQuestions,
  markLocalWrongQuestionMastered,
  readUserProfile,
  readWrongQuestions,
  saveCurrentLearningContext,
  setChatDraftFromWrongQuestion,
  syncAgentFromWrongQuestions,
} from '../services/learningData'
import { generateWeaknessRecoveryPlan } from '../utils/personalizationEngine'

const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse

const normalizeChoiceAnswer = (value?: string) => {
  const text = (value || '').trim().toUpperCase()
  const match = text.match(/^[A-D]/)
  return match ? match[0] : text
}

const WrongBookPage: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [grouped, setGrouped] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [recoveryPlan, setRecoveryPlan] = useState<WeaknessRecoveryPlanType | null>(null)
  
  // 变式练习
  const [practicing, setPracticing] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [practiceAnswer, setPracticeAnswer] = useState('')
  const [variant, setVariant] = useState<any>(null)
  const [variantAnswer, setVariantAnswer] = useState('')
  const [variantResult, setVariantResult] = useState<boolean | null>(null)

  const topKnowledgePoint = grouped[0]?.knowledge_point || '暂无'
  const repeatedErrorType = Object.entries(
    readWrongQuestions().reduce<Record<string, number>>((acc, item) => {
      const key = item.errorType || '概念混淆'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] || '暂无'

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const localQuestions = readWrongQuestions()
    const localGroups = groupWrongQuestions(localQuestions).map(group => ({
      knowledge_point: group.knowledgePoint,
      total: group.total,
      mastered: group.mastered,
      questions: group.questions.map(question => ({
        question_id: question.id,
        question_type: 'choice',
        question: question.question,
        user_answer: question.userAnswer,
        correct_answer: question.correctAnswer,
        explanation: question.analysis,
        knowledge_point: question.knowledgePoint,
        difficulty: question.difficulty,
        source: question.source,
        practice_count: question.reviewed ? 1 : 0,
        is_mastered: Boolean(question.reviewed),
        options: [],
      })),
    }))
    const localMastered = localQuestions.filter(question => question.reviewed).length
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch('/api/wrong-book/list/default?only_unmastered=true'),
        fetch('/api/wrong-book/stats/default'),
      ])
      const listData = await listRes.json()
      const statsData = await statsRes.json()

      if (listData.success) {
        const mergedGroups = [...localGroups, ...(listData.grouped_questions || [])]
        setGrouped(mergedGroups)
        setTotal((listData.total || 0) + localQuestions.length)
        // 默认展开第一个分组
        if (mergedGroups.length > 0) {
          setExpandedKeys([mergedGroups[0].knowledge_point])
        }
      }
      if (statsData.success) {
        const combinedTotal = (statsData.total || 0) + localQuestions.length
        const combinedMastered = (statsData.mastered || 0) + localMastered
        setStats({
          ...statsData,
          total: combinedTotal,
          mastered: combinedMastered,
          unmastered: Math.max(combinedTotal - combinedMastered, 0),
          mastery_rate: combinedTotal ? Math.round((combinedMastered / combinedTotal) * 100) : 0,
        })
      }
    } catch {
      const localTotal = localQuestions.length
      setGrouped(localGroups)
      setTotal(localTotal)
      setStats({
        total: localTotal,
        mastered: localMastered,
        unmastered: Math.max(localTotal - localMastered, 0),
        mastery_rate: localTotal ? Math.round((localMastered / localTotal) * 100) : 0,
        topic_stats: Object.fromEntries(localGroups.map(group => [group.knowledge_point, group.total])),
      })
      if (localTotal === 0) message.error('加载失败')
    }
    setLoading(false)
  }

  // 随机抽题复习
  const startPractice = async () => {
    setPracticing(true)
    setCurrentQuestion(null)
    setPracticeAnswer('')
    try {
      const res = await fetch('/api/wrong-book/practice?student_id=default', { method: 'POST' })
      const data = await res.json()
      if (data.question) {
        setCurrentQuestion(data.question)
      } else {
        message.success(data.message || '没有需要复习的错题了！')
      }
    } catch { message.error('获取题目失败') }
    setPracticing(false)
  }

  // 提交复习结果
  const submitReview = async (isCorrect: boolean) => {
    if (!currentQuestion) return
    try {
      const res = await fetch('/api/wrong-book/review?student_id=default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion.question_id,
          is_correct: isCorrect,
        }),
      })
      const data = await res.json()
      if (data.auto_mastered) {
        message.success(data.message)
      } else if (isCorrect) {
        message.success('答对了！继续加油')
      } else {
        message.warning('答错了，多复习几遍')
      }
      // 刷新数据
      fetchData()
      setCurrentQuestion(null)
    } catch { message.error('提交失败') }
  }

  // 生成变式题目
  const generateVariant = async () => {
    try {
      const res = await fetch('/api/wrong-book/generate_variant?student_id=default', { method: 'POST' })
      const data = await res.json()
      if (data.variant) {
        setVariant(data.variant)
        setVariantAnswer('')
        setVariantResult(null)
      } else {
        message.info(data.message || '暂无可练习的错题')
      }
    } catch { message.error('生成失败') }
  }

  // 提交变式题目答案
  const submitVariant = () => {
    if (!variant) return
    const isCorrect = normalizeChoiceAnswer(variantAnswer) === normalizeChoiceAnswer(variant.answer)
    setVariantResult(isCorrect)
    if (isCorrect) {
      message.success('答对了！知识点已巩固')
    } else {
      message.warning(`答错了，正确答案是 ${variant.answer}`)
    }
  }

  // 标记已掌握
  const markMastered = async (questionIds: string[]) => {
    questionIds.forEach(id => markLocalWrongQuestionMastered(id))
    try {
      await fetch('/api/wrong-book/mark_mastered?student_id=default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_ids: questionIds }),
      })
      message.success('已标记掌握')
      fetchData()
    } catch { message.error('操作失败') }
  }

  // 清空错题本
  const clearAll = async () => {
    clearLocalWrongQuestions()
    try {
      await fetch('/api/wrong-book/clear?student_id=default', { method: 'POST' })
      message.success('错题本已清空')
      fetchData()
    } catch { message.error('清空失败') }
  }

  const generateRecovery = () => {
    const wrongs = readWrongQuestions()
    if (wrongs.length === 0) {
      message.info('暂无本地练习错题，请先在单点速学中提交练习')
      return
    }
    const plan = generateWeaknessRecoveryPlan(wrongs, readUserProfile())
    setRecoveryPlan(plan)
    message.success('已根据错题生成补弱方案')
  }

  const updateMyAgent = () => {
    const wrongs = readWrongQuestions()
    if (wrongs.length === 0) {
      message.info('暂无可同步的错题')
      return
    }
    syncAgentFromWrongQuestions(wrongs)
    message.success('已根据错题更新个人学习 Agent')
  }

  const askAssistant = (question: any) => {
    setChatDraftFromWrongQuestion(question)
    saveCurrentLearningContext({
      topic: question.topic || question.knowledge_point || '错题复盘',
      mode: question.source || 'single_topic',
    })
    navigate('/chat')
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
      <Spin size="large" />
      <Text type="secondary">加载错题本...</Text>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3}>
            <BookOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            智能错题本
          </Title>
          <Text type="secondary">自动收集错题，智能分类，针对性复习</Text>
        </div>
        <Space>
          <Popconfirm title="确定清空所有错题？" onConfirm={clearAll}>
            <Button icon={<DeleteOutlined />} danger>清空</Button>
          </Popconfirm>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="未掌握" value={stats.unmastered} suffix="题" valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="已掌握" value={stats.mastered} suffix="题" valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="掌握率" value={stats.mastery_rate} suffix="%" valueStyle={{ color: '#4F46E5' }} prefix={<TrophyOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="知识点" value={Object.keys(stats.topic_stats || {}).length} suffix="个" valueStyle={{ color: '#fa8c16' }} prefix={<StarOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="高频知识点" value={topKnowledgePoint} valueStyle={{ color: '#4F46E5', fontSize: 16 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="重复错误类型" value={repeatedErrorType} valueStyle={{ color: '#d46b08', fontSize: 16 }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 掌握率进度条 */}
      {stats && stats.total > 0 && (
        <Card size="small" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text strong>总体掌握进度</Text>
            <Progress
              percent={stats.mastery_rate}
              strokeColor={{
                '0%': '#ff4d4f',
                '50%': '#faad14',
                '100%': '#52c41a',
              }}
              style={{ flex: 1 }}
            />
            <Text type="secondary">{stats.mastered}/{stats.total}</Text>
          </div>
        </Card>
      )}

      {/* 快捷操作 */}
      <Card size="small" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Text style={{ color: '#fff', fontSize: 15 }}>
              <BulbOutlined style={{ marginRight: 8 }} />
              随机抽题复习、生成变式题目，或按错题生成补弱方案
            </Text>
          </Col>
          <Col>
            <Space>
              <Button
                onClick={startPractice}
                loading={practicing}
                style={{ background: '#fff', color: '#4F46E5', borderColor: '#fff' }}
                icon={<ExperimentOutlined />}
              >
                随机复习
              </Button>
              <Button
                onClick={generateVariant}
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
              >
                变式练习
              </Button>
              <Button
                onClick={generateRecovery}
                style={{ background: '#f0c020', color: '#121212', borderColor: '#121212' }}
              >
                根据错题生成补弱方案
              </Button>
              <Button onClick={updateMyAgent}>
                根据错题更新我的 Agent
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {recoveryPlan && <WeaknessRecoveryPlanPanel plan={recoveryPlan} />}

      {/* 随机复习题目 */}
      {currentQuestion && (
        <Card
          title={<Space><ExperimentOutlined style={{ color: '#4F46E5' }} />随机复习</Space>}
          style={{ marginBottom: 24, border: '2px solid #4F46E5' }}
        >
          <Alert type="info" message={`知识点：${currentQuestion.knowledge_point || currentQuestion.topic}`} style={{ marginBottom: 12 }} />
          <Paragraph style={{ fontSize: 16 }}>{currentQuestion.question}</Paragraph>
          {currentQuestion.options && currentQuestion.options.length > 0 && (
            <Radio.Group value={practiceAnswer} onChange={e => setPracticeAnswer(e.target.value)} style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {currentQuestion.options.map((opt: string, i: number) => (
                  <Radio key={i} value={opt} style={{ padding: '8px 16px', border: '1px solid #e8e8e8', borderRadius: 8, display: 'flex', width: '100%' }}>
                    {opt}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          )}
          {currentQuestion.explanation && (
            <Alert type="info" message="提示" description={currentQuestion.explanation} style={{ marginTop: 12 }} />
          )}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Space>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => submitReview(true)}>答对了</Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => submitReview(false)}>答错了</Button>
              <Button onClick={() => setCurrentQuestion(null)}>跳过</Button>
            </Space>
          </div>
        </Card>
      )}

      {/* 变式练习 */}
      {variant && (
        <Card
          title={<Space><BulbOutlined style={{ color: '#fa8c16' }} />变式练习</Space>}
          style={{ marginBottom: 24, border: '2px solid #fa8c16' }}
        >
          <Paragraph style={{ fontSize: 16 }}>{variant.question}</Paragraph>
          {variant.options && variant.options.length > 0 && (
            <Radio.Group value={variantAnswer} onChange={e => setVariantAnswer(e.target.value)}>
              <Space direction="vertical">
                {variant.options.map((opt: string, i: number) => (
                  <Radio key={i} value={opt} style={{ padding: '8px 16px', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                    {opt}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          )}
          {variantResult !== null && (
            <Alert
              type={variantResult ? 'success' : 'error'}
              message={variantResult ? '答对了！' : `答错了，正确答案是 ${variant.answer}`}
              description={variant.explanation}
              style={{ marginTop: 12 }}
              showIcon
            />
          )}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Space>
              {variantResult === null && (
                <Button type="primary" onClick={submitVariant}>提交答案</Button>
              )}
              <Button onClick={generateVariant}>下一题</Button>
              <Button onClick={() => setVariant(null)}>关闭</Button>
            </Space>
          </div>
        </Card>
      )}

      {/* 错题列表 */}
      {total === 0 ? (
        <Card>
          <Empty description="错题本为空，继续保持" />
        </Card>
      ) : (
        <Collapse
          activeKey={expandedKeys}
          onChange={(keys) => setExpandedKeys(keys as string[])}
          style={{ background: 'transparent' }}
        >
          {grouped.map((group, gi) => (
            <Panel
              key={group.knowledge_point}
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Badge count={group.total - group.mastered} style={{ backgroundColor: '#ff4d4f' }} />
                  <Text strong>{group.knowledge_point}</Text>
                  <Text type="secondary">({group.total}题)</Text>
                  {group.mastered > 0 && <Tag color="green">已掌握{group.mastered}题</Tag>}
                </div>
              }
              style={{ marginBottom: 12, borderRadius: 8 }}
            >
              {group.questions.map((q: any, qi: number) => (
                <Card
                  key={q.question_id || qi}
                  size="small"
                  style={{ marginBottom: 8, borderLeft: `4px solid ${q.is_mastered ? '#52c41a' : '#ff4d4f'}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Space style={{ marginBottom: 4 }}>
                        <Tag color={q.question_type === 'choice' ? 'blue' : 'orange'}>
                          {q.question_type === 'choice' ? '选择题' : '简答题'}
                        </Tag>
                        <Tag>练习{q.practice_count}次</Tag>
                        {q.is_mastered && <Tag color="green"><CheckCircleOutlined /> 已掌握</Tag>}
                      </Space>
                      <Paragraph style={{ margin: '4px 0 8px', fontSize: 14 }}>{q.question}</Paragraph>
                      {q.options && q.options.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {q.options.map((opt: string, i: number) => {
                            const isCorrect = opt === q.correct_answer || opt.startsWith(q.correct_answer)
                            return (
                              <Tag key={i} color={isCorrect ? 'green' : (opt === q.user_answer ? 'red' : 'default')}
                                style={{ marginBottom: 4 }}>
                                {opt}
                              </Tag>
                            )
                          })}
                        </div>
                      )}
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          正确答案：<Text strong style={{ color: '#52c41a' }}>{q.correct_answer}</Text>
                          &nbsp;&nbsp;|&nbsp;&nbsp;
                          你的答案：<Text strong style={{ color: '#ff4d4f' }}>{q.user_answer || '未作答'}</Text>
                        </Text>
                      </div>
                      {q.explanation && (
                        <div style={{ marginTop: 8, padding: 8, background: '#f6f6f6', borderRadius: 6, fontSize: 12 }}>
                          <Text type="secondary">{q.explanation}</Text>
                        </div>
                      )}
                      <Space wrap style={{ marginTop: 10 }}>
                        <Button size="small" onClick={() => { setCurrentQuestion(q); setPracticeAnswer('') }}>重新练习</Button>
                        <Button size="small" onClick={() => message.info(q.explanation || '暂无解析')}>查看解析</Button>
                        <Button size="small" type="primary" onClick={() => askAssistant(q)}>问对话助手</Button>
                        {q.source && <Tag color="blue">来源：{q.source}</Tag>}
                        {q.difficulty && <Tag color="orange">难度：{q.difficulty}</Tag>}
                      </Space>
                    </div>
                    <div style={{ marginLeft: 12 }}>
                      {!q.is_mastered && (
                        <Tooltip title="标记为已掌握">
                          <Button
                            type="text"
                            icon={<CheckCircleOutlined />}
                            style={{ color: '#52c41a' }}
                            onClick={() => markMastered([q.question_id])}
                          />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </Panel>
          ))}
        </Collapse>
      )}
    </div>
  )
}

export default WrongBookPage
