import React from 'react'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  BookOutlined,
  BranchesOutlined,
  CheckOutlined,
  CodeOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  BauhausButton,
  BauhausCard,
  BauhausLogo,
  BauhausStat,
  BauhausStep,
} from '../design-system/bauhaus/BauhausPrimitives'
import '../styles/design-preview.css'

const featureCards = [
  {
    label: 'PROFILE',
    title: '画像不是侧栏信息，而是学习发动机',
    text: '7 维画像被放进学习流程本体：教材、视频、代码、测评都从画像中读取依据。',
    tone: 'red' as const,
    shape: 'circle' as const,
  },
  {
    label: 'AGENTS',
    title: '多智能体被设计成可追踪的生产线',
    text: 'Planner、Profiler、Resource、Evaluator 分工清晰，用户能看到每一步的输出证据。',
    tone: 'blue' as const,
    shape: 'square' as const,
  },
  {
    label: 'EVIDENCE',
    title: '答辩视角优先，所有指标都有去处',
    text: '画像覆盖、资源匹配、错因补强、再次测评被压缩成可解释的证据面板。',
    tone: 'yellow' as const,
    shape: 'triangle' as const,
  },
]

const agentRows = [
  ['Planner', '拆解神经网络学习路径', 'DONE'],
  ['Profiler', '读取画像与薄弱点', 'DONE'],
  ['Resource', '生成教材与视频队列', 'RUN'],
  ['Evaluator', '等待测评回传', 'NEXT'],
]

const DesignPreviewPage: React.FC = () => {
  return (
    <div className="bauhaus-preview">
      <header className="bh-nav">
        <div className="bh-nav-brand">
          <BauhausLogo />
          <div>
            <strong>智学通</strong>
            <span>BAUHAUS SYSTEM</span>
          </div>
        </div>
        <nav className="bh-nav-links" aria-label="Bauhaus preview sections">
          <a>学习闭环</a>
          <a>多智能体</a>
          <a>证据中心</a>
          <a>答辩模式</a>
        </nav>
        <button className="bh-menu-button" aria-label="menu">
          <span />
          <span />
        </button>
      </header>

      <main>
        <section className="bh-hero">
          <div className="bh-hero-copy">
            <div className="bh-eyebrow">FORM FOLLOWS LEARNING</div>
            <h1>
              AI 学习
              <span>闭环系统</span>
            </h1>
            <p>
              把智学通改造成一张可操作的包豪斯学习海报：粗边框、三原色、几何构成，
              每个模块都承担明确功能。
            </p>
            <div className="bh-hero-actions">
              <BauhausButton tone="red" icon={<ArrowRightOutlined />}>开始学习</BauhausButton>
              <BauhausButton tone="yellow" icon={<RobotOutlined />}>查看 Agent</BauhausButton>
            </div>
          </div>

          <div className="bh-hero-panel">
            <div className="bh-shape bh-circle red" />
            <div className="bh-shape bh-square yellow" />
            <div className="bh-shape bh-square blue rotate" />
            <div className="bh-shape bh-triangle black" />
            <div className="bh-composition-label">
              <strong>EDU</strong>
              <span>AGENT</span>
            </div>
          </div>
        </section>

        <section className="bh-stats-section">
          <BauhausStat value="7/7" label="画像覆盖" detail="知识、目标、兴趣、习惯全部接入流程" tone="red" />
          <BauhausStat value="91%" label="资源匹配" detail="围绕教材与薄弱点筛选学习资料" tone="blue" />
          <BauhausStat value="+16" label="预计提升" detail="错因补强后进入二次测评" tone="yellow" />
          <BauhausStat value="4" label="Agent 协作" detail="规划、画像、资源、评估并行工作" tone="red" />
        </section>

        <section className="bh-section bh-features">
          <div className="bh-section-heading">
            <span>01 / SYSTEM DNA</span>
            <h2>用几何和功能重构学习界面</h2>
          </div>

          <div className="bh-card-grid">
            {featureCards.map(card => (
              <BauhausCard
                key={card.label}
                label={card.label}
                title={card.title}
                tone={card.tone}
                shape={card.shape}
              >
                <p>{card.text}</p>
              </BauhausCard>
            ))}
          </div>
        </section>

        <section className="bh-section bh-workbench-section">
          <div className="bh-section-heading">
            <span>02 / PRODUCT PREVIEW</span>
            <h2>学习工作台示例</h2>
          </div>

          <div className="bh-workbench">
            <aside className="bh-workbench-rail">
              <div className="bh-rail-item active"><UserOutlined />画像</div>
              <div className="bh-rail-item"><BookOutlined />教材</div>
              <div className="bh-rail-item"><PlayCircleOutlined />视频</div>
              <div className="bh-rail-item"><CodeOutlined />代码</div>
              <div className="bh-rail-item"><ExperimentOutlined />测评</div>
            </aside>

            <div className="bh-workbench-main">
              <div className="bh-workbench-title">
                <div>
                  <span>ACTIVE LOOP</span>
                  <h3>神经网络：从视频推导到代码练习</h3>
                </div>
                <div className="bh-status-block">RUNNING</div>
              </div>

              <div className="bh-loop-map">
                <div className="bh-loop-card red"><UserOutlined />画像校准</div>
                <div className="bh-loop-card blue"><BookOutlined />书籍规划</div>
                <div className="bh-loop-card yellow"><PlayCircleOutlined />视频资源</div>
                <div className="bh-loop-card white"><CodeOutlined />代码练习</div>
                <div className="bh-loop-card black"><ExperimentOutlined />错因测评</div>
              </div>
            </div>

            <aside className="bh-agent-board">
              <div className="bh-agent-head">
                <BranchesOutlined />
                <strong>AGENT LINE</strong>
              </div>
              {agentRows.map(([name, desc, state]) => (
                <div className="bh-agent-row" key={name}>
                  <div>
                    <strong>{name}</strong>
                    <span>{desc}</span>
                  </div>
                  <em>{state}</em>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <section className="bh-section bh-steps-section">
          <div className="bh-section-heading">
            <span>03 / HOW IT WORKS</span>
            <h2>四步闭环，像机械结构一样清楚</h2>
          </div>
          <div className="bh-step-grid">
            <BauhausStep index="01" title="画像进入系统" text="不是展示资料，而是作为资源生成与测评的输入。" tone="red" />
            <BauhausStep index="02" title="资源被构造" text="教材、视频、代码练习以几何卡片队列呈现。" tone="blue" />
            <BauhausStep index="03" title="测评暴露错因" text="错题不只是分数，而是下一轮补强的证据。" tone="yellow" />
            <BauhausStep index="04" title="报告可答辩" text="所有结果都汇总到面向评委的证据面板。" tone="red" />
          </div>
        </section>

        <section className="bh-final-cta">
          <div className="bh-cta-shape circle" />
          <div className="bh-cta-shape square" />
          <div>
            <span>READY FOR FULL APP</span>
            <h2>如果你认可这个方向，下一步我会把全站统一成这套 Bauhaus 系统。</h2>
          </div>
          <BauhausButton tone="blue" icon={<CheckOutlined />}>确认风格</BauhausButton>
        </section>

        <footer className="bh-footer">
          <span>BAUHAUS DESIGN SYSTEM</span>
          <span><AppstoreOutlined /> Tokens / Layout / Panels / Status</span>
        </footer>
      </main>
    </div>
  )
}

export default DesignPreviewPage
