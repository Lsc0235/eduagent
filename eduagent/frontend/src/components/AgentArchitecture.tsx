import React, { useState, useEffect } from 'react'
import { Card, Typography, Tag, Space, Steps, Tooltip, Collapse, Row, Col, Badge, Timeline, Spin } from 'antd'
import {
  RobotOutlined,
  BookOutlined,
  BulbOutlined,
  CodeOutlined,
  EditOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

interface AgentStep {
  agent: string
  name: string
  task: string
  output: string
  status: 'done' | 'working' | 'pending'
  resource_type?: string
}

interface AgentArchitectureProps {
  agentTrace?: AgentStep[]
  showRealtime?: boolean
}

const agentIcons: Record<string, React.ReactNode> = {
  planner: <BranchesOutlined />,
  profiler: <RobotOutlined />,
  doc_generator: <FileTextOutlined />,
  mindmap_generator: <BranchesOutlined />,
  code_generator: <CodeOutlined />,
  quiz_generator: <EditOutlined />,
  video_recommender: <PlayCircleOutlined />,
  book_recommender: <BookOutlined />,
  evaluator: <BulbOutlined />,
  path_planner: <ThunderboltOutlined />,
  reinforcement_generator: <BulbOutlined />,
  quality_reviewer: <CheckCircleOutlined />,
}

const agentColors: Record<string, string> = {
  planner: '#667eea',
  profiler: '#764ba2',
  doc_generator: '#10b981',
  mindmap_generator: '#f59e0b',
  code_generator: '#ef4444',
  quiz_generator: '#8b5cf6',
  video_recommender: '#ec4899',
  book_recommender: '#3b82f6',
  evaluator: '#f97316',
  path_planner: '#14b8a6',
  reinforcement_generator: '#a855f7',
  quality_reviewer: '#64748b',
}

const AgentArchitecture: React.FC<AgentArchitectureProps> = ({ agentTrace = [], showRealtime = false }) => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [realtimeTrace, setRealtimeTrace] = useState<AgentStep[]>(agentTrace)

  useEffect(() => {
    setRealtimeTrace(agentTrace)
  }, [agentTrace])

  const allAgents = [
    { id: 'planner', name: '任务规划智能体', icon: <BranchesOutlined />, color: '#667eea', desc: '分析需求，规划路径' },
    { id: 'profiler', name: '画像分析智能体', icon: <RobotOutlined />, color: '#764ba2', desc: '构建学生画像' },
    { id: 'doc_generator', name: '文档生成智能体', icon: <FileTextOutlined />, color: '#10b981', desc: '生成学习文档' },
    { id: 'mindmap_generator', name: '导图生成智能体', icon: <BranchesOutlined />, color: '#f59e0b', desc: '生成思维导图' },
    { id: 'code_generator', name: '代码生成智能体', icon: <CodeOutlined />, color: '#ef4444', desc: '生成代码示例' },
    { id: 'quiz_generator', name: '题目生成智能体', icon: <EditOutlined />, color: '#8b5cf6', desc: '生成测试题目' },
    { id: 'video_recommender', name: '视频推荐智能体', icon: <PlayCircleOutlined />, color: '#ec4899', desc: '推荐学习视频' },
  ]

  // 获取智能体状态
  const getAgentStatus = (agentId: string) => {
    const step = realtimeTrace.find(t => t.agent === agentId)
    return step?.status || 'pending'
  }

  return (
    <Card
      title={
        <Space>
          <RobotOutlined style={{ color: '#667eea' }} />
          <span>多智能体协作架构</span>
          {showRealtime && realtimeTrace.length > 0 && (
            <Tag color="processing">实时运行中</Tag>
          )}
        </Space>
      }
      variant="borderless"
      style={{ borderRadius: 16, marginBottom: 24 }}
    >
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        系统采用多智能体协作架构，7个专业智能体分工协作，共同完成个性化学习资源的生成与推送
      </Paragraph>

      {/* 智能体网格 - 显示实时状态 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {allAgents.map(agent => {
          const status = getAgentStatus(agent.id)
          return (
            <Col xs={12} sm={8} md={6} key={agent.id}>
              <Card
                size="small"
                hoverable
                onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                style={{
                  borderTop: `3px solid ${agent.color}`,
                  cursor: 'pointer',
                  background: status === 'working' ? `${agent.color}10` : '#fff',
                  opacity: status === 'pending' && realtimeTrace.length > 0 ? 0.6 : 1,
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `${agent.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                    fontSize: 24,
                    color: agent.color,
                  }}>
                    {status === 'working' ? <LoadingOutlined spin /> : agent.icon}
                  </div>
                  <Text strong style={{ fontSize: 13 }}>{agent.name}</Text>
                  <div style={{ marginTop: 4 }}>
                    {status === 'done' && <Badge status="success" text="已完成" />}
                    {status === 'working' && <Badge status="processing" text="工作中" />}
                    {status === 'pending' && realtimeTrace.length > 0 && <Badge status="default" text="等待中" />}
                    {status === 'pending' && realtimeTrace.length === 0 && <Badge status="default" text="就绪" />}
                  </div>
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>

      {/* 实时工作日志 */}
      {showRealtime && realtimeTrace.length > 0 && (
        <Card
          size="small"
          title={
            <Space>
              <LoadingOutlined style={{ color: '#667eea' }} />
              <span>智能体工作日志</span>
            </Space>
          }
          style={{ marginBottom: 24, background: '#f8fafc' }}
        >
          <Timeline
            items={realtimeTrace.map((step, index) => ({
              color: step.status === 'done' ? 'green' : step.status === 'working' ? 'blue' : 'gray',
              children: (
                <div>
                  <Space>
                    <Tag color={agentColors[step.agent] || 'default'}>
                      {agentIcons[step.agent] || <RobotOutlined />}
                      {step.name}
                    </Tag>
                    <Text type="secondary">{step.task}</Text>
                  </Space>
                  {step.output && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{step.output}</Text>
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        </Card>
      )}

      {/* 协作流程 */}
      <Card
        size="small"
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#f59e0b' }} />
            <span>协作流程</span>
          </Space>
        }
        style={{ background: '#fafafa' }}
      >
        <Steps
          direction="vertical"
          size="small"
          current={realtimeTrace.length > 0 ? realtimeTrace.length : 6}
          items={[
            { title: '用户输入', description: '学生描述学习需求和目标' },
            { title: '画像分析', description: 'ProfilerAgent 提取学生特征' },
            { title: '任务规划', description: 'PlannerAgent 规划学习路径' },
            { title: '资源生成', description: '多个智能体协作生成资源' },
            { title: '学习执行', description: '学生按照路径学习' },
            { title: '效果评估', description: '测试评估，动态调整' },
          ]}
        />
      </Card>
    </Card>
  )
}

export default AgentArchitecture
