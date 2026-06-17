import React from 'react'
import { Alert, Card, Col, Row, Space, Steps, Tag, Typography } from 'antd'
import type { ExerciseEvaluationResult, PersonalizedPlan } from '../../types/personalization'
import PersonalizedExerciseBlock from './PersonalizedExerciseBlock'
import PersonalizedResourceGrid from './PersonalizedResourceGrid'

const { Title, Text, Paragraph } = Typography

interface Props {
  plan: PersonalizedPlan
  result?: ExerciseEvaluationResult | null
  onSubmitExercises: (answers: Record<string, string>) => void
}

const SingleTopicLearningPlan: React.FC<Props> = ({ plan, result, onSubmitExercises }) => (
  <div>
    <Alert type="info" showIcon message="单点速学区域" description={plan.reason} style={{ marginBottom: 16 }} />

    <Card title="个性化学习目标" style={{ marginBottom: 16 }}>
      <Space wrap>
        {plan.learningGoals.map(goal => <Tag color="blue" key={goal}>{goal}</Tag>)}
      </Space>
    </Card>

    <Card title="个性化学习路径" style={{ marginBottom: 16 }}>
      <Steps
        direction="vertical"
        items={plan.learningPath.map(item => ({
          title: `${item.step}. ${item.title}（${item.duration}）`,
          description: `${item.description}｜${item.resourceType}`,
        }))}
      />
    </Card>

    <Card title="三层解释" style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]}>
        {[
          ['小白解释', plan.explanations.beginner, 'red'],
          ['类比解释', plan.explanations.analogy, 'gold'],
          ['专业解释', plan.explanations.professional, 'blue'],
        ].map(([title, text, color]) => (
          <Col xs={24} md={8} key={title}>
            <Card size="small" style={{ height: '100%' }}>
              <Tag color={color}>{title}</Tag>
              <Paragraph style={{ margin: '10px 0 0' }}>{text}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>

    <PersonalizedResourceGrid resources={plan.resources} />
    <PersonalizedExerciseBlock exercises={plan.exercises} result={result} onSubmit={onSubmitExercises} />

    {result && (
      <Card title="画像更新建议" style={{ marginTop: 16 }}>
        <Space direction="vertical">
          <Title level={5} style={{ margin: 0 }}>本轮学习反馈</Title>
          <Text>已掌握：{result.masteredKnowledgePoints.join('、') || '暂无'}</Text>
          <Text>需加强：{result.weakKnowledgePoints.join('、') || '暂无'}</Text>
          <Paragraph style={{ margin: 0 }}>{result.profileUpdateSuggestion.suggestedProfileChange}</Paragraph>
        </Space>
      </Card>
    )}
  </div>
)

export default SingleTopicLearningPlan
