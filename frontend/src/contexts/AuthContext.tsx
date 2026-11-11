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

  // `/auth/session` answers 200 with null when nobody is signed in, so probing
  // it on public pages doesn't log a failed request in the browser console.
  const refresh = useCallback(async () => {
    try {
      const currentUser = await api.get<User | null>('/auth/session')
      setUser(currentUser)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let active = true

    api
      .get<User | null>('/auth/session')
      .then((currentUser) => {
        if (active) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (active) {
          setUser(null)
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const currentUser = await api.post<User>('/auth/login', {
      email,
      password,
    })

    setUser(currentUser)
  }, [])

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const currentUser = await api.post<User>('/auth/register', {
        email,
        username,
        password,
      })

      setUser(currentUser)
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
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return ctx
}
