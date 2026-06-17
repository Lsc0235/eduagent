import React from 'react'
import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import { ApartmentOutlined, BranchesOutlined } from '@ant-design/icons'
import TechStack from '../components/TechStack'

const { Text, Paragraph } = Typography

const TechStackPage: React.FC = () => {
  const flow = ['个人学习 Agent', '目标访谈', '知识诊断', '学习模式决策', '资源生成', '练习与错题', '学习评估', 'Agent 记忆更新']
  const tech = [
    '前端组件化页面',
    'LearnerAgentModel + localStorage 持久化',
    'learnerAgentEngine 规则引擎',
    'mock AI 生成内容',
    '后续可替换为真实大模型 API',
    '多智能体扩展：画像分析、路径规划、资源生成、题库、评估',
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Card
        title={<Space><ApartmentOutlined />个人学习 Agent 引擎架构</Space>}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {flow.map((item, index) => (
                <Card size="small" key={item}>
                  <Space wrap>
                    <Tag color={index % 3 === 0 ? 'red' : index % 3 === 1 ? 'blue' : 'gold'}>{String(index + 1).padStart(2, '0')}</Tag>
                    <Text strong>{item}</Text>
                    {index < flow.length - 1 && <BranchesOutlined />}
                  </Space>
                </Card>
              ))}
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Card size="small" title="当前技术实现" style={{ height: '100%' }}>
              <Space direction="vertical" size={10}>
                {tech.map(item => <Tag key={item}>{item}</Tag>)}
                <Paragraph style={{ margin: 0 }}>
                  本系统不是简单 API 调用，而是通过 LearnerAgentModel 维护每个学生的长期学习状态。所有生成内容都读取 Agent 模型，所有学习结果都反向更新 Agent 模型，从而实现真正的一对一个性化学习。
                </Paragraph>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
      <TechStack />
    </div>
  )
}

export default TechStackPage
