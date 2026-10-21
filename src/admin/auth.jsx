// Session state. `can()` only decides what to SHOW; the server re-checks every request.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, onSessionExpired } from './api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, expired: false })

  const refresh = useCallback(async () => {
    try { setState({ loading: false, user: (await api('/auth/me')).user, expired: false }) } catch { setState({ loading: false, user: null, expired: false }) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => onSessionExpired(() => setState((s) => (s.user ? { loading: false, user: null, expired: true } : s))), [])

  const value = useMemo(() => ({
    ...state,
    refresh,
    can: (perm) => !!state.user?.permissions.includes(perm),
    signIn: async (email, password) => { setState({ loading: false, user: (await api('/auth/login', { method: 'POST', body: { email, password } })).user, expired: false }) },
    signOut: async () => { try { await api('/auth/logout', { method: 'POST' }) } finally { setState({ loading: false, user: null, expired: false }) } },
  }), [state, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
