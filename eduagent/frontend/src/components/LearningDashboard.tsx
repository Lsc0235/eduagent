import React, { useMemo } from 'react'
import { Card, Row, Col, Typography, Tag, Progress, Statistic, Space, List, Tooltip, Empty } from 'antd'
import {
  BookOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

const { Title, Text, Paragraph } = Typography

interface LearningRecord {
  timestamp: number
  topic: string
  score?: number
  step: string
  duration?: number
}

interface KnowledgePoint {
  name: string
  mastery: number  // 0-100
  lastPracticed?: number
}

interface LearningDashboardProps {
  records: LearningRecord[]
  knowledgePoints: KnowledgePoint[]
  totalTopics: number
  completedTopics: number
  averageScore: number
  studyTimeMinutes: number
}

const COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444']

const LearningDashboard: React.FC<LearningDashboardProps> = ({
  records,
  knowledgePoints,
  totalTopics,
  completedTopics,
  averageScore,
  studyTimeMinutes,
}) => {
  // 计算统计数据
  const stats = useMemo(() => {
    const recentRecords = records.slice(-10) // 最近10次记录

    // 成绩趋势数据
    const scoreTrend = recentRecords
      .filter(r => r.score !== undefined)
      .map((r, index) => ({
        name: `第${index + 1}次`,
        score: r.score,
        topic: r.topic,
      }))

    // 知识点掌握分布
    const masteryDistribution = {
      excellent: knowledgePoints.filter(k => k.mastery >= 80).length,
      good: knowledgePoints.filter(k => k.mastery >= 60 && k.mastery < 80).length,
      fair: knowledgePoints.filter(k => k.mastery >= 40 && k.mastery < 60).length,
      poor: knowledgePoints.filter(k => k.mastery < 40).length,
    }

    const pieData = [
      { name: '优秀(≥80)', value: masteryDistribution.excellent, color: '#10b981' },
      { name: '良好(60-79)', value: masteryDistribution.good, color: '#667eea' },
      { name: '一般(40-59)', value: masteryDistribution.fair, color: '#f59e0b' },
      { name: '薄弱(<40)', value: masteryDistribution.poor, color: '#ef4444' },
    ].filter(d => d.value > 0)

    // 学习步骤完成情况
    const stepStats = {
      book_select: records.filter(r => r.step === 'book_select').length,
      video: records.filter(r => r.step === 'video').length,
      code: records.filter(r => r.step === 'code').length,
      quiz: records.filter(r => r.step === 'quiz').length,
    }

    // 薄弱知识点（掌握率最低的5个）
    const weakPoints = [...knowledgePoints]
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 5)

    // 最近学习的主题
    const recentTopics = [...new Set(records.slice(-5).map(r => r.topic))]

    return {
      scoreTrend,
      pieData,
      masteryDistribution,
      stepStats,
      weakPoints,
      recentTopics,
    }
  }, [records, knowledgePoints])

  const completionRate = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0

  return (
    <div>
      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' }}>
            <Statistic
              title="学习主题"
              value={completedTopics}
              suffix={`/ ${totalTopics}`}
              prefix={<BookOutlined style={{ color: '#667eea' }} />}
            />
            <Progress percent={completionRate} size="small" strokeColor="#667eea" showInfo={false} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #10b98115 0%, #05966915 100%)' }}>
            <Statistic
              title="平均成绩"
              value={averageScore}
              suffix="分"
              prefix={<TrophyOutlined style={{ color: '#10b981' }} />}
              valueStyle={{ color: averageScore >= 80 ? '#10b981' : averageScore >= 60 ? '#f59e0b' : '#ef4444' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b15 0%, #d9770615 100%)' }}>
            <Statistic
              title="学习时长"
              value={studyTimeMinutes}
              suffix="分钟"
              prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ borderRadius: 12, background: 'linear-gradient(135deg, #ef444415 0%, #dc262615 100%)' }}>
            <Statistic
              title="薄弱知识点"
              value={stats.masteryDistribution.poor}
              suffix="个"
              prefix={<BulbOutlined style={{ color: '#ef4444' }} />}
              valueStyle={{ color: stats.masteryDistribution.poor > 0 ? '#ef4444' : '#10b981' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 成绩趋势图 */}
        <Col xs={24} lg={12}>
          <Card title="📈 成绩趋势" variant="borderless" style={{ borderRadius: 12 }}>
            {stats.scoreTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.scoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    formatter={(value: number) => [`${value}分`, '成绩']}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload
                      return item?.topic || label
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#667eea"
                    strokeWidth={3}
                    dot={{ fill: '#667eea', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无成绩数据" style={{ padding: '40px 0' }} />
            )}
          </Card>
        </Col>

        {/* 知识点掌握分布 */}
        <Col xs={24} lg={12}>
          <Card title="🎯 掌握程度分布" variant="borderless" style={{ borderRadius: 12 }}>
            {stats.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}个`}
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无知识点数据" style={{ padding: '40px 0' }} />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 薄弱知识点列表 */}
        <Col xs={24} lg={12}>
          <Card
            title="⚠️ 薄弱知识点"
            variant="borderless"
            style={{ borderRadius: 12 }}
            extra={<Text type="secondary">掌握率低于60%的知识点</Text>}
          >
            {stats.weakPoints.length > 0 ? (
              <List
                dataSource={stats.weakPoints}
                renderItem={(item) => (
                  <List.Item
                    extra={
                      <Tooltip title={`掌握率 ${item.mastery}%`}>
                        <Progress
                          type="circle"
                          percent={item.mastery}
                          size={40}
                          strokeColor={item.mastery < 40 ? '#ef4444' : '#f59e0b'}
                        />
                      </Tooltip>
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: item.mastery < 40 ? '#fff2f0' : '#fffbe6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <FallOutlined style={{ color: item.mastery < 40 ? '#ef4444' : '#f59e0b' }} />
                        </div>
                      }
                      title={<Text strong>{item.name}</Text>}
                      description={`掌握率: ${item.mastery}%`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无薄弱知识点" style={{ padding: '40px 0' }} />
            )}
          </Card>
        </Col>

        {/* 学习步骤统计 & 最近学习 */}
        <Col xs={24} lg={12}>
          <Card title="📊 学习步骤统计" variant="borderless" style={{ borderRadius: 12, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { name: '选书', count: stats.stepStats.book_select, color: '#667eea' },
                { name: '看视频', count: stats.stepStats.video, color: '#764ba2' },
                { name: '敲代码', count: stats.stepStats.code, color: '#10b981' },
                { name: '做测试', count: stats.stepStats.quiz, color: '#f59e0b' },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Bar dataKey="count" name="次数" radius={[4, 4, 0, 0]}>
                  {[0, 1, 2, 3].map((index) => (
                    <Cell key={`cell-${index}`} fill={['#667eea', '#764ba2', '#10b981', '#f59e0b'][index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="🕐 最近学习" variant="borderless" style={{ borderRadius: 12 }}>
            {stats.recentTopics.length > 0 ? (
              <Space wrap>
                {stats.recentTopics.map((topic, index) => (
                  <Tag key={index} color="blue" style={{ padding: '4px 12px' }}>
                    {topic}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无学习记录</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 优秀知识点 */}
      {stats.masteryDistribution.excellent > 0 && (
        <Card
          title="🏆 已掌握的知识点"
          variant="borderless"
          style={{ borderRadius: 12, marginTop: 16 }}
        >
          <Space wrap>
            {knowledgePoints
              .filter(k => k.mastery >= 80)
              .map((k, index) => (
                <Tag key={index} color="success" icon={<CheckCircleOutlined />} style={{ padding: '6px 12px' }}>
                  {k.name} ({k.mastery}%)
                </Tag>
              ))}
          </Space>
        </Card>
      )}
    </div>
  )
}

export default LearningDashboard
