import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'

interface DashStats {
  products: number
  shops: number
  routes: number
  movements: number   // scheduled movements
  bookings: number    // pending bookings
}

const EMPTY: DashStats = { products:0, shops:0, routes:0, movements:0, bookings:0 }

export function Dashboard() {
  const { adminUser, isSuperAdmin, clubs, clubOpts, clubName } = useAdminStore()

  // superadmin: '' = all clubs; clubadmin: locked to their club_id
  const [selectedClub, setSelectedClub] = useState<string>(
    isSuperAdmin ? '' : (adminUser?.club_id ?? '')
  )

  const [stats,   setStats]   = useState<DashStats>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [recentBookings, setRecentBookings] = useState<any[]>([])

  // Load stats whenever selectedClub changes
  useEffect(() => {
    loadStats(selectedClub)
  }, [selectedClub])

  async function loadStats(clubId: string) {
    setLoading(true)
    try {
      // Helper: apply club filter only when clubId is set
      const cf = clubId ? { club_id: clubId } : {}

      const [
        { data: prods },
        { data: shps },
        { data: rts },
        { data: mvs },
        { data: bks },
      ] = await Promise.all([
        supabase.from('products').select('product_id').match(cf),
        supabase.from('shops').select('shop_id').match(cf),
        supabase.from('routes').select('route_id').match(cf),
        supabase.from('route_movements').select('movement_id, status').match(cf),
        supabase.from('route_bookings').select('booking_id, status, customer_id, created_at').match(cf),
      ])

      setStats({
        products:  (prods  || []).length,
        shops:     (shps   || []).length,
        routes:    (rts    || []).length,
        movements: (mvs    || []).filter((m: any) => m.status === 'scheduled').length,
        bookings:  (bks    || []).filter((b: any) => b.status === 'pending').length,
      })

      // Recent 5 bookings for the panel
      setRecentBookings((bks || []).slice(0, 5))
    } catch (e) {
      console.warn('dashboard stats:', e)
    } finally {
      setLoading(false)
    }
  }

  const statCards: [string, number, string][] = [
    ['Products',         stats.products,  '📦'],
    ['Shops',            stats.shops,     '🏪'],
    ['Routes',           stats.routes,    '🗺️'],
    ['Scheduled Trips',  stats.movements, '🚚'],
    ['Pending Bookings', stats.bookings,  '🕐'],
  ]

  const opts = clubOpts()

  return (
    <div>
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">Dashboard</div>
          <div className="section-sub">Live overview</div>
        </div>
      </div>

      {/* ── Club Selector / Label ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>
          Club
        </span>

        {isSuperAdmin ? (
          /* Superadmin — selectable combo */
          <select
            value={selectedClub}
            onChange={e => setSelectedClub(e.target.value)}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '.35rem .75rem',
              fontSize: '.85rem',
              minWidth: 220,
              cursor: 'pointer',
            }}
          >
            <option value="">— All Clubs —</option>
            {opts.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          /* Clubadmin — read-only pill */
          <span style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            padding: '.3rem .85rem',
            fontSize: '.8rem',
            fontWeight: 700,
            letterSpacing: '.04em',
          }}>
            {clubName(adminUser?.club_id)}
          </span>
        )}

        {loading && <span className="spinner" style={{ marginLeft: '.5rem' }} />}
      </div>

      {/* ── Stat Cards ── */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        {statCards.map(([label, num, icon]) => (
          <div className="stat-card" key={label}>
            <div style={{ fontSize: '1.4rem', marginBottom: '.25rem' }}>{icon}</div>
            <div className="stat-num">{loading ? '…' : num}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Recent Bookings Panel ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.2rem', maxWidth: 560 }}>
        <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '.75rem' }}>
          Recent Bookings
          {selectedClub && !isSuperAdmin === false && (
            <span style={{ marginLeft: '.5rem', color: 'var(--accent)', textTransform: 'none', letterSpacing: 0 }}>
              — {clubName(selectedClub)}
            </span>
          )}
        </div>
        {recentBookings.length === 0
          ? <div style={{ color: 'var(--text3)', fontSize: '.78rem', padding: '.5rem 0' }}>No bookings yet</div>
          : recentBookings.map((b: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.78rem' }}>
              <span style={{ color: 'var(--text2)' }}>{b.customer_id ?? '—'}</span>
              <span className={`badge ${b.status === 'pending' ? 'badge-role' : b.status === 'delivered' ? 'badge-active' : 'badge-inactive'}`}>
                {b.status}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  )
}
