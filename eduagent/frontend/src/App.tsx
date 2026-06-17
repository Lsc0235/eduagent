import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import MainLayout from './components/MainLayout'
import RequireAuth from './components/RequireAuth'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import LearningPage from './pages/LearningPage'
import WrongBookPage from './pages/WrongBookPage'
import EvaluationPage from './pages/EvaluationPage'
import TechStackPage from './pages/TechStackPage'
import DesignPreviewPage from './pages/DesignPreviewPage'
import ProjectTaskPage from './pages/ProjectTaskPage'
import SingleTopicPage from './pages/SingleTopicPage'
import SystemStudyPage from './pages/SystemStudyPage'
import SystemStudyWorkspacePage from './pages/SystemStudyWorkspacePage'
import ProjectWorkspacePage from './pages/ProjectWorkspacePage'
import { bauhausTokens } from './design-system/bauhaus/tokens'
import './styles/bauhaus-app.css'

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: bauhausTokens.colors.red,
          colorInfo: bauhausTokens.colors.blue,
          colorWarning: bauhausTokens.colors.yellow,
          colorText: bauhausTokens.colors.foreground,
          colorBgLayout: bauhausTokens.colors.background,
          colorBgContainer: bauhausTokens.colors.white,
          colorBorder: bauhausTokens.colors.foreground,
          borderRadius: 0,
          fontFamily: 'Outfit, Arial, Helvetica, sans-serif',
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/design-preview" element={<DesignPreviewPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <MainLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/learning" replace />} />
            <Route path="learning" element={<LearningPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="learn/single-topic" element={<SingleTopicPage />} />
            <Route path="learn/system" element={<SystemStudyPage />} />
            <Route path="learn/system-workspace" element={<SystemStudyWorkspacePage />} />
            <Route path="learn/project" element={<ProjectTaskPage />} />
            <Route path="learn/project-workspace" element={<ProjectWorkspacePage />} />
            <Route path="wrong-book" element={<WrongBookPage />} />
            <Route path="evaluation" element={<EvaluationPage />} />
            <Route path="tech-stack" element={<TechStackPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
