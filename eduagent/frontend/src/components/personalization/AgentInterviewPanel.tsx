import React from 'react'
import { Button, Card, Col, Input, Row, Space, Tag, Typography } from 'antd'
import type { InterviewAnswers } from '../../types/personalization'

const { Text, Paragraph } = Typography
const { TextArea } = Input

interface Props {
  answers: InterviewAnswers
  followUps: string[]
  loading?: boolean
  onChange: (key: keyof InterviewAnswers, value: string) => void
  onSubmit: () => void
}

const questionCards: Array<{
  key: keyof InterviewAnswers
  title: string
  placeholder: string
  options: string[]
}> = [
  {
    key: 'recentTopic',
    title: '1. 你最近最想学习什么知识点？为什么想学它？',
    placeholder: '如：CNN 卷积，想把图像分类项目真正做出来',
    options: ['神经网络', 'CNN 卷积', '线性回归', '推荐系统'],
  },
  {
    key: 'goal',
    title: '2. 你学习这个知识点的目标是什么？',
    placeholder: '如：为了课程项目 / 面试 / 考试 / 论文',
    options: ['课程考试', '项目实践', '论文研究', '就业面试', '兴趣拓展'],
  },
  {
    key: 'currentLevel',
    title: '3. 你现在对这个知识点了解多少？',
    placeholder: '如：知道名词，但流程和代码不稳',
    options: ['零基础', '刚入门', '知道一点', '能做基础题', '做过小项目'],
  },
  {
    key: 'desiredOutcome',
    title: '4. 你是否需要做出一个可展示的成果？',
    placeholder: '如：需要项目、PPT、报告或可运行代码',
    options: ['可运行代码', '课程汇报/PPT', '项目作品', '先学懂再说'],
  },
  {
    key: 'foundation',
    title: '5. 你现在会哪些相关基础？',
    placeholder: '如：Python、线性代数、机器学习基础',
    options: ['Python 基础', '线性代数', '概率统计', '机器学习基础'],
  },
  {
    key: 'stuckPoints',
    title: '6. 你平时更容易在哪类内容上卡住？',
    placeholder: '如：概念、公式、代码、案例、题目或学习顺序',
    options: ['概念', '公式', '代码', '案例', '题目', '学习顺序'],
  },
  {
    key: 'supportPreference',
    title: '7. 你希望系统如何帮助你？',
    placeholder: '如：讲解、规划、出题、代码、案例、监督进度',
    options: ['讲解', '学习规划', '针对性出题', '代码示例', '案例拆解', '监督进度'],
  },
]

const AgentInterviewPanel: React.FC<Props> = ({ answers, followUps, loading, onChange, onSubmit }) => (
  <Card title="目标访谈区" style={{ marginBottom: 16 }}>
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Input
            placeholder="专业，如：计算机科学与技术"
            value={answers.major}
            onChange={event => onChange('major', event.target.value)}
          />
        </Col>
        <Col xs={24} md={12}>
          <Input
            placeholder="年级，如：大二"
            value={answers.grade}
            onChange={event => onChange('grade', event.target.value)}
          />
        </Col>
        <Col xs={24} md={12}>
          <Input
            placeholder="可投入时间，如：每晚 60 分钟"
            value={answers.availableTime}
            onChange={event => onChange('availableTime', event.target.value)}
          />
        </Col>
      </Row>

      {questionCards.map(item => (
        <Card key={item.key} size="small">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Text strong>{item.title}</Text>
            <Space wrap>
              {item.options.map(option => (
                <Tag
                  key={option}
                  color={String(answers[item.key] || '').includes(option) ? 'blue' : 'default'}
                  style={{ cursor: 'pointer', padding: '4px 10px' }}
                  onClick={() => onChange(item.key, option)}
                >
                  {option}
                </Tag>
              ))}
            </Space>
            <TextArea
              rows={2}
              placeholder={item.placeholder}
              value={answers[item.key]}
              onChange={event => onChange(item.key, event.target.value)}
            />
          </Space>
        </Card>
      ))}

      {followUps.length > 0 && (
        <Card size="small" title="动态追问">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {followUps.map(item => <Paragraph key={item} style={{ margin: 0 }}>{item}</Paragraph>)}
          </Space>
        </Card>
      )}

      <Button type="primary" onClick={onSubmit} loading={loading}>
        生成初始 Agent 并进入知识诊断
      </Button>
    </Space>
  </Card>
)

export default AgentInterviewPanel
