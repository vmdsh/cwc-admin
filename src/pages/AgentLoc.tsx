import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import type { AgentLocation } from '../types/database'

// ── helpers ───────────────────────────────────────────────────────────────────
const toDateStr = (d: Date) => d.toISOString().slice(0, 10) // 'YYYY-MM-DD'
const today     = toDateStr(new Date())

export function AgentLoc() {
  const {
    adminUser, isSuperAdmin,
    clubOpts, userOpts, movementOpts,   // <-- need these from store
    userName, movementLabel,
    loadDeliveryCaches,
  } = useAdminStore()

  // ── filter state ─────────────────────────────────────────────────────────
  const [filterClub,     setFilterClub]     = useState<string>(
    isSuperAdmin ? '' : (adminUser?.club_id ?? '')
  )
  const [filterDriver,   setFilterDriver]   = useState<string>('')
  const [filterMovement, setFilterMovement] = useState<string>('')
  const [filterFrom,     setFilterFrom]     = useState<string>(today)
  const [filterTo,       setFilterTo]       = useState<string>(today)

  // ── data state ────────────────────────────────────────────────────────────
  const [rows,    setRows]    = useState<AgentLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [ts,      setTs]      = useState(new Date())

  // ── load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    await loadDeliveryCaches()

    let q = supabase.from('agent_locations').select('*')

    // Club filter
    if (!isSuperAdmin && adminUser?.club_id) {
      q = q.eq('club_id', adminUser.club_id)
    } else if (isSuperAdmin && filterClub) {
      q = q.eq('club_id', filterClub)
    }

    // Agent / driver filter
    if (filterDriver) q = q.eq('driver_id', filterDriver)

    // Movement filter (optional)
    if (filterMovement) q = q.eq('movement_id', filterMovement)

    // Date range on updated_at
    // From: start of the selected day (00:00:00 local → ISO)
    // To:   end of the selected day   (23:59:59 local → ISO)
    if (filterFrom) q = q.gte('updated_at', `${filterFrom}T00:00:00`)
    if (filterTo)   q = q.lte('updated_at', `${filterTo}T23:59:59`)

    const { data } = await q.order('updated_at', { ascending: false })
    setRows(data || [])
    setTs(new Date())
    setLoading(false)
  }

  // Re-load whenever any filter changes
  useEffect(() => { load() }, [filterClub, filterDriver, filterMovement, filterFrom, filterTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── derived option lists ──────────────────────────────────────────────────
  const clubOptions     = clubOpts()
  const driverOptions   = userOpts(filterClub || adminUser?.club_id || '')
  const movementOptions = movementOpts ? movementOpts() : []

  // shared filter-bar input style
  const selStyle: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '.32rem .65rem',
    fontSize: '.82rem', borderRadius: 5, minWidth: 150,
  }
  const dateStyle: React.CSSProperties = { ...selStyle, minWidth: 130 }
  const labelStyle: React.CSSProperties = {
    fontSize: '.68rem', fontWeight: 700, letterSpacing: '.09em',
    textTransform: 'uppercase', color: 'var(--text3)',
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">Agent Locations</div>
          <div className="section-sub">
            Live GPS · read-only · {rows.length} record{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      {/* ── Info bar ── */}
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        padding: '.75rem 1rem', marginBottom: '1rem',
        fontSize: '.78rem', color: 'var(--text2)',
        display: 'flex', alignItems: 'center', gap: '.5rem',
      }}>
        📡 Updated by Flutter app —{' '}
        <strong style={{ color: 'var(--text)' }}>read-only</strong> · Last:{' '}
        <strong style={{ color: 'var(--accent)' }}>{ts.toLocaleTimeString()}</strong>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '.75rem',
        alignItems: 'flex-end', marginBottom: '1.2rem',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '.85rem 1rem',
      }}>

        {/* Club — superadmin only */}
        {isSuperAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Club</span>
            <select
              value={filterClub}
              onChange={e => { setFilterClub(e.target.value); setFilterDriver('') }}
              style={{ ...selStyle, minWidth: 180 }}
            >
              <option value="">— All Clubs —</option>
              {clubOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Agent / Driver */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Agent</span>
          <select
            value={filterDriver}
            onChange={e => setFilterDriver(e.target.value)}
            style={{ ...selStyle, minWidth: 180 }}
          >
            <option value="">— All Agents —</option>
            {driverOptions.map((o: { value: string; label: string }) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Movement — optional */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>Movement</span>
          <select
            value={filterMovement}
            onChange={e => setFilterMovement(e.target.value)}
            style={selStyle}
          >
            <option value="">— All —</option>
            {movementOptions.map((o: { value: string; label: string }) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* From date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>From</span>
          <input
            type="date"
            value={filterFrom}
            max={filterTo || today}
            onChange={e => setFilterFrom(e.target.value)}
            style={dateStyle}
          />
        </div>

        {/* To date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={labelStyle}>To</span>
          <input
            type="date"
            value={filterTo}
            min={filterFrom}
            max={today}
            onChange={e => setFilterTo(e.target.value)}
            style={dateStyle}
          />
        </div>

        {/* Clear filters */}
        {(filterDriver || filterMovement || filterFrom !== today || filterTo !== today || (isSuperAdmin && filterClub)) && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => {
              setFilterClub(isSuperAdmin ? '' : (adminUser?.club_id ?? ''))
              setFilterDriver('')
              setFilterMovement('')
              setFilterFrom(today)
              setFilterTo(today)
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {loading
        ? <div className="empty"><span className="spinner" />Loading…</div>
        : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Club</th>
                  <th>Movement</th>
                  <th>Lat</th>
                  <th>Lng</th>
                  <th>Online</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>
                        No agent data for the selected filters.
                      </td>
                    </tr>
                  )
                  : rows.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {userName(r.driver_id)}
                      </td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text2)' }}>
                        {r.club_id || '—'}
                      </td>
                      <td style={{ fontSize: '.78rem' }}>
                        {movementLabel(r.movement_id)}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.75rem', color: 'var(--text3)' }}>
                        {r.lat ?? '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.75rem', color: 'var(--text3)' }}>
                        {r.lng ?? '—'}
                      </td>
                      <td>
                        {r.is_online
                          ? <span className="badge badge-active">● Online</span>
                          : <span className="badge badge-inactive">○ Offline</span>
                        }
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '.72rem' }}>
                        {r.updated_at
                          ? new Date(r.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}
