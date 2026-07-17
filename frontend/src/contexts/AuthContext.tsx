// Dummy auth context.
//
// This exposes the FINAL shape of `useAuth` — { user, isLoading, login,
// register, logout, refresh } — so the rest of the frontend can be built against
// it on day 1. On mount it just asks the backend who we are (GET /users/me). Against
// the backend's auth STUB that returns the dev user, so the app feels "logged
// in"; against real auth (task A-01) it becomes truly real with no changes here.
//
// login/register/logout call the real endpoints — those routes are empty until
// Lane A builds them, so they'll error for now. That's expected.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { api } from '../lib/api'
import type { User } from '../lib/types'

type AuthValue = {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setUser(await api.get<User>('/users/me'))
    } catch {
      setUser(null)
    }
  }, [])

  // Resolve the current user once on mount.
  useEffect(() => {
    let active = true
    api
      .get<User>('/users/me')
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.post<User>('/auth/login', { email, password }))
  }, [])

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      setUser(await api.post<User>('/auth/register', { email, username, password }))
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
