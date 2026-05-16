import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { RouteWaypoint } from '../types/database'

declare const L: any // Leaflet — injected via CDN

const E: Partial<RouteWaypoint> = { route_id: '', club_id: '', way_name: '', sequence: 1, lat: 0, lng: 0 }

// ── MapPicker ─────────────────────────────────────────────────────────────────
function MapPicker({ lat, lng, clubLat, clubLng, clubGeoFence, onPick }: { lat?: number | null, lng?: number | null, clubLat?: number | null, clubLng?: number | null, clubGeoFence?: number | null, onPick: (lat: number, lng: number) => void }) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markerRef   = useRef<any>(null)
  const circleRef   = useRef<any>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true); setSearchErr('')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data && data.length > 0) {
        const first = data[0]
        const sLat = parseFloat(first.lat)
        const sLng = parseFloat(first.lon)
        onPick(parseFloat(sLat.toFixed(7)), parseFloat(sLng.toFixed(7)))
        if (mapInstance.current) {
          mapInstance.current.setView([sLat, sLng], 18)
        }
      } else {
        setSearchErr('Location not found')
      }
    } catch (err: any) {
      setSearchErr('Search failed: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return

    const initLat = lat ?? clubLat ?? 20.5937
    const initLng = lng ?? clubLng ?? 78.9629
    const zoom    = (lat != null || clubLat != null) ? 18 : 5

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([initLat, initLng], zoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current)

      mapInstance.current.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng
        onPick(parseFloat(clickLat.toFixed(7)), parseFloat(clickLng.toFixed(7)))
        mapInstance.current.setView([clickLat, clickLng], 18)
      })
    }

    // 1. Handle Club Geo Fence Circle
    if (clubLat != null && clubLng != null) {
      const radius = clubGeoFence != null && clubGeoFence > 0 ? clubGeoFence : 10000
      if (circleRef.current) {
        circleRef.current.setLatLng([clubLat, clubLng])
        circleRef.current.setRadius(radius)
      } else {
        circleRef.current = L.circle([clubLat, clubLng], {
          color: '#fbbf24',
          fillColor: '#fbbf24',
          fillOpacity: 0.08,
          weight: 2,
          dashArray: '5, 5'
        }).addTo(mapInstance.current)
      }
    } else if (circleRef.current) {
      circleRef.current.remove()
      circleRef.current = null
    }

    // 2. Handle Waypoint Marker Marker & View
    if (lat != null && lng != null) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current)
      }
      mapInstance.current.setView([lat, lng], 18)
    } else if (clubLat != null && clubLng != null) {
      mapInstance.current.setView([clubLat, clubLng], 18)
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [lat, lng, clubLat, clubLng, clubGeoFence])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 4, marginBottom: 12 }}>
      <div style={{ background: 'var(--bg2)', padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>📍 Click on the map to set location {lat != null && lng != null ? ` · ${lat.toFixed(5)}, ${lng.toFixed(5)}` : ' · No pin yet'}</span>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>🔍 Zoom Level: 18 (Street Map)</span>
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Search location (e.g. Thavakkara, Kannur)…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
          />
          <button type="submit" disabled={searching} className="btn btn-primary btn-sm" style={{ padding: '6px 14px', fontSize: '12px', height: 'auto' }}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchErr && <div style={{ fontSize: 11, color: '#ef4444' }}>{searchErr}</div>}
      </div>
      <div ref={mapRef} style={{ height: 320, width: '100%' }} />
    </div>
  )
}

export function Waypoints() {
  const { adminUser, isSuperAdmin, clubs, clubOpts, clubName, routes, routeName, loadDeliveryCaches } = useAdminStore()
  
  const [filterClub, setFilterClub] = useState<string>(isSuperAdmin ? '' : (adminUser?.club_id ?? ''))
  const [filterRoute, setFilterRoute] = useState<string>('')
  
  const [rows, setRows] = useState<RouteWaypoint[]>([])
  const [loading, setLoading] = useState(true)
  
  const [form, setForm] = useState<Partial<RouteWaypoint>>(E)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [del, setDel] = useState<RouteWaypoint | null>(null)

  const clubOptions = clubOpts()
  const hasSetDefault = useRef(false)

  useEffect(() => {
    if (isSuperAdmin && !filterClub && clubOptions.length > 0 && !hasSetDefault.current) {
      setFilterClub(clubOptions[0].value)
      hasSetDefault.current = true
    }
  }, [isSuperAdmin, filterClub, clubOptions])

  const handleFilterClub = (clubId: string) => {
    setFilterClub(clubId)
    setFilterRoute('')
  }

  const getRouteOptions = (clubId?: string) => {
    const list = clubId ? routes.filter(r => r.club_id === clubId) : routes
    return list.map(r => ({ value: r.route_id, label: r.route_name }))
  }

  const load = async () => {
    setLoading(true)
    await loadDeliveryCaches()
    const currentRoutes = useAdminStore.getState().routes
    const { data } = await supabase.from('route_waypoints').select('*').order('sequence')
    const all = data || []

    const targetClub = isSuperAdmin ? filterClub : adminUser?.club_id
    const filtered = all.filter(wp => {
      const wpClub = wp.club_id || currentRoutes.find(r => r.route_id === wp.route_id)?.club_id
      if (targetClub && wpClub !== targetClub) return false
      if (filterRoute && wp.route_id !== filterRoute) return false
      return true
    })

    setRows(filtered)
    setLoading(false)
  }

  useEffect(() => { load() }, [filterClub, filterRoute])

  const handleFormClubChange = (clubId: string) => {
    setForm(f => ({ ...f, club_id: clubId, route_id: '' }))
  }

  const openAdd = () => {
    const defaultClub = isSuperAdmin ? (filterClub || '') : (adminUser?.club_id || '')
    setForm({ ...E, club_id: defaultClub, route_id: filterRoute || '' })
    setEditing(false); setOpen(true); setShowMap(false); setErr(''); setMsg('')
  }

  const openEdit = (r: RouteWaypoint) => {
    const wpClub = r.club_id || routes.find(rt => rt.route_id === r.route_id)?.club_id || ''
    setForm({ ...r, club_id: wpClub })
    setEditing(true); setOpen(true); setShowMap(!!(r.lat && r.lng)); setErr(''); setMsg('')
  }

  const setLatLng = (lat: number, lng: number) => setForm(f => ({ ...f, lat, lng }))

  const save = async () => {
    if (!form.club_id || !form.route_id || !form.way_name || !form.sequence) {
      setErr('Club, Route, Name and Sequence required')
      return
    }
    setMsg('Saving…'); setErr('')
    const p = {
      club_id: form.club_id!,
      route_id: form.route_id!,
      way_name: form.way_name!,
      sequence: form.sequence!,
      lat: form.lat || 0,
      lng: form.lng || 0
    }
    const { error } = editing && form.way_id
      ? await supabase.from('route_waypoints').update(p).eq('way_id', form.way_id)
      : await supabase.from('route_waypoints').insert(p)

    if (error) { setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }

  const doDelete = async () => {
    if (!del) return
    await supabase.from('route_waypoints').delete().eq('way_id', del.way_id)
    setDel(null); load()
  }

  const activeClubObj = clubs.find(c => c.club_id === form.club_id)

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Route Waypoints</div><div className="section-sub">Stops per route</div></div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Waypoint</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Club</span>
            <select value={filterClub} onChange={e => handleFilterClub(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.82rem', minWidth: 180 }}>
              <option value="">— All Clubs —</option>
              {clubOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Route</span>
          <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.82rem', minWidth: 180 }}>
            <option value="">— All Routes —</option>
            {getRouteOptions(isSuperAdmin ? filterClub : adminUser?.club_id).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {(filterRoute || (isSuperAdmin && filterClub)) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterRoute(''); if (isSuperAdmin) setFilterClub(''); }}>
            ✕ Clear
          </button>
        )}
      </div>

      {open && <div className="form-panel open">
        <div className="form-panel-title">✏️ {editing ? 'Edit' : 'Add'} Waypoint</div>
        <div className="form-row">
          <div className="form-group">
            <label>Club</label>
            {isSuperAdmin
              ? <Select value={form.club_id || ''} onChange={v => handleFormClubChange(v)} options={clubOptions} placeholder="— Select Club —" />
              : <input value={clubName(adminUser?.club_id)} readOnly style={{ opacity: .7, cursor: 'not-allowed' }} />
            }
          </div>
          <div className="form-group">
            <label>Route</label>
            <Select value={form.route_id || ''} onChange={v => setForm(f => ({ ...f, route_id: v }))} options={getRouteOptions(form.club_id)} placeholder="— Select Route —" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Waypoint Name</label><input value={form.way_name || ''} onChange={e => setForm(f => ({ ...f, way_name: e.target.value }))} placeholder="e.g. Thavakkara Junction" /></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>Sequence #</label><input type="number" value={form.sequence || ''} onChange={e => setForm(f => ({ ...f, sequence: parseInt(e.target.value) }))} min="1" /></div>
          <div className="form-group"><label>Latitude</label><input type="number" step="any" value={form.lat ?? ''} onChange={e => setForm(f => ({ ...f, lat: e.target.value === '' ? undefined : parseFloat(e.target.value) }))} placeholder="11.8745" /></div>
          <div className="form-group"><label>Longitude</label><input type="number" step="any" value={form.lng ?? ''} onChange={e => setForm(f => ({ ...f, lng: e.target.value === '' ? undefined : parseFloat(e.target.value) }))} placeholder="75.3704" /></div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 10 }} onClick={() => setShowMap(s => !s)}>{showMap ? '🗺️ Hide Map' : '🗺️ Pick on Map'}</button>
        {showMap && <MapPicker lat={form.lat} lng={form.lng} clubLat={activeClubObj?.lat} clubLng={activeClubObj?.lng} clubGeoFence={activeClubObj?.geo_fence} onPick={setLatLng} />}
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          {err && <span className="msg err">{err}</span>}{msg && <span className="msg">{msg}</span>}
        </div>
      </div>}

      {loading ? <div className="empty"><span className="spinner" />Loading…</div> : (
        <div className="tbl-wrap"><table>
          <thead><tr><th>Seq</th><th>Waypoint Name</th><th>Club</th><th>Route</th><th>Lat</th><th>Lng</th><th>Actions</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>No waypoints.</td></tr>
            : rows.map(r => <tr key={r.way_id}>
              <td style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--accent)', textAlign: 'center', width: 48 }}>{r.sequence}</td>
              <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.way_name}</td>
              <td>{clubName(r.club_id || routes.find(rt => rt.route_id === r.route_id)?.club_id)}</td>
              <td>{routeName(r.route_id)}</td>
              <td style={{ fontFamily: 'monospace', fontSize: '.75rem', color: 'var(--text3)' }}>{r.lat}</td>
              <td style={{ fontFamily: 'monospace', fontSize: '.75rem', color: 'var(--text3)' }}>{r.lng}</td>
              <td className="td-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => setDel(r)}>Delete</button>
              </td>
            </tr>)}</tbody>
        </table></div>
      )}
      {del && <ConfirmDialog message={`Delete waypoint "${del.way_name}"?`} onConfirm={doDelete} onCancel={() => setDel(null)} />}
    </div>
  )
}
