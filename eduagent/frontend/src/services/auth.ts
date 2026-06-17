export type AuthUser = {
  name: string
  email: string
  password: string
}

export type PublicUser = Omit<AuthUser, 'password'>

const USERS_KEY = 'eduagent.bauhaus.users'
const SESSION_KEY = 'eduagent.bauhaus.session'

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const readUsers = (): AuthUser[] => {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeUsers = (users: AuthUser[]) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const setSession = (email: string) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(SESSION_KEY, normalizeEmail(email))
}

const toPublicUser = (user: AuthUser): PublicUser => ({
  name: user.name,
  email: user.email,
})

export const getCurrentUser = (): PublicUser | null => {
  if (!canUseStorage()) return null

  const email = window.localStorage.getItem(SESSION_KEY)
  if (!email) return null

  const user = readUsers().find(item => item.email === normalizeEmail(email))
  return user ? toPublicUser(user) : null
}

export const register = (name: string, email: string, password: string): PublicUser => {
  const normalizedEmail = normalizeEmail(email)
  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new Error('请输入你的昵称')
  }

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('请输入有效邮箱')
  }

  if (password.length < 6) {
    throw new Error('密码至少 6 位')
  }

  const users = readUsers()
  if (users.some(user => user.email === normalizedEmail)) {
    throw new Error('该邮箱已注册，请直接登录')
  }

  const user: AuthUser = {
    name: trimmedName,
    email: normalizedEmail,
    password,
  }

  writeUsers([...users, user])
  setSession(user.email)

  return toPublicUser(user)
}

export const login = (email: string, password: string): PublicUser => {
  const normalizedEmail = normalizeEmail(email)
  const user = readUsers().find(item => item.email === normalizedEmail)

  if (!user) {
    throw new Error('账号不存在，请先注册')
  }

  if (user.password !== password) {
    throw new Error('密码不正确')
  }

  setSession(user.email)
  return toPublicUser(user)
}

export const logout = () => {
  if (!canUseStorage()) return
  window.localStorage.removeItem(SESSION_KEY)
}
