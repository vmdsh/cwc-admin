import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginAdmin } from '../lib/auth'
import { useAdminStore } from '../lib/store'

export function LoginPage() {
  const setAdminUser = useAdminStore(s => s.setAdminUser)
  const loadCaches   = useAdminStore(s => s.loadCaches)
  const navigate     = useNavigate()

  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !pass) { setError('Please fill in all fields'); return }
    setLoading(true)
    setError('')
    try {
      const user = await loginAdmin(email, pass)
      setAdminUser(user)
      loadCaches()
      navigate('/dashboard', { replace: true })   // ← Bug 2 fix: redirect after login
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', width: '100%', maxWidth: 400, padding: '2.5rem' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem' }}>
          <div style={{ width: 40, height: 40, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: '1.2rem', color: 'var(--bg)' }}>C</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.1rem', fontWeight: 900 }}>CoworkClub</div>
        </div>

        <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '1.5rem' }}>Admin Panel</div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '.5rem' }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? <><span className="spinner" />Signing in…</> : 'Sign In'}
        </button>

        {error && <div className="msg err" style={{ marginTop: '.75rem' }}>{error}</div>}

      </div>
    </div>
  )
}
