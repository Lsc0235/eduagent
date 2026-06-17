import React from 'react'
import { Alert, Space, Typography } from 'antd'

const { Text } = Typography

const BookRecommendationReason: React.FC<{ book: any }> = ({ book }) => (
  <Alert
    type="info"
    showIcon
    message="为什么推荐这本书？"
    description={
      <Space direction="vertical" size={4}>
        <Text>{book.personalized_reason || book.fit_reason || '这本书与当前知识点匹配度较高。'}</Text>
        {book.profile_fit && <Text type="secondary">{book.profile_fit}</Text>}
        {book.study_advice && <Text type="secondary">学习建议：{book.study_advice}</Text>}
      </Space>
    }
  />
)

export default BookRecommendationReason
