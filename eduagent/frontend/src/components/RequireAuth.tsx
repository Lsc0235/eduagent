import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUser } from '../services/auth'

type RequireAuthProps = {
  children: React.ReactElement
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation()
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default RequireAuth
