import React from 'react'
import { Alert, Button, Card, Col, Progress, Row, Space, Statistic, Tag, Typography } from 'antd'
import { BarChartOutlined } from '@ant-design/icons'
import type { LearningRecord, WrongQuestion } from '../../types/personalization'

const { Text, Paragraph } = Typography

interface Props {
  overview: {
    topicCount: number
    completedPlanCount: number
    averageScore: number
    wrongCount: number
    weakPoints: string[]
    latestRecord: LearningRecord | null
    wrongs: WrongQuestion[]
  }
  recommendedMode: string
  onSyncProfile: () => void
}

const dimensions = [
  ['概念理解', 78],
  ['代码实践', 72],
  ['案例应用', 68],
  ['题目掌握', 74],
  ['学习稳定性', 66],
  ['自主学习能力', 70],
] as const

const LearningEvaluationReport: React.FC<Props> = ({ overview, recommendedMode, onSyncProfile }) => (
  <Space direction="vertical" size={16} style={{ width: '100%', marginBottom: 16 }}>
    <Card title={<Space><BarChartOutlined />总体学习概览</Space>}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={4}><Statistic title="学习知识点" value={overview.topicCount} suffix="个" /></Col>
        <Col xs={12} md={4}><Statistic title="完成计划" value={overview.completedPlanCount} suffix="次" /></Col>
        <Col xs={12} md={4}><Statistic title="平均分" value={overview.averageScore} suffix="分" /></Col>
        <Col xs={12} md={4}><Statistic title="错题数" value={overview.wrongCount} suffix="题" /></Col>
        <Col xs={24} md={8}>
          <Text>当前推荐学习模式：<Tag color="blue">{recommendedMode}</Tag></Text>
          <div style={{ marginTop: 8 }}>
            {overview.weakPoints.map(point => <Tag color="orange" key={point}>{point}</Tag>)}
            {overview.weakPoints.length === 0 && <Text type="secondary">暂无薄弱点</Text>}
          </div>
        </Col>
      </Row>
    </Card>

    <Card title="最近一次学习评估报告">
      {overview.latestRecord ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>学习主题：<strong>{overview.latestRecord.topic}</strong></Text>
          <Text>学习模式：{overview.latestRecord.mode}</Text>
          <Text>得分：<Tag color={overview.latestRecord.score >= 80 ? 'green' : 'orange'}>{overview.latestRecord.score} 分</Tag></Text>
          <Text>掌握较好：{overview.latestRecord.masteredKnowledgePoints.join('、') || '暂无'}</Text>
          <Text>需要加强：{overview.latestRecord.wrongKnowledgePoints.join('、') || '暂无'}</Text>
          <Text>推荐下一知识点：{overview.latestRecord.wrongKnowledgePoints[0] || `${overview.latestRecord.topic} 进阶应用`}</Text>
          <Alert type="info" showIcon message="建议更新 Agent" description="可将本次得分、薄弱点和学习节奏同步回个人学习 Agent。" />
          <Button type="primary" onClick={onSyncProfile}>同步评估结果到个人学习 Agent</Button>
        </Space>
      ) : (
        <Alert type="info" showIcon message="暂无学习记录" description="完成单点速学练习后，这里会自动生成最近一次学习报告。" />
      )}
    </Card>

    <Card title="能力维度进度条">
      {dimensions.map(([name, value]) => {
        const adjusted = Math.max(20, Math.min(98, value + (overview.averageScore ? overview.averageScore - 75 : 0)))
        return (
          <div key={name} style={{ marginBottom: 12 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Text>{name}</Text>
              <Text>{adjusted}%</Text>
            </Space>
            <Progress percent={adjusted} showInfo={false} />
          </div>
        )
      })}
    </Card>

    <Card title="反馈到 Agent">
      <Paragraph style={{ margin: 0 }}>
        系统会根据学习行为、练习成绩和错题情况，更新 Agent 的薄弱点判断、下一步建议和推荐学习模式。
      </Paragraph>
    </Card>
  </Space>
)

export default LearningEvaluationReport
