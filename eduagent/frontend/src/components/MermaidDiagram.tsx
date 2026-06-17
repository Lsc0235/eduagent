import React, { useEffect, useRef, useState } from 'react'
import { Typography } from 'antd'

const { Text } = Typography

interface MermaidDiagramProps {
  code: string
  style?: React.CSSProperties
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code, style }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [renderStatus, setRenderStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // 注入美化样式（只注入一次）
    if (!document.getElementById('mermaid-beauty-css')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'mermaid-beauty-css'
      styleEl.textContent = `
        /* 禁止节点交互晃动 */
        .mermaid .node:hover {
          filter: none !important;
          cursor: default !important;
        }
        .mermaid .edgePath:hover {
          stroke-width: 2px !important;
        }
        /* 节点圆角美化 */
        .mermaid .node rect {
          rx: 10px !important;
          ry: 10px !important;
          stroke-width: 2px !important;
        }
        /* 文字抗锯齿 */
        .mermaid text {
          -webkit-font-smoothing: antialiased;
        }
      `
      document.head.appendChild(styleEl)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      const target = ref.current
      const diagramCode = code?.trim()
      
      if (!target || !diagramCode) {
        setRenderStatus('error')
        setErrorMsg('内容为空')
        return
      }

      try {
        setRenderStatus('loading')
        
        const module = await import('mermaid')
        const mermaid = module.default

        if (cancelled || !ref.current) return
        
        ref.current.removeAttribute('data-processed')
        ref.current.innerHTML = diagramCode

        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#eef2ff',
            primaryTextColor: '#1f2937',
            primaryBorderColor: '#4F46E5',
            lineColor: '#94a3b8',
            secondaryColor: '#f0fdf4',
            tertiaryColor: '#fefce8',
            fontSize: '14px',
            fontFamily: '"PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
          },
          mindmap: {
            useMaxWidth: true,
            padding: 16,
          },
          securityLevel: 'loose',
          logLevel: 'error',
          // 禁用交互事件防止晃动
          deterministicIds: true,
        })
        
        await mermaid.run({ nodes: [ref.current] })
        
        // 渲染后移除所有点击事件绑定，防止晃动
        if (ref.current) {
          const allNodes = ref.current.querySelectorAll('.node, .edgePath, .edgeLabel, .cluster')
          allNodes.forEach((node) => {
            // 替换节点为克隆节点，移除所有事件监听
            const clone = node.cloneNode(true)
            node.parentNode?.replaceChild(clone, node)
          })
        }

        if (!cancelled) {
          setRenderStatus('success')
        }
      } catch (err: any) {
        console.error('Mermaid error:', err)
        if (!cancelled) {
          setRenderStatus('error')
          setErrorMsg(err?.message || '渲染失败')
          if (ref.current) ref.current.textContent = diagramCode
        }
      }
    }

    const timer = setTimeout(render, 150)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [code])

  if (!code?.trim()) {
    return (
      <div style={{ 
        textAlign: 'center', padding: 40, color: '#999',
        background: '#fafafa', borderRadius: 12 
      }}>
        <Text type="secondary">暂无思维导图数据</Text>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {renderStatus === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.85)', borderRadius: 12, zIndex: 1,
        }}>
          <Text type="secondary">⏳ 正在渲染思维导图...</Text>
        </div>
      )}

      <div 
        ref={ref} 
        className="mermaid" 
        style={{ 
          background: '#fafbfc',
          padding: 24,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          minHeight: 200,
          overflow: 'auto',
          opacity: renderStatus === 'loading' ? 0.3 : 1,
          transition: 'opacity 0.3s',
          userSelect: 'text',
          ...style,
        }} 
      />

      {renderStatus === 'success' && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            📌 知识点层级关系总览
          </Text>
        </div>
      )}

      {renderStatus === 'error' && (
        <div style={{
          marginTop: 12, background: '#fff7e6',
          border: '1px solid #ffd591', borderRadius: 8, padding: 12,
        }}>
          <Text type="warning" strong>渲染失败：</Text>
          <Text type="secondary" style={{ marginLeft: 8 }}>{errorMsg}</Text>
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: '#666' }}>查看源码</summary>
            <pre style={{
              background: '#f5f5f5', padding: 12, borderRadius: 6,
              fontSize: 12, marginTop: 8, maxHeight: 200,
              overflow: 'auto', whiteSpace: 'pre-wrap',
            }}>{code}</pre>
          </details>
        </div>
      )}
    </div>
  )
}

export default MermaidDiagram
