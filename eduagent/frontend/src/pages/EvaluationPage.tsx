import React, { useState, useEffect } from 'react'
import { Card, Typography, Progress, Row, Col, Empty, Spin, List, Tag, Button, message, Alert, Statistic, Timeline, Space } from 'antd'
import { BarChartOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined, ThunderboltOutlined, UserOutlined, RadarChartOutlined, RobotOutlined } from '@ant-design/icons'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts'
import LearningEvaluationReport from '../components/personalization/LearningEvaluationReport'
import {
  addAgentUpdateLog,
  getLearningOverview,
  readLearnerAgentModel,
  saveLearnerAgentModel,
} from '../services/learningData'
import { buildAgentUpdateLog } from '../utils/learnerAgentEngine'
import { getLearningModeLabel } from '../utils/personalizationEngine'

const { Title, Text, Paragraph } = Typography

const dimensionLabels: Record<string, string> = {
  profile_quality: '画像质量',
  knowledge_mastery: '知识掌握',
  practice_ability: '实践能力',
  adaptive_closure: '自适应闭环',
  consistency: '学习持续性',
}

const resourceTypeLabels: Record<string, string> = {
  document: '课程讲解',
  mindmap: '思维导图',
  quiz: '练习题',
  reading: '拓展阅读',
  code: '代码案例',
  storyboard: '动画分镜',
}

const timelineType: Record<string, { label: string; color: string }> = {
  study: { label: '学习', color: 'blue' },
  quiz: { label: '测评', color: 'orange' },
  reinforce: { label: '补强', color: 'green' },
}

const EvaluationPage: React.FC = () => {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(false)
  const [localOverview, setLocalOverview] = useState(getLearningOverview)

  useEffect(() => { fetchReport() }, [])

  const fetchReport = async () => {
    setLoading(true)
    setError(false)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)
      const res = await fetch('/api/evaluation/report/default', { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setReport(data.report || null)
    } catch {
      setReport(null)
      setError(false)
    }
    setLocalOverview(getLearningOverview())
    setLoading(false)
  }

  const generateReport = async () => {
    setGenerating(true)
    try {
      await fetchReport()
      message.success('评估报告已更新')
    } catch { message.error('生成失败') }
    setGenerating(false)
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 16 }}><Spin size="large" /><Text type="secondary">正在分析学习数据...</Text></div>
  if (error) return <div style={{ padding: 24 }}><Alert type="warning" message="无法连接后端" description="请确认后端服务已启动，然后刷新页面。" showIcon /></div>

  const recommendedMode = getLearningModeLabel(localOverview.agentModel.learningStrategy.recommendedMode)

  const syncEvaluationToAgent = () => {
    if (!localOverview.latestRecord) {
      message.info('暂无学习记录可同步')
      return
    }
    const current = readLearnerAgentModel()
    const nextModel = {
      ...current,
      learningStrategy: {
        ...current.learningStrategy,
        nextBestAction: localOverview.weakPoints[0]
          ? `评估显示你仍需补强「${localOverview.weakPoints[0]}」，建议先做单点速学再继续主线。`
          : `评估显示你已完成当前主题基础闭环，可以进入下一阶段学习。`,
      },
      memory: {
        ...current.memory,
        agentNotes: [
          `评估同步：最近平均分 ${localOverview.averageScore} 分，错题 ${localOverview.wrongCount} 题`,
          ...current.memory.agentNotes,
        ].slice(0, 10),
        updatedAt: new Date().toISOString(),
      },
    }
    saveLearnerAgentModel(nextModel)
    addAgentUpdateLog(buildAgentUpdateLog(
      'evaluation',
      '来自学习评估的更新',
      `已同步评估结果，当前建议：${nextModel.learningStrategy.nextBestAction}`,
      localOverview.latestRecord.topic,
    ))
    setLocalOverview(getLearningOverview())
    message.success('已将本次评估结果同步到个人学习 Agent')
  }

  // 准备雷达图数据
  const radarData = report?.dimensions ? Object.entries(report.dimensions).map(([key, value]: [string, any]) => ({
    dimension: dimensionLabels[key] || key,
    score: value.score || 0,
    fullMark: 100
  })) : []

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3}><BarChartOutlined style={{ marginRight: 8, color: '#4F46E5' }} />学习评估</Title>
          <Text type="secondary">基于你的学习行为和练习数据的综合评估报告</Text>
        </div>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={generateReport} loading={generating}>
          {report ? '重新评估' : '生成评估报告'}
        </Button>
      </div>

      <LearningEvaluationReport
        overview={localOverview}
        recommendedMode={recommendedMode}
        onSyncProfile={syncEvaluationToAgent}
      />

      <Card title="工作台学习进度" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Statistic title="系统学习进度" value={localOverview.systemStudy.progress?.progressPercent || 0} suffix="%" />
            <Text type="secondary">{localOverview.systemStudy.plan?.selectedBook.title || '暂无系统学习计划'}</Text>
          </Col>
          <Col xs={24} md={6}>
            <Statistic title="系统阶段测试" value={localOverview.systemStudy.stageTestCount} suffix="次" />
            <Text type="secondary">已完成阶段 {localOverview.systemStudy.completedStageCount} 个</Text>
          </Col>
          <Col xs={24} md={6}>
            <Statistic title="项目完成数量" value={localOverview.project.completedCount} suffix="个" />
            <Text type="secondary">{localOverview.project.workspace?.projectName || '暂无项目工作台'}</Text>
          </Col>
          <Col xs={24} md={6}>
            <Statistic title="项目平均评分" value={localOverview.project.averageScore || 0} suffix="分" />
            <Text type="secondary">薄弱能力：{localOverview.project.weakAbilities.join('、') || '暂无'}</Text>
          </Col>
        </Row>
      </Card>

      {!report ? (
        <Card>
          <Empty description="暂无后端 AI 评估报告，已优先展示本地学习闭环统计" />
          <Alert type="info" style={{ marginTop: 16 }} message="评估内容" showIcon
            description="评估将从知识掌握、学习效率、实践能力、学习持续性四个维度分析，并给出个性化建议。" />
        </Card>
      ) : (
        <>
          {/* 综合评分卡片 */}
          <Card style={{ marginBottom: 16, textAlign: 'center' }}>
            <Title level={1} style={{ color: '#4F46E5', margin: 0, fontSize: 48 }}>{report.overall_score || '-'}</Title>
            <Text type="secondary">综合学习效果评分</Text>
            <Progress percent={report.overall_score || 0} strokeColor="#4F46E5" showInfo={false} style={{ marginTop: 12, maxWidth: 400, margin: '12px auto 0' }} />
          </Card>

          {/* 🆕 雷达图可视化 */}
          {radarData.length > 0 && (
            <Card 
              title={
                <Space>
                  <RadarChartOutlined style={{ color: '#4F46E5' }} />
                  <span>多维度评估雷达图</span>
                </Space>
              } 
              style={{ marginBottom: 16 }}
            >
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
                  <PolarGrid stroke="#e8e8e8" />
                  <PolarAngleAxis 
                    dataKey="dimension" 
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={{ fill: '#999', fontSize: 10 }}
                  />
                  <Radar 
                    name="学习评分" 
                    dataKey="score" 
                    stroke="#4F46E5" 
                    fill="#4F46E5" 
                    fillOpacity={0.6}
                    strokeWidth={2}
                  />
                  <RechartsTooltip 
                    formatter={(value: number) => [`${value}分`, '评分']}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #d9d9d9' }}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Text type="secondary">
                  雷达图越饱满，说明该维度表现越好；凹陷部分为需要加强的方面
                </Text>
              </div>
            </Card>
          )}

          {/* 统计数据卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={4}>
              <Card>
                <Statistic title="画像维度" value={report.evidence?.profile_dimensions || 0} suffix="/7" prefix={<UserOutlined />} />
                <Text type="secondary">个性化推荐依据</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Card>
                <Statistic title="资源证据" value={report.evidence?.resource_count || 0} suffix="份" prefix={<FileTextOutlined />} />
                <Space wrap size={4} style={{ marginTop: 6 }}>
                  {(report.evidence?.resource_types || []).map((type: string) => (
                    <Tag key={type}>{resourceTypeLabels[type] || type}</Tag>
                  ))}
                </Space>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Card>
                <Statistic
                  title="资源质检"
                  value={report.evidence?.avg_resource_quality ?? '-'}
                  suffix={report.evidence?.avg_resource_quality ? '分' : ''}
                  prefix={<CheckCircleOutlined />}
                />
                <Text type="secondary">{report.evidence?.quality_resource_count || 0} 份带质检</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Card>
                <Statistic title="Agent轨迹" value={report.evidence?.agent_trace_count || 0} suffix="条" prefix={<RobotOutlined />} />
                <Text type="secondary">调度、生成、质检、评估</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Card>
                <Statistic title="测验表现" value={report.evidence?.avg_quiz_score ?? '-'} suffix={report.evidence?.avg_quiz_score ? '分' : ''} prefix={<CheckCircleOutlined />} />
                <Text type="secondary">最近 {report.evidence?.latest_quiz_score ?? '-'} 分，{report.evidence?.quiz_count || 0} 次测验</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Card>
                <Statistic title="学习时长" value={report.evidence?.learning_minutes || 0} suffix="分钟" prefix={<ClockCircleOutlined />} />
                <Text type="secondary">{report.evidence?.conversation_count || 0} 轮画像对话</Text>
              </Card>
            </Col>
          </Row>

          {/* 各维度详细评分 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {Object.entries(report.dimensions || {}).map(([key, dim]: [string, any]) => (
              <Col xs={24} sm={12} lg={key === 'consistency' ? 24 : 6} key={key}>
                <Card hoverable style={{ height: '100%' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress type="circle" percent={dim.score || 0} size={80}
                      strokeColor={(dim.score || 0) >= 70 ? '#52c41a' : (dim.score || 0) >= 50 ? '#faad14' : '#ff4d4f'} />
                    <div style={{ marginTop: 8, fontWeight: 600 }}>{dimensionLabels[key] || key}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{dim.comment}</Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* 优势、改进建议、学习建议 */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card title="学习优势" style={{ height: '100%' }}>
                {report.strengths?.length > 0 ? (
                  <List dataSource={report.strengths} renderItem={(item: string) => <List.Item><Tag color="green">优势</Tag>{item}</List.Item>} />
                ) : <Text type="secondary">暂无数据</Text>}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="待改进" style={{ height: '100%' }}>
                {report.weaknesses?.length > 0 ? (
                  <List dataSource={report.weaknesses} renderItem={(item: string) => <List.Item><Tag color="orange">改进</Tag>{item}</List.Item>} />
                ) : <Text type="secondary">暂无数据</Text>}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="学习建议" style={{ height: '100%' }}>
                {report.recommendations?.length > 0 ? (
                  <List dataSource={report.recommendations} renderItem={(item: string) => <List.Item><Tag color="blue">建议</Tag>{item}</List.Item>} />
                ) : <Text type="secondary">暂无数据</Text>}
              </Card>
            </Col>
          </Row>

          {/* 时间线和薄弱点 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card title="学习闭环时间线" style={{ height: '100%' }}>
                {report.timeline?.length > 0 ? (
                  <Timeline
                    items={report.timeline.map((item: any) => {
                      const cfg = timelineType[item.type] || { label: item.type, color: 'blue' }
                      return {
                        color: cfg.color,
                        children: (
                          <Space direction="vertical" size={2}>
                            <Space wrap>
                              <Tag color={cfg.color}>{cfg.label}</Tag>
                              <Text strong>{item.topic}</Text>
                              {item.score !== null && item.score !== undefined && <Tag color={item.score >= 80 ? 'green' : 'orange'}>{item.score} 分</Tag>}
                            </Space>
                            <Text type="secondary">{item.duration || 0} 分钟</Text>
                          </Space>
                        ),
                      }
                    })}
                  />
                ) : <Empty description="暂无学习记录" />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="薄弱点定位" style={{ height: '100%' }}>
                {report.evidence?.weak_points?.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert type="warning" showIcon message="系统已从画像和测验记录中定位薄弱点" />
                    <Space wrap>
                      {report.evidence.weak_points.map((point: string, index: number) => (
                        <Tag key={index} color="orange">{point}</Tag>
                      ))}
                    </Space>
                  </Space>
                ) : (
                  <Alert type="success" showIcon message="暂无明确薄弱点" description="继续学习和测验后，系统会动态更新薄弱点。" />
                )}
              </Card>
            </Col>
          </Row>

          {/* 下一步学习重点 */}
          {report.next_focus && (
            <Card style={{ marginTop: 16, background: '#f0f5ff', borderColor: '#4F46E5' }}>
              <Text strong style={{ color: '#4F46E5' }}>下一步学习重点：</Text>
              <Paragraph style={{ margin: '8px 0 0' }}>{report.next_focus}</Paragraph>
            </Card>
          )}
        </>
      )}

      <Card title="Agent 更新摘要" style={{ marginTop: 16 }}>
        <Paragraph style={{ marginBottom: 8 }}>
          当前推荐学习模式：{recommendedMode}
        </Paragraph>
        <Paragraph style={{ marginBottom: 8 }}>
          下一步建议：{localOverview.agentModel.learningStrategy.nextBestAction}
        </Paragraph>
        <Paragraph style={{ marginBottom: 0 }}>
          最近 Agent 更新：{localOverview.agentLogs[0]?.summary || '暂无更新记录'}
        </Paragraph>
      </Card>
    </div>
  )
}

export default EvaluationPage
