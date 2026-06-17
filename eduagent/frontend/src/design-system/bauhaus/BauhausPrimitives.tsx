import React from 'react'
import type { ReactNode } from 'react'
import type { BauhausTone } from './tokens'

type BauhausButtonProps = {
  children: ReactNode
  tone?: BauhausTone
  icon?: ReactNode
}

export const BauhausLogo: React.FC = () => (
  <div className="bh-logo" aria-label="智学通 Bauhaus logo">
    <span className="bh-logo-circle" />
    <span className="bh-logo-square" />
    <span className="bh-logo-triangle" />
  </div>
)

export const BauhausButton: React.FC<BauhausButtonProps> = ({ children, tone = 'red', icon }) => (
  <button className={`bh-button tone-${tone}`}>
    {icon && <span className="bh-button-icon">{icon}</span>}
    <span>{children}</span>
  </button>
)

type BauhausCardProps = {
  children: ReactNode
  title?: string
  label?: string
  tone?: 'red' | 'blue' | 'yellow'
  shape?: 'circle' | 'square' | 'triangle'
  className?: string
}

export const BauhausCard: React.FC<BauhausCardProps> = ({
  children,
  title,
  label,
  tone = 'red',
  shape = 'square',
  className = '',
}) => (
  <section className={`bh-card ${className}`}>
    <span className={`bh-corner-shape tone-${tone} shape-${shape}`} />
    {label && <div className="bh-label">{label}</div>}
    {title && <h3>{title}</h3>}
    {children}
  </section>
)

type BauhausStatProps = {
  value: string
  label: string
  detail: string
  tone: 'red' | 'blue' | 'yellow'
}

export const BauhausStat: React.FC<BauhausStatProps> = ({ value, label, detail, tone }) => (
  <div className="bh-stat">
    <div className={`bh-stat-mark tone-${tone}`}>{value}</div>
    <strong>{label}</strong>
    <span>{detail}</span>
  </div>
)

type BauhausStepProps = {
  index: string
  title: string
  text: string
  tone: 'red' | 'blue' | 'yellow'
}

export const BauhausStep: React.FC<BauhausStepProps> = ({ index, title, text, tone }) => (
  <div className="bh-step">
    <div className={`bh-step-number tone-${tone}`}>
      <span>{index}</span>
    </div>
    <h3>{title}</h3>
    <p>{text}</p>
  </div>
)
