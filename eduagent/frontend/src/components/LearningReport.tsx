import React, { useMemo } from 'react'
import { Card, Typography, Tag, Space, Progress, Row, Col, Divider, Alert, Button } from 'antd'
import {
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BulbOutlined,
  BookOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

const { Title, Text, Paragraph } = Typography

interface QuizResult {
  score: number
  correct_count: number
  total: number
  results: Array<{
    question_id: number
    question: string
    is_correct: boolean
    correct_answer: string
    user_answer: string
    knowledge_point?: string
    explanation?: string
  }>
}

interface LearningReportProps {
  topic: string
  quizResult: QuizResult
  bookTitle?: string
  onContinue?: () => void
  onRetry?: () => void
  onNewTopic?: () => void
}

const LearningReport: React.FC<LearningReportProps> = ({
  topic,
  quizResult,
  bookTitle,
  onContinue,
  onRetry,
  onNewTopic,
}) => {
  // 按知识点统计掌握情况
  const knowledgeAnalysis = useMemo(() => {
    const knowledgePoints: Record<string, { total: number; correct: number; questions: any[] }> = {}

    quizResult.results.forEach(result => {
      const kp = result.knowledge_point || '未分类'
      if (!knowledgePoints[kp]) {
        knowledgePoints[kp] = { total: 0, correct: 0, questions: [] }
      }
      knowledgePoints[kp].total++
      if (result.is_correct) {
        knowledgePoints[kp].correct++
      }
      knowledgePoints[kp].questions.push(result)
    })

    return Object.entries(knowledgePoints).map(([name, data]) => ({
      name,
      total: data.total,
      correct: data.correct,
      mastery: Math.round((data.correct / data.total) * 100),
      questions: data.questions,
    }))
  }, [quizResult])

  // 统计数据
  const stats = useMemo(() => {
    const mastered = knowledgeAnalysis.filter(k => k.mastery >= 80).length
    const learning = knowledgeAnalysis.filter(k => k.mastery >= 50 && k.mastery < 80).length
    const weak = knowledgeAnalysis.filter(k => k.mastery < 50).length

    return { mastered, learning, weak, total: knowledgeAnalysis.length }
  }, [knowledgeAnalysis])

  // 饼图数据
  const pieData = [
    { name: '已掌握', value: stats.mastered, color: '#10b981' },
    { name: '学习中', value: stats.learning, color: '#f59e0b' },
    { name: '需加强', value: stats.weak, color: '#ef4444' },
  ].filter(d => d.value > 0)

  // 柱状图数据
  const barData = knowledgeAnalysis.map(k => ({
    name: k.name.length > 8 ? k.name.slice(0, 8) + '...' : k.name,
    掌握率: k.mastery,
    颜色: k.mastery >= 80 ? '#10b981' : k.mastery >= 50 ? '#f59e0b' : '#ef4444',
  }))

  // 错题列表
  const wrongQuestions = quizResult.results.filter(r => !r.is_correct)

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
  }

  const getScoreLevel = (score: number) => {
    if (score >= 90) return '优秀'
    if (score >= 80) return '良好'
    if (score >= 60) return '及格'
    return '需努力'
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 成绩卡片 */}
      <Card
        style={{
          background: `linear-gradient(135deg, ${getScoreColor(quizResult.score)}15 0%, ${getScoreColor(quizResult.score)}05 100%)`,
          border: `2px solid ${getScoreColor(quizResult.score)}`,
          marginBottom: 24,
        }}
        variant="borderless"
      >
        <div style={{ textAlign: 'center' }}>
          <TrophyOutlined style={{ fontSize: 48, color: getScoreColor(quizResult.score), marginBottom: 16 }} />
          <Title level={2} style={{ margin: 0, color: getScoreColor(quizResult.score) }}>
            {quizResult.score}分
          </Title>
          <Tag color={getScoreColor(quizResult.score)} style={{ fontSize: 16, padding: '4px 16px', marginTop: 8 }}>
            {getScoreLevel(quizResult.score)}
          </Tag>
          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            「{topic}」测试完成，答对 {quizResult.correct_count}/{quizResult.total} 题
          </Paragraph>
          {bookTitle && (
            <Text type="secondary">使用教材：{bookTitle}</Text>
          )}
        </div>
      </Card>

      {/* 知识点掌握分析 */}
      <Card title={<Space><BookOutlined />知识点掌握分析</Space>} style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={12}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}个`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Col>
          <Col span={12}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
                <Text>已掌握（≥80%）：{stats.mastered}个</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
                <Text>学习中（50-79%）：{stats.learning}个</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                <Text>需加强（{'<'}50%）：{stats.weak}个</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <Text type="secondary">共涉及 {stats.total} 个知识点</Text>
            </Space>
          </Col>
        </Row>

        {/* 柱状图 */}
        {barData.length > 0 && (
          <>
            <Divider />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`${value}%`, '掌握率']} />
                <Bar dataKey="掌握率" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.颜色} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>

      {/* 知识点详情 */}
      <Card title={<Space><BulbOutlined />知识点详情</Space>} style={{ marginBottom: 24 }}>
        {knowledgeAnalysis.map((kp, index) => (
          <div key={index} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text strong>{kp.name}</Text>
              <Space>
                <Text type="secondary">{kp.correct}/{kp.total}题正确</Text>
                <Tag color={kp.mastery >= 80 ? 'success' : kp.mastery >= 50 ? 'warning' : 'error'}>
                  {kp.mastery}%
                </Tag>
              </Space>
            </div>
            <Progress
              percent={kp.mastery}
              strokeColor={kp.mastery >= 80 ? '#10b981' : kp.mastery >= 50 ? '#f59e0b' : '#ef4444'}
              showInfo={false}
            />
          </div>
        ))}
      </Card>

      {/* 错题分析 */}
      {wrongQuestions.length > 0 && (
        <Card
          title={<Space><CloseCircleOutlined style={{ color: '#ef4444' }} />错题分析</Space>}
          style={{ marginBottom: 24 }}
        >
          {wrongQuestions.map((q, index) => (
            <Alert
              key={index}
              type="error"
              message={q.question}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="danger">你的答案：{q.user_answer}</Text>
                  <Text type="success">正确答案：{q.correct_answer}</Text>
                  {q.knowledge_point && <Text type="secondary">知识点：{q.knowledge_point}</Text>}
                  {q.explanation && <Text type="secondary">解析：{q.explanation}</Text>}
                </Space>
              }
              style={{ marginBottom: 12 }}
              showIcon
            />
          ))}
        </Card>
      )}

      {/* 学习建议 */}
      <Card title={<Space><BulbOutlined />学习建议</Space>} style={{ marginBottom: 24, background: '#f0f5ff' }}>
        <Space direction="vertical" size={12}>
          {stats.weak > 0 && (
            <Paragraph>
              <CloseCircleOutlined style={{ color: '#ef4444', marginRight: 8 }} />
              有 {stats.weak} 个知识点需要重点复习，建议查看错题本进行针对性练习
            </Paragraph>
          )}
          {stats.learning > 0 && (
            <Paragraph>
              <BulbOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
              有 {stats.learning} 个知识点处于学习中状态，建议通过代码实践加深理解
            </Paragraph>
          )}
          {stats.mastered === stats.total && (
            <Paragraph>
              <CheckCircleOutlined style={{ color: '#10b981', marginRight: 8 }} />
              所有知识点都已掌握，可以进入下一主题的学习
            </Paragraph>
          )}
          {quizResult.score >= 80 && (
            <Paragraph>
              <TrophyOutlined style={{ color: '#10b981', marginRight: 8 }} />
              测试成绩优秀！可以继续学习更深入的内容
            </Paragraph>
          )}
        </Space>
      </Card>

      {/* 操作按钮 */}
      <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12 }}>
        {quizResult.score < 80 && onRetry && (
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry} size="large">
            补强后重测
          </Button>
        )}
        {onContinue && quizResult.score >= 80 && (
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={onContinue} size="large">
            继续下一主题
          </Button>
        )}
        {onNewTopic && (
          <Button icon={<BookOutlined />} onClick={onNewTopic} size="large">
            学习新主题
          </Button>
        )}
      </div>
    </div>
  )
}

export default LearningReport
