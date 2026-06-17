import React from 'react'
import { Layout } from 'antd'
import {
  BookOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MessageOutlined,
  RocketOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BauhausLogo } from '../design-system/bauhaus/BauhausPrimitives'
import { getCurrentUser, logout as clearAuthSession } from '../services/auth'

const { Header, Content } = Layout

const menuItems = [
  { key: '/learning', icon: <RocketOutlined />, label: '开始学习', code: '01', desc: '搜索知识点、查看 Agent 策略并进入学习模式' },
  { key: '/chat', icon: <MessageOutlined />, label: '对话助手', code: '02', desc: '读取当前 Agent 和记忆上下文进行个性化答疑' },
  { key: '/profile', icon: <UserOutlined />, label: '学习画像', code: '03', desc: '个人学习 Agent 中心，负责访谈、诊断与记忆更新' },
  { key: '/wrong-book', icon: <BookOutlined />, label: '错题本', code: '04', desc: '错因沉淀为下一轮补强证据' },
  { key: '/evaluation', icon: <LineChartOutlined />, label: '学习评估', code: '05', desc: '展示学习结果，并把评估同步回 Agent' },
  { key: '/tech-stack', icon: <ToolOutlined />, label: '技术栈', code: '06', desc: '展示个人学习 Agent 引擎架构与实现' },
]

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const current = menuItems.find(item => item.key === location.pathname) || menuItems[0]
  const user = getCurrentUser()

  const handleLogout = () => {
    clearAuthSession()
    navigate('/login', { replace: true })
  }

  return (
    <Layout className="bauhaus-app" data-route={current.key.replace('/', '')}>
      <Header className="bauhaus-app-header">
        <button className="bauhaus-brand" onClick={() => navigate('/learning')}>
          <BauhausLogo />
          <span>
            <strong>智学通</strong>
            <em>EDUAGENT</em>
          </span>
        </button>

        <nav className="bauhaus-main-nav" aria-label="主导航">
          {menuItems.map(item => {
            const active = location.pathname === item.key
            return (
              <button
                key={item.key}
                className={active ? 'bauhaus-nav-item is-active' : 'bauhaus-nav-item'}
                onClick={() => navigate(item.key)}
              >
                <span className="nav-code">{item.code}</span>
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="bauhaus-header-actions">
          <button className="bauhaus-status-chip" onClick={() => navigate('/design-preview')}>
            DESIGN
          </button>
          <div className="bauhaus-user-chip">
            <UserOutlined />
            <span>{user?.name || user?.email || 'USER'}</span>
          </div>
          <button className="bauhaus-logout-chip" onClick={handleLogout}>
            <LogoutOutlined />
            <span>退出</span>
          </button>
        </div>
      </Header>

      <Content className="bauhaus-app-content">
        <section className="bauhaus-route-banner">
          <div className="route-code">{current.code}</div>
          <div className="route-copy">
            <span>BAUHAUS MODULE</span>
            <h1>{current.label}</h1>
            <p>{current.desc}</p>
          </div>
          <div className="route-shapes" aria-hidden="true">
            <span className="route-circle" />
            <span className="route-square" />
            <span className="route-triangle" />
          </div>
        </section>

        <div className="bauhaus-page-surface">
          <Outlet />
        </div>
      </Content>
    </Layout>
  )
}

export default MainLayout
