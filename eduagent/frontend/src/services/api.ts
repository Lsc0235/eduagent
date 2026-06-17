import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 对话 API
export const chatAPI = {
  sendMessage: (message: string, sessionId?: string, studentId = 'default') =>
    fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId, student_id: studentId }),
    }),

  createSession: (studentId = 'default', title?: string) =>
    api.post('/chat/sessions', { student_id: studentId, title }),

  listSessions: (studentId: string) =>
    api.get(`/chat/sessions/${studentId}`),

  getMessages: (sessionId: string) =>
    api.get(`/chat/messages/${sessionId}`),
}

// 画像 API
export const profileAPI = {
  getProfile: (studentId = 'default') =>
    api.get(`/profile/${studentId}`),

  updateProfile: (conversation: string, studentId = 'default') =>
    api.post('/profile/update', { student_id: studentId, conversation }),
}

// 资源 API
export const resourceAPI = {
  generate: (topic: string, types: string[] = ['document', 'mindmap', 'quiz'], difficulty = 'medium', studentId = 'default') =>
    api.post('/resource/generate', {
      topic,
      resource_types: types,
      difficulty,
      student_id: studentId,
    }),

  listResources: (studentId = 'default', type?: string, topic?: string) => {
    let url = `/resource/list/${studentId}`
    const params = new URLSearchParams()
    if (type) params.append('resource_type', type)
    if (topic) params.append('topic', topic)
    const qs = params.toString()
    return api.get(url + (qs ? `?${qs}` : ''))
  },

  getDetail: (resourceId: string) =>
    api.get(`/resource/detail/${resourceId}`),
}

// 学习路径 API
export const pathAPI = {
  generate: (course = '人工智能导论', studentId = 'default') =>
    api.post('/path/generate', { student_id: studentId, course }),

  getPath: (studentId = 'default', course?: string) => {
    let url = `/path/${studentId}`
    if (course) url += `?course=${course}`
    return api.get(url)
  },

  updateProgress: (pathId: string, nodeId: string) =>
    api.put(`/path/${pathId}/progress?node_id=${nodeId}`),
}

// 评估 API
export const evaluationAPI = {
  getReport: (studentId = 'default') =>
    api.get(`/evaluation/report/${studentId}`),
}

export default api
