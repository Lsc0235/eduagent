import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Input, Button, Typography, Space, Spin, Tag, message, Modal } from 'antd'
import {
  SendOutlined, RobotOutlined, UserOutlined, LoadingOutlined,
  PlusOutlined, MessageOutlined, DeleteOutlined, EditOutlined,
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CurrentLearningContextPanel from '../components/personalization/CurrentLearningContextPanel'
import {
  consumeChatDraft,
  readCurrentLearningContext,
  readLearnerAgentModel,
  readLearningRecords,
  readUserProfile,
  readWrongQuestions,
} from '../services/learningData'
import { generateAgentAwareChatResponse } from '../utils/learnerAgentEngine'

const { TextArea } = Input
const { Text, Title } = Typography

interface ChatMsg { role: 'user' | 'assistant'; content: string; agents?: string[]; resources?: any[] }
interface Session { session_id: string; title: string; created_at: string }

const WELCOME: ChatMsg = {
  role: 'assistant',
  content: `你好！我是**智学通**的 AI 学习助手

我可以帮你：
- 了解你的学习情况，构建个性化学习画像
- 生成课程讲解文档、思维导图、练习题等学习资源
- 规划适合你的学习路径
- 解答学习中遇到的问题

请问你想学什么？可以告诉我你的专业、课程和学习目标。`,
}

const ChatPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<string>('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeAgents, setActiveAgents] = useState<string[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [renameModal, setRenameModal] = useState<{ open: boolean; sessionId: string; title: string }>({ open: false, sessionId: '', title: '' })
  const [learningContext, setLearningContext] = useState(readCurrentLearningContext)
  const [agentModel, setAgentModel] = useState(readLearnerAgentModel)
  const [localProfile, setLocalProfile] = useState(readUserProfile)
  const [localWrongs, setLocalWrongs] = useState(readWrongQuestions)
  const [localRecords, setLocalRecords] = useState(readLearningRecords)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { scrollToBottom() }, [messages, streamingContent, scrollToBottom])
  useEffect(() => {
    const draft = consumeChatDraft()
    if (draft) setInputValue(draft)
    const refreshLearningData = () => {
      setLearningContext(readCurrentLearningContext())
      setAgentModel(readLearnerAgentModel())
      setLocalProfile(readUserProfile())
      setLocalWrongs(readWrongQuestions())
      setLocalRecords(readLearningRecords())
    }
    refreshLearningData()
    window.addEventListener('focus', refreshLearningData)
    return () => window.removeEventListener('focus', refreshLearningData)
  }, [])

  const loadSessions = async () => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch('/api/chat/sessions/default', { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSessions(data)
      if (data.length > 0) {
        setCurrentSession(data[0].session_id)
        await loadMessages(data[0].session_id)
      } else {
        setMessages([WELCOME])
      }
    } catch { setMessages([WELCOME]) }
    setLoadingHistory(false)
  }

  const loadMessages = async (sid: string) => {
    try {
      const res = await fetch(`/api/chat/messages/${sid}`)
      const data = await res.json()
      setMessages(data.length > 0
        ? data.map((m: any) => ({ role: m.role, content: m.content, agents: m.extra_data?.agents, resources: m.extra_data?.resources }))
        : [WELCOME])
    } catch { setMessages([WELCOME]) }
  }

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: 'default', title: '新对话' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const sid = data.session_id || String(Date.now()).slice(-8)
      setSessions(prev => [{ session_id: sid, title: '新对话', created_at: new Date().toISOString() }, ...prev])
      setCurrentSession(sid)
      setMessages([WELCOME])
    } catch {
      setMessages([WELCOME])
    }
  }

  const renameSession = async () => {
    if (!renameModal.title.trim()) return
    try {
      await fetch(`/api/chat/sessions/${renameModal.sessionId}/rename`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameModal.title }),
      })
      setSessions(prev => prev.map(s => s.session_id === renameModal.sessionId ? { ...s, title: renameModal.title } : s))
      setRenameModal({ open: false, sessionId: '', title: '' })
    } catch { message.error('重命名失败') }
  }

  const deleteSession = async (sid: string) => {
    Modal.confirm({
      title: '确认删除此对话？', okText: '删除', cancelText: '取消',
      onOk: async () => {
        try {
          await fetch(`/api/chat/sessions/${sid}`, { method: 'DELETE' })
          setSessions(prev => prev.filter(s => s.session_id !== sid))
          if (currentSession === sid) {
            setCurrentSession('')
            setMessages([WELCOME])
          }
        } catch { message.error('删除失败') }
      },
    })
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return
    const userMessage = inputValue.trim()
    setInputValue('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    setStreamingContent('')

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          session_id: currentSession || undefined,
          student_id: 'default',
          learning_context: learningContext,
          agent_model: agentModel,
          profile: localProfile,
          recent_wrongs: localWrongs.slice(0, 5),
          recent_records: localRecords.slice(0, 3),
        }),
      })
      if (!res.ok) throw new Error('请求失败')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = '', agents: string[] = [], resources: any[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const d = line.slice(6).trim()
            if (d === '[DONE]') continue
            try {
              const data = JSON.parse(d)
              if (data.type === 'stream') { full += data.content || ''; setStreamingContent(full) }
              else if (data.type === 'agent_start') { setActiveAgents(prev => [...prev, data.agent]); }
              else if (data.type === 'agent_done') { setActiveAgents(prev => prev.filter(a => a !== data.agent)); }
              else if (data.type === 'agents_used') { agents = data.agents || []; }
              else if (data.type === 'resources') resources = data.data || []
              else if (data.type === 'session_id' && data.session_id && !currentSession) {
                setCurrentSession(data.session_id)
              }
              else if (data.type === 'error') message.error(data.content)
            } catch {}
          }
        }
      }

      if (full) setMessages(prev => [...prev, { role: 'assistant', content: full, agents, resources }])
      if (!currentSession) loadSessions()
    } catch {
      const context = readCurrentLearningContext()
      const model = readLearnerAgentModel()
      const wrongs = readWrongQuestions()
      const records = readLearningRecords()
      message.warning('AI 接口暂不可用，已使用本地画像规则生成回答')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: generateAgentAwareChatResponse(userMessage, context, model, wrongs, records),
        agents: ['LocalPersonalizationEngine'],
      }])
    } finally {
      setIsLoading(false)
      setStreamingContent('')
      setActiveAgents([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5' }}>
      {/* 会话列表 */}
      <div style={{ width: 240, background: '#fff', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e8e8e8' }}>
          <Button type="primary" icon={<PlusOutlined />} block onClick={createNewSession}>新对话</Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sessions.map(s => (
            <div key={s.session_id}
              onClick={() => { setCurrentSession(s.session_id); loadMessages(s.session_id) }}
              style={{
                padding: '10px 12px', cursor: 'pointer',
                background: s.session_id === currentSession ? '#f0f5ff' : 'transparent',
                borderLeft: s.session_id === currentSession ? '3px solid #4F46E5' : '3px solid transparent',
                borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageOutlined style={{ color: '#999', flexShrink: 0 }} />
                <Text style={{ fontSize: 13, flex: 1, minWidth: 0 }} ellipsis={{ tooltip: s.title || '新对话' }}>
                  {s.title || '新对话'}
                </Text>
              </div>
              <Space size={4} onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                <EditOutlined style={{ fontSize: 12, color: '#999', cursor: 'pointer' }}
                  onClick={() => setRenameModal({ open: true, sessionId: s.session_id, title: s.title })} />
                <DeleteOutlined style={{ fontSize: 12, color: '#ff4d4f', cursor: 'pointer' }}
                  onClick={() => deleteSession(s.session_id)} />
              </Space>
            </div>
          ))}
        </div>
      </div>

      {/* 对话区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 24px', background: 'white', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 12 }}>
          <RobotOutlined style={{ fontSize: 24, color: '#4F46E5' }} />
          <Title level={5} style={{ margin: 0 }}>智能对话</Title>
          <Text type="secondary">与 AI 助手交流，获取个性化学习资源</Text>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {loadingHistory ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> :
            messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                    <RobotOutlined style={{ color: 'white', fontSize: 18 }} />
                  </div>
                )}
                <div style={{ maxWidth: '75%' }}>
                  <div className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
                    {msg.role === 'user' ? <span>{msg.content}</span> : (
                      <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                    )}
                  </div>
                  {msg.agents && msg.agents.length > 0 && (
                    <Space size={4} style={{ marginTop: 4 }} wrap>
                      <Text style={{ fontSize: 11, color: '#999' }}>参与的智能体：</Text>
                      {msg.agents.map((a, j) => <Tag key={j} color="blue" style={{ fontSize: 11 }}>{a}</Tag>)}
                    </Space>
                  )}
                  {msg.resources && msg.resources.length > 0 && (
                    <div style={{ marginTop: 8 }}>{msg.resources.map((r, j) => (
                      <div key={j} className="resource-card" style={{ padding: '8px 12px', background: '#f0f5ff', borderRadius: 8, marginTop: 4, cursor: 'pointer' }}>
                        <Space><Tag color="purple">{r.type_name || r.type}</Tag><Text>{r.title}</Text></Space>
                      </div>
                    ))}</div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 12, flexShrink: 0 }}>
                    <UserOutlined style={{ color: 'white', fontSize: 18 }} />
                  </div>
                )}
              </div>
            ))
          }

          {isLoading && streamingContent && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                <RobotOutlined style={{ color: 'white', fontSize: 18 }} />
              </div>
              <div className="message-bubble message-assistant" style={{ maxWidth: '75%' }}>
                <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown><span className="typing-cursor" /></div>
              </div>
            </div>
          )}

          {isLoading && !streamingContent && (
            <div style={{ marginBottom: 16, paddingLeft: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 20, color: '#4F46E5' }} />} />
                <Text type="secondary">多智能体协作中...</Text>
              </div>
              {/* 多智能体工作流可视化 */}
              <div style={{ background: '#f0f5ff', borderRadius: 8, padding: '12px 16px', border: '1px solid #d6e4ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  <Tag color="blue">Orchestrator</Tag>
                  <span style={{ color: '#999' }}>→</span>
                  {activeAgents.length > 0 ? activeAgents.map((a, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span style={{ color: '#999' }}>+</span>}
                      <Tag color="green" style={{ animation: 'pulse 1.5s infinite' }}>{a}</Tag>
                    </React.Fragment>
                  )) : (
                    <Tag color="default">分析需求中...</Tag>
                  )}
                  {activeAgents.length > 0 && <>
                    <span style={{ color: '#999' }}>→</span>
                    <Tag color="purple">聚合结果</Tag>
                  </>}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '16px 24px', background: 'white', borderTop: '1px solid #e8e8e8' }}>
          <div style={{ display: 'flex', gap: 12, maxWidth: 900, margin: '0 auto' }}>
            <TextArea value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="输入你的问题或学习需求... (Enter 发送)" autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ borderRadius: 8 }} disabled={isLoading} />
            <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} loading={isLoading}
              style={{ height: 40, borderRadius: 8 }}>发送</Button>
          </div>
        </div>
      </div>

      <CurrentLearningContextPanel
        context={learningContext}
        profile={localProfile}
        model={agentModel}
        wrongs={localWrongs}
        records={localRecords}
        onAsk={(question) => setInputValue(question)}
      />

      {/* 重命名弹窗 */}
      <Modal title="重命名对话" open={renameModal.open} onOk={renameSession}
        onCancel={() => setRenameModal({ open: false, sessionId: '', title: '' })} okText="确认" cancelText="取消">
        <Input value={renameModal.title} onChange={e => setRenameModal(prev => ({ ...prev, title: e.target.value }))}
          onPressEnter={renameSession} placeholder="输入新名称" />
      </Modal>
    </div>
  )
}

export default ChatPage
