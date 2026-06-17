import React, { useState } from 'react'
import { Alert, Button, Card, Radio, Space, Tag, Typography, message } from 'antd'
import type { ExerciseEvaluationResult, PersonalizedExercise } from '../../types/personalization'

const { Text, Paragraph } = Typography

interface Props {
  exercises: PersonalizedExercise[]
  result?: ExerciseEvaluationResult | null
  onSubmit: (answers: Record<string, string>) => void
}

const PersonalizedExerciseBlock: React.FC<Props> = ({ exercises, result, onSubmit }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const submit = () => {
    const missing = exercises.filter(exercise => !answers[exercise.id])
    if (missing.length > 0) {
      message.warning(`还有 ${missing.length} 道题未作答`)
      return
    }
    onSubmit(answers)
  }

  return (
    <Card title="画像适配练习题" style={{ marginTop: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {exercises.map((exercise, index) => (
          <Card size="small" key={exercise.id}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="blue">第 {index + 1} 题</Tag>
                <Tag>{exercise.type}</Tag>
                <Tag color="orange">{exercise.difficulty}</Tag>
                <Text type="secondary">{exercise.knowledgePoint}</Text>
              </Space>
              <Paragraph strong style={{ margin: 0 }}>{exercise.question}</Paragraph>
              {exercise.options && (
                <Radio.Group
                  value={answers[exercise.id]}
                  onChange={event => setAnswers(prev => ({ ...prev, [exercise.id]: event.target.value }))}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {exercise.options.map(option => (
                      <Radio key={option} value={option}>{option}</Radio>
                    ))}
                  </Space>
                </Radio.Group>
              )}
              {result && (
                <Alert
                  type={answers[exercise.id] === exercise.answer ? 'success' : 'warning'}
                  message={`正确答案：${exercise.answer}`}
                  description={exercise.analysis}
                  showIcon
                />
              )}
            </Space>
          </Card>
        ))}

        {!result ? (
          <Button type="primary" onClick={submit}>提交练习并生成报告</Button>
        ) : (
          <Alert
            type={result.score >= 80 ? 'success' : 'warning'}
            showIcon
            message={`本次得分：${result.score} 分，答对 ${result.correctCount} / ${exercises.length} 题`}
            description={result.wrongCount > 0 ? `错题已进入错题本：${result.weakKnowledgePoints.join('、')}` : '本轮没有错题，建议进入下一主题或项目任务。'}
          />
        )}
      </Space>
    </Card>
  )
}

export default PersonalizedExerciseBlock
