import React from 'react'
import { Card, Empty, List, Tag, Typography } from 'antd'
import type { AgentUpdateLog } from '../../types/personalization'

const { Text } = Typography

const sourceColor: Record<AgentUpdateLog['source'], string> = {
  interview: 'blue',
  diagnostic: 'purple',
  learning_record: 'green',
  wrong_questions: 'orange',
  evaluation: 'cyan',
  chat: 'magenta',
  manual: 'gold',
}

const AgentUpdateLogPanel: React.FC<{ logs: AgentUpdateLog[] }> = ({ logs }) => (
  <Card title="Agent 更新记录">
    {logs.length === 0 ? (
      <Empty description="完成单点速学练习或项目任务后，这里会出现 Agent 更新记录。" />
    ) : (
      <List
        dataSource={logs}
        renderItem={item => (
          <List.Item>
            <List.Item.Meta
              title={(
                <>
                  <Tag color={sourceColor[item.source]}>{item.title}</Tag>
                  <Text>{item.summary}</Text>
                </>
              )}
              description={`${item.createdAt.replace('T', ' ').slice(0, 16)}${item.relatedTopic ? ` · ${item.relatedTopic}` : ''}`}
            />
          </List.Item>
        )}
      />
    )}
  </Card>
)

export default AgentUpdateLogPanel
