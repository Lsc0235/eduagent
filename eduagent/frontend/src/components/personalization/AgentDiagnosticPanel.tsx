import React from 'react'
import { Alert, Button, Card, Radio, Space, Typography } from 'antd'
import type { DiagnosticQuestion } from '../../types/personalization'

const { Paragraph, Text } = Typography

interface Props {
  topic: string
  questions: DiagnosticQuestion[]
  answers: Record<string, string>
  loading?: boolean
  onAnswer: (questionId: string, value: string) => void
  onSubmit: () => void
}

const AgentDiagnosticPanel: React.FC<Props> = ({ topic, questions, answers, loading, onAnswer, onSubmit }) => (
  <Card title="知识诊断区" style={{ marginBottom: 16 }}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={`${topic} 入门诊断测试`}
        description={`共 ${questions.length} 题，用于判断你是否适合直接进入学习任务。`}
      />

      {questions.map((question, index) => (
        <Card key={question.id} size="small">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Text strong>{index + 1}. {question.question}</Text>
            <Radio.Group
              value={answers[question.id]}
              onChange={event => onAnswer(question.id, event.target.value)}
            >
              <Space direction="vertical">
                {question.options.map(option => (
                  <Radio key={option} value={option}>
                    {option}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              诊断点：{question.knowledgePoint}
            </Paragraph>
          </Space>
        </Card>
      ))}

      <Button type="primary" onClick={onSubmit} loading={loading}>
        提交诊断并生成 Agent
      </Button>
    </Space>
  </Card>
)

export default AgentDiagnosticPanel
