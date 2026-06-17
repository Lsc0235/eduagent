import React, { FormEvent, useMemo, useState } from 'react'
import { LoginOutlined, UserAddOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { BauhausLogo } from '../design-system/bauhaus/BauhausPrimitives'
import { login, register } from '../services/auth'
import '../styles/auth-page.css'

type AuthMode = 'login' | 'register'

type RouteState = {
  from?: string
}

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as RouteState | null)?.from || '/learning'

  const pageCopy = useMemo(() => {
    if (mode === 'register') {
      return {
        badge: 'NEW ACCOUNT',
        title: 'CREATE YOUR AI LEARNING LOOP',
        subtitle: '注册后自动进入智学通，画像、对话、错题和评估都在同一套 Bauhaus 学习系统里运行。',
        action: '创建账号',
        switchText: '已有账号？去登录',
      }
    }

    return {
      badge: 'EDUAGENT LOGIN',
      title: 'ENTER YOUR AI LEARNING STUDIO',
      subtitle: '先登录，再进入现在的智学通页面。你和队友互相打包时，本地账号会保存在各自电脑里。',
      action: '登录系统',
      switchText: '没有账号？立即注册',
    }
  }, [mode])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    try {
      if (mode === 'register') {
        register(name, email, password)
        message.success('注册成功，欢迎进入智学通')
      } else {
        login(email, password)
        message.success('登录成功')
      }

      navigate(redirectTo, { replace: true })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(current => (current === 'login' ? 'register' : 'login'))
  }

  return (
    <main className="auth-bauhaus">
      <header className="auth-nav">
        <button className="auth-brand" type="button" onClick={() => setMode('login')}>
          <BauhausLogo />
          <span>
            <strong>智学通</strong>
            <em>EDUAGENT</em>
          </span>
        </button>

        <nav className="auth-nav-links" aria-label="登录页导航">
          <span>PRODUCT</span>
          <span>SOLUTIONS</span>
          <button type="button" className="auth-pill auth-pill-white" onClick={() => setMode('login')}>
            LOG IN
          </button>
          <button type="button" className="auth-pill auth-pill-red" onClick={() => setMode('register')}>
            GET STARTED
          </button>
        </nav>
      </header>

      <section className="auth-shell">
        <div className="auth-copy">
          <span className="auth-badge">{pageCopy.badge}</span>
          <h1>{pageCopy.title}</h1>
          <p>{pageCopy.subtitle}</p>
          <div className="auth-proof">
            <span>50,000+</span>
            <strong>LEARNING PATHS GENERATED</strong>
          </div>
        </div>

        <aside className="auth-art" aria-label="Bauhaus learning artwork">
          <div className="auth-art-grid" />
          <div className="auth-yellow-disc" />
          <div className="auth-red-diamond" />
          <div className="auth-blue-square" />
          <form className="auth-form auth-art-form" onSubmit={handleSubmit}>
            <div className="auth-form-head">
              <span>{mode === 'login' ? '01' : '02'}</span>
              <div>
                <strong>{mode === 'login' ? '账号登录' : '账号注册'}</strong>
                <small>{mode === 'login' ? '输入邮箱和密码进入系统' : '创建本地账号后直接进入系统'}</small>
              </div>
            </div>

            {mode === 'register' && (
              <label className="auth-field">
                <span>昵称</span>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="例如：李同学"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="auth-field">
              <span>邮箱</span>
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-field">
              <span>密码</span>
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="至少 6 位"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>

            <button className="auth-submit" type="submit" disabled={loading}>
              {mode === 'login' ? <LoginOutlined /> : <UserAddOutlined />}
              <span>{loading ? '处理中' : pageCopy.action}</span>
            </button>

            <button className="auth-switch" type="button" onClick={toggleMode}>
              {pageCopy.switchText}
            </button>
          </form>
          <div className="auth-art-caption">
            <span>50,000+</span>
            <strong>学习路径正在生成</strong>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default AuthPage
