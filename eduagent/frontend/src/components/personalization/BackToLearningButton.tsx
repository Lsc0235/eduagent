import React from 'react'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface Props {
  topic?: string
  label?: string
}

const BackToLearningButton: React.FC<Props> = ({ topic, label = '返回开始学习' }) => {
  const navigate = useNavigate()
  const target = topic ? `/learning?topic=${encodeURIComponent(topic)}` : '/learning'

  return (
    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(target)}>
      {label}
    </Button>
  )
}

export default BackToLearningButton
