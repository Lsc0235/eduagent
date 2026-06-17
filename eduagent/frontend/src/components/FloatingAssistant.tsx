import React, { useState, useRef, useEffect } from 'react'
import { Card, Button, Input, Typography, Space, Avatar, Spin, message, Tooltip } from 'antd'
import { RobotOutlined, SendOutlined, CloseOutlined, MinusOutlined, ExpandOutlined, DragOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography
const { TextArea } = Input

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface FloatingAssistantProps {
  topic?: string
  context?: string
}

const FloatingAssistant: React.FC<FloatingAssistantProps> = ({
  topic,
  context,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 拖拽相关状态
  const [position, setPosition] = useState({ x: window.innerWidth - 424, y: window.innerHeight - 524 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 打开时清空未读计数
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
    }
  }, [isOpen])

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('button')) {
      return // 如果点击的是按钮，不触发拖拽
    }
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  // 处理拖拽中
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x))
        const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y))
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // 发送消息
  const sendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      // 使用流式响应
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          student_id: 'default',
        }),
      })

      if (!res.ok) {
        throw new Error('请求失败')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      let assistantAdded = false

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'stream' && parsed.content) {
                  assistantContent += parsed.content
                  if (!assistantAdded) {
                    setMessages(prev => [...prev, {
                      role: 'assistant',
                      content: assistantContent,
                      timestamp: Date.now(),
                    }])
                    assistantAdded = true
                  } else {
                    setMessages(prev => {
                      const newMsgs = [...prev]
                      const lastMsg = newMsgs[newMsgs.length - 1]
                      if (lastMsg.role === 'assistant') {
                        lastMsg.content = assistantContent
                      }
                      return newMsgs
                    })
                  }
                } else if (parsed.type === 'error') {
                  message.error(parsed.content || 'AI 回复出错')
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 如果没有收到任何内容，显示默认回复
      if (!assistantContent) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '抱歉，我暂时无法回答这个问题。请稍后重试。',
          timestamp: Date.now(),
        }])
      }

      if (!isOpen) {
        setUnreadCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('发送失败:', error)
      message.error('发送失败，请稍后重试')
      // 添加错误提示消息
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '网络连接失败，请检查网络后重试。',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  // 清空对话
  const clearMessages = () => {
    setMessages([])
    setUnreadCount(0)
  }

  // 切换最小化状态
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  return (
    <>
      {/* 悬浮按钮 */}
      {!isOpen && (
        <Tooltip title="AI 学习助手 (可拖拽)" placement="left">
          <div
            onMouseDown={handleMouseDown}
            onClick={() => !isDragging && setIsOpen(true)}
            style={{
              position: 'fixed',
              left: position.x + 20,
              top: position.y + 20,
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 20px rgba(102, 126, 234, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isDragging ? 'grabbing' : 'grab',
              transition: isDragging ? 'none' : 'all 0.3s ease',
              zIndex: 1000,
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isDragging) {
                e.currentTarget.style.transform = 'scale(1.1)'
                e.currentTarget.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.6)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isDragging) {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.5)'
              }
            }}
          >
            <DragOutlined style={{ position: 'absolute', top: 2, right: 2, fontSize: 10, color: 'rgba(255,255,255,0.7)' }} />
            <RobotOutlined style={{ fontSize: 28, color: '#fff' }} />
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#ff4d4f',
                color: '#fff',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}>
                {unreadCount}
              </div>
            )}
          </div>
        </Tooltip>
      )}

      {/* 对话窗口 */}
      {isOpen && (
        <div
          ref={dragRef}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: isMinimized ? 300 : 400,
            height: isMinimized ? 60 : 500,
            maxHeight: '80vh',
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 1000,
            transition: isDragging ? 'none' : 'all 0.3s ease',
          }}
        >
          {/* 头部 - 可拖拽 */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            <Space>
              <Avatar
                size={32}
                icon={<RobotOutlined />}
                style={{ background: 'rgba(255,255,255,0.2)' }}
              />
              <div>
                <Text style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>AI 学习助手</Text>
                {topic && (
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block' }}>
                    正在学习：{topic}
                  </Text>
                )}
              </div>
            </Space>
            <Space>
              <DragOutlined style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
              <Tooltip title={isMinimized ? '展开' : '最小化'}>
                <Button
                  type="text"
                  icon={isMinimized ? <ExpandOutlined /> : <MinusOutlined />}
                  onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
                  style={{ color: '#fff' }}
                />
              </Tooltip>
              <Tooltip title="关闭">
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                  style={{ color: '#fff' }}
                />
              </Tooltip>
            </Space>
          </div>

          {/* 消息区域 */}
          {!isMinimized && (
            <>
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
                background: '#f5f5f5',
              }}>
                {messages.length === 0 ? (
                  <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                  }}>
                    <RobotOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
                    <Text type="secondary">有任何问题，随时问我！</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      比如："帮我解释一下反向传播"
                    </Text>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: 12,
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div style={{
                        maxWidth: '80%',
                        padding: '10px 14px',
                        borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : '#fff',
                        color: msg.role === 'user' ? '#fff' : '#333',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}>
                        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    marginBottom: 12,
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '12px 12px 12px 0',
                      background: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}>
                      <Spin size="small" />
                      <Text style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                        AI 正在思考...
                      </Text>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 输入区域 */}
              <div style={{
                padding: '12px 16px',
                background: '#fff',
                borderTop: '1px solid #f0f0f0',
              }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <TextArea
                    placeholder="输入你的问题..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    style={{ borderRadius: 8, flex: 1 }}
                    disabled={loading}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={sendMessage}
                    loading={loading}
                    style={{
                      borderRadius: 8,
                      height: 'auto',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  />
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    按 Enter 发送，Shift+Enter 换行
                  </Text>
                  {messages.length > 0 && (
                    <Button
                      type="link"
                      size="small"
                      onClick={clearMessages}
                      style={{ fontSize: 11, padding: 0 }}
                    >
                      清空对话
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default FloatingAssistant
