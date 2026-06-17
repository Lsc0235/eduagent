import React, { useState, useRef, useEffect } from 'react'
import { Card, Button, Space, Typography, Tag, Alert, Spin, Tabs, Collapse, message, Tooltip, Select, Dropdown } from 'antd'
import { PlayCircleOutlined, CopyOutlined, CheckOutlined, CodeOutlined, BulbOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'

const { Title, Text, Paragraph } = Typography

// Pyodide 实例（全局共享，按版本缓存）
const pyodideInstances: Record<string, any> = {}
const pyodideLoadingStates: Record<string, boolean> = {}

// 支持的编译环境
const ENVIRONMENTS = [
  {
    id: 'python3',
    name: 'Python 3.x',
    version: '3.11',
    icon: '🐍',
    description: '浏览器内运行（Pyodide）',
    available: true,
  },
  {
    id: 'python3-fast',
    name: 'Python 3.x (快速)',
    version: '3.11',
    icon: '⚡',
    description: '加载更快，库较少',
    available: true,
  },
]

const loadPyodideEnv = async (envId: string) => {
  if (pyodideInstances[envId]) return pyodideInstances[envId]
  if (pyodideLoadingStates[envId]) {
    while (pyodideLoadingStates[envId]) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return pyodideInstances[envId]
  }

  pyodideLoadingStates[envId] = true
  try {
    // 动态加载 Pyodide
    if (!(window as any).loadPyodide) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js'
      document.head.appendChild(script)
      await new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
      })
    }

    // 根据环境选择加载配置
    const config: any = {
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
    }

    // 快速模式：跳过大型包的加载
    if (envId === 'python3-fast') {
      config.loadOptions = {
        packages: ['numpy'], // 只加载必要的包
      }
    }

    pyodideInstances[envId] = await (window as any).loadPyodide(config)
    return pyodideInstances[envId]
  } catch (error) {
    console.error('Failed to load Pyodide:', error)
    throw error
  } finally {
    pyodideLoadingStates[envId] = false
  }
}

interface CodeStep {
  title: string
  explanation: string
  code: string
  expectedOutput?: string
  hint?: string
}

interface CodeEditorProps {
  code: string
  steps?: CodeStep[]
  topic?: string
  onRunComplete?: (success: boolean, output: string) => void
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  steps,
  topic,
  onRunComplete
}) => {
  const [editorCode, setEditorCode] = useState(code)
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('editor')
  const [currentStep, setCurrentStep] = useState(0)
  const [showSteps, setShowSteps] = useState(!!steps && steps.length > 0)
  const [selectedEnv, setSelectedEnv] = useState('python3')
  const [envLoading, setEnvLoading] = useState(false)

  // 如果有步骤，初始化为第一个步骤的代码
  useEffect(() => {
    if (steps && steps.length > 0) {
      // 清理代码中的 markdown 标记
      let cleanCode = steps[0].code
        .replace(/```python\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()
      setEditorCode(cleanCode)
    }
  }, [steps])

  const runCode = async () => {
    setIsRunning(true)
    setOutput('')
    setEnvLoading(true)
    try {
      const pyodide = await loadPyodideEnv(selectedEnv)
      setEnvLoading(false)

      // 清理代码中的 markdown 标记
      let cleanCode = editorCode
        .replace(/```python\s*/gi, '')  // 移除 ```python
        .replace(/```\s*/g, '')         // 移除 ```
        .trim()

      // 检测需要的包并加载
      const packagesNeeded = new Set<string>()
      if (cleanCode.includes('import numpy') || cleanCode.includes('from numpy')) {
        packagesNeeded.add('numpy')
      }
      if (cleanCode.includes('import matplotlib') || cleanCode.includes('from matplotlib')) {
        packagesNeeded.add('matplotlib')
      }
      if (cleanCode.includes('import pandas') || cleanCode.includes('from pandas')) {
        packagesNeeded.add('pandas')
      }
      if (cleanCode.includes('import scipy') || cleanCode.includes('from scipy')) {
        packagesNeeded.add('scipy')
      }

      // 加载需要的包
      if (packagesNeeded.size > 0) {
        message.loading(`正在加载依赖包: ${Array.from(packagesNeeded).join(', ')}...`, 0)
        try {
          await pyodide.loadPackage(Array.from(packagesNeeded))
          message.destroy()
          message.success('依赖包加载完成')
        } catch (loadError: any) {
          message.destroy()
          message.warning('部分依赖包加载失败，尝试继续运行')
        }
      }

      // 清理之前的输出
      pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`)

      // 运行清理后的代码
      let result: string
      try {
        pyodide.runPython(cleanCode)
        // 获取标准输出
        result = pyodide.runPython('sys.stdout.getvalue()')
      } catch (error: any) {
        result = `❌ 运行错误:\n${error.message}`
      }

      setOutput(result || '（无输出）')
      setHasRun(true)
      setActiveTab('output')

      // 检查是否与预期输出匹配
      if (steps && steps[currentStep]?.expectedOutput) {
        const expected = steps[currentStep].expectedOutput.trim()
        const actual = result.trim()
        if (actual === expected) {
          message.success('🎉 输出正确！')
          onRunComplete?.(true, result)
        } else {
          message.warning('输出与预期不符，请检查代码')
          onRunComplete?.(false, result)
        }
      } else {
        onRunComplete?.(true, result)
      }
    } catch (error: any) {
      setOutput(`❌ 运行失败: ${error.message}`)
      message.error('代码运行失败')
      onRunComplete?.(false, error.message)
    } finally {
      setIsRunning(false)
      setEnvLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(editorCode)
    setCopied(true)
    message.success('代码已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  const nextStep = () => {
    if (steps && currentStep < steps.length - 1) {
      const next = currentStep + 1
      setCurrentStep(next)
      setEditorCode(steps[next].code)
      setOutput('')
      setHasRun(false)
    }
  }

  const prevStep = () => {
    if (steps && currentStep > 0) {
      const prev = currentStep - 1
      setCurrentStep(prev)
      setEditorCode(steps[prev].code)
      setOutput('')
      setHasRun(false)
    }
  }

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden' }}>
      {/* 步骤导航（如果有步骤） */}
      {showSteps && steps && (
        <Card
          size="small"
          style={{ marginBottom: 16, background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' }}
          variant="borderless"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <Tag color="blue">步骤 {currentStep + 1}/{steps.length}</Tag>
              <Text strong>{steps[currentStep].title}</Text>
            </Space>
            <Space>
              <Button size="small" onClick={prevStep} disabled={currentStep === 0}>
                上一步
              </Button>
              <Button size="small" onClick={nextStep} disabled={currentStep === steps.length - 1}>
                下一步
              </Button>
            </Space>
          </div>
          <Paragraph style={{ margin: 0, fontSize: 13 }}>
            {steps[currentStep].explanation}
          </Paragraph>
          {steps[currentStep].hint && (
            <Alert
              type="info"
              icon={<BulbOutlined />}
              message={<Text style={{ fontSize: 12 }}>{steps[currentStep].hint}</Text>}
              style={{ marginTop: 8 }}
              showIcon
            />
          )}
        </Card>
      )}

      {/* 主编辑器区域 */}
      <Card
        variant="borderless"
        style={{ background: '#1e1e1e', borderRadius: 16 }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{
            margin: 0,
            padding: '0 16px',
            background: '#2d2d2d',
          }}
          items={[
            {
              key: 'editor',
              label: (
                <Space>
                  <CodeOutlined style={{ color: activeTab === 'editor' ? '#667eea' : '#999' }} />
                  <span style={{ color: activeTab === 'editor' ? '#667eea' : '#999' }}>代码编辑</span>
                </Space>
              ),
              children: (
                <div style={{ height: 400 }}>
                  <Editor
                    height="400px"
                    language="python"
                    theme="vs-dark"
                    value={editorCode}
                    onChange={(value) => setEditorCode(value || '')}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      padding: { top: 16, bottom: 16 },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      automaticLayout: true,
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'output',
              label: (
                <Space>
                  <ThunderboltOutlined style={{ color: activeTab === 'output' ? '#10b981' : '#999' }} />
                  <span style={{ color: activeTab === 'output' ? '#10b981' : '#999' }}>
                    运行结果 {hasRun && (output.includes('❌') ? '❌' : '✅')}
                  </span>
                </Space>
              ),
              children: (
                <div style={{
                  height: 400,
                  padding: 16,
                  fontFamily: 'Monaco, Menlo, monospace',
                  fontSize: 13,
                  color: '#d4d4d4',
                  background: '#1e1e1e',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                }}>
                  {output || (
                    <Text style={{ color: '#666' }}>
                      点击"运行代码"查看输出结果...
                    </Text>
                  )}
                </div>
              ),
            },
          ]}
        />

        {/* 操作按钮栏 */}
        <div style={{
          padding: '12px 16px',
          background: '#2d2d2d',
          borderTop: '1px solid #404040',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Space>
            <Tooltip title={copied ? '已复制' : '复制代码'}>
              <Button
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={copyCode}
                style={{ color: '#d4d4d4', borderColor: '#555' }}
              >
                {copied ? '已复制' : '复制代码'}
              </Button>
            </Tooltip>
          </Space>

          <Space>
            {/* 编译环境选择器 */}
            <Dropdown
              menu={{
                items: ENVIRONMENTS.map(env => ({
                  key: env.id,
                  label: (
                    <div style={{ padding: '4px 0' }}>
                      <div>
                        <span style={{ marginRight: 8 }}>{env.icon}</span>
                        <strong>{env.name}</strong>
                        <Tag style={{ marginLeft: 8 }}>{env.version}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>{env.description}</div>
                    </div>
                  ),
                  onClick: () => setSelectedEnv(env.id),
                })),
              }}
              trigger={['click']}
            >
              <Button
                style={{
                  color: '#d4d4d4',
                  borderColor: '#555',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <SettingOutlined />
                <span>{ENVIRONMENTS.find(e => e.id === selectedEnv)?.icon}</span>
                <span>{ENVIRONMENTS.find(e => e.id === selectedEnv)?.name}</span>
              </Button>
            </Dropdown>

            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={isRunning}
              onClick={runCode}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderColor: 'transparent',
                height: 40,
                paddingInline: 24,
                fontWeight: 600,
              }}
            >
              {isRunning ? (envLoading ? '加载环境中...' : '运行中...') : '运行代码'}
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}

export default CodeEditor
