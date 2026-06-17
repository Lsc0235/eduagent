import React from 'react'
import { Card, Typography, Tag, Space, Divider, Row, Col } from 'antd'
import {
  CodeOutlined,
  ToolOutlined,
  ApiOutlined,
  DatabaseOutlined,
  GlobalOutlined,
} from '@ant-design/icons'

const { Title, Text, Link } = Typography

const TechStack: React.FC = () => {
  const techCategories = [
    {
      title: '前端技术',
      icon: <CodeOutlined />,
      color: '#667eea',
      items: [
        { name: 'React 18', desc: 'UI框架', license: 'MIT', url: 'https://react.dev/' },
        { name: 'Ant Design 5', desc: 'UI组件库', license: 'MIT', url: 'https://ant.design/' },
        { name: 'Monaco Editor', desc: '代码编辑器（VS Code同款）', license: 'MIT', url: 'https://microsoft.github.io/monaco-editor/' },
        { name: 'Recharts', desc: '数据可视化图表', license: 'MIT', url: 'https://recharts.org/' },
        { name: 'Mermaid', desc: '思维导图渲染', license: 'MIT', url: 'https://mermaid.js.org/' },
        { name: 'React Markdown', desc: 'Markdown渲染', license: 'MIT', url: 'https://github.com/remarkjs/react-markdown' },
      ],
    },
    {
      title: '后端技术',
      icon: <ApiOutlined />,
      color: '#10b981',
      items: [
        { name: 'FastAPI', desc: 'Python Web框架', license: 'MIT', url: 'https://fastapi.tiangolo.com/' },
        { name: 'SQLAlchemy', desc: 'ORM数据库框架', license: 'MIT', url: 'https://www.sqlalchemy.org/' },
        { name: 'Pydantic', desc: '数据验证', license: 'MIT', url: 'https://docs.pydantic.dev/' },
      ],
    },
    {
      title: 'AI与大模型',
      icon: <GlobalOutlined />,
      color: '#f59e0b',
      items: [
        { name: '科大讯飞星火大模型', desc: '核心AI能力', license: '商用', url: 'https://www.xfyun.cn/' },
        { name: 'Pyodide', desc: '浏览器端Python运行时', license: 'MPL-2.0', url: 'https://pyodide.org/' },
        { name: 'RAG检索增强', desc: '自研混合检索引擎', license: '自研', url: '' },
      ],
    },
    {
      title: '数据与存储',
      icon: <DatabaseOutlined />,
      color: '#ef4444',
      items: [
        { name: 'SQLite', desc: '轻量级数据库', license: 'Public Domain', url: 'https://www.sqlite.org/' },
        { name: 'FAISS', desc: '向量检索（可选）', license: 'MIT', url: 'https://faiss.ai/' },
      ],
    },
  ]

  return (
    <Card
      title={
        <Space>
          <ToolOutlined style={{ color: '#667eea' }} />
          <span>技术栈与开源工具</span>
        </Space>
      }
      variant="borderless"
      style={{ borderRadius: 16 }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        本项目使用以下开源工具和框架开发，特此标注并感谢开源社区的贡献
      </Text>

      <Row gutter={[16, 16]}>
        {techCategories.map((category, index) => (
          <Col xs={24} md={12} key={index}>
            <Card
              size="small"
              title={
                <Space>
                  <span style={{ color: category.color }}>{category.icon}</span>
                  <span>{category.title}</span>
                </Space>
              }
              style={{ height: '100%' }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {category.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      {item.url ? (
                        <Link href={item.url} target="_blank" strong>{item.name}</Link>
                      ) : (
                        <Text strong>{item.name}</Text>
                      )}
                      <Text type="secondary" style={{ fontSize: 12 }}>- {item.desc}</Text>
                    </Space>
                    <Tag color={item.license === '自研' ? 'orange' : 'blue'} style={{ fontSize: 11 }}>
                      {item.license}
                    </Tag>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider />

      <Card size="small" style={{ background: '#f0f5ff' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <strong>声明：</strong>本项目遵循各开源工具的许可证要求。科大讯飞星火大模型的使用符合其服务条款。
          项目源码中的自研部分（如RAG检索引擎、多智能体协作框架）著作权归参赛团队所有。
        </Text>
      </Card>
    </Card>
  )
}

export default TechStack
