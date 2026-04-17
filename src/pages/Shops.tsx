import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImageUpload } from '../components/ImageUpload'
import { Select } from '../components/Select'
import type { Shop, ShopImage } from '../types/database'

// ── Leaflet injected via CDN (same as Clubs) ────────────────────────────────
declare const L: any

// ── Empty form state (includes new columns) ──────────────────────────────────
const EMPTY: Partial<Shop> = {
  shop_name: '', club_id: '', shop_type: 'physical',
  contact: '', address: '', description: '',
  shop_emoji: '', shop_tagline: '',
  lat: undefined, lng: undefined,
}

const EMPTY_IMG: Partial<ShopImage> = {
  shop_id: '', image_url: '', caption: '', sort_order: 0,
}

type Tab = 'details' | 'images'

// ── Reusable MapPicker (identical logic to Clubs) ────────────────────────────
function MapPicker({
  lat, lng, onPick,
}: {
  lat?: number | null
  lng?: number | null
  onPick: (lat: number, lng: number) => void

}) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markerRef   = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return
    const initLat = lat ?? 20.5937
    const initLng = lng ?? 78.9629
    const zoom    = lat ? 14 : 5

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([initLat, initLng], zoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstance.current)

      mapInstance.current.on('click', (e: any) => {
        const { lat: cLat, lng: cLng } = e.latlng
        onPick(parseFloat(cLat.toFixed(7)), parseFloat(cLng.toFixed(7)))
      })
    }

    if (lat && lng) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current)
      }
      mapInstance.current.setView([lat, lng], 14)
    }
  }, [lat, lng]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        background: 'var(--bg2)', padding: '4px 10px', fontSize: 11,
        color: 'var(--text3)', borderBottom: '1px solid var(--border)',
      }}>
        📍 Click on the map to set location
        {lat && lng ? ` · ${lat.toFixed(5)}, ${lng.toFixed(5)}` : ' · No pin yet'}
      </div>
      <div ref={mapRef} style={{ height: 280, width: '100%' }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function Shops() {
  const { adminUser, isSuperAdmin, clubOpts, loadCaches, clubName } = useAdminStore()

  // ── Club filter ──
  const clubOptions = clubOpts()
  const defaultClub = isSuperAdmin
    ? (clubOptions.length > 0 ? clubOptions[0].value : '')
    : (adminUser?.club_id ?? '')
  const [filterClub, setFilterClub] = useState<string>(defaultClub)

  // ── List ──
  const [rows,    setRows]    = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  // ── Form ──
  const [form,      setForm]      = useState<Partial<Shop>>(EMPTY)
  const [editing,   setEditing]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [err,  setErr]  = useState('')
  const [msg,  setMsg]  = useState('')
  const [delShop, setDelShop] = useState<Shop | null>(null)
  const [showMap, setShowMap] = useState(false)

  // ── Images ──
  const [images,     setImages]     = useState<ShopImage[]>([])
  const [imgLoading, setImgLoading] = useState(false)
  const [imgForm,    setImgForm]    = useState<Partial<ShopImage>>(EMPTY_IMG)
  const [imgEditing, setImgEditing] = useState(false)
  const [imgOpen,    setImgOpen]    = useState(false)
  const [imgErr,     setImgErr]     = useState('')
  const [imgMsg,     setImgMsg]     = useState('')
  const [delImg,     setDelImg]     = useState<ShopImage | null>(null)

  // ── Load shops ──
  const load = async () => {
    setLoading(true)
    let q = supabase.from('shops').select('*')
    if (!isSuperAdmin && adminUser?.club_id) q = q.eq('club_id', adminUser.club_id)
    else if (isSuperAdmin && filterClub)     q = q.eq('club_id', filterClub)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterClub]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load images ──
  const loadImages = async (shopId: string) => {
    setImgLoading(true)
    const { data } = await supabase
      .from('shop_images').select('*')
      .eq('shop_id', shopId).order('sort_order')
    setImages(data || [])
    setImgLoading(false)
  }

  // ── Open Add ──
  const openAdd = () => {
    setForm({ ...EMPTY, club_id: isSuperAdmin ? (filterClub || '') : adminUser?.club_id || '' })
    setEditing(false); setActiveTab('details')
    setOpen(true); setShowMap(false); setErr(''); setMsg('')
  }

  // ── Open Edit ──
  const openEdit = (r: Shop) => {
    setForm(r); setEditing(true); setActiveTab('details')
    setOpen(true); setErr(''); setMsg('')
    setShowMap(!!(r.lat && r.lng)) // auto-open map if coords already set
    loadImages(r.shop_id)
  }

  // ── Build WKT POINT for PostGIS ──
  const buildCoords = (lat?: number | null, lng?: number | null) =>
    lat != null && lng != null ? `POINT(${lng} ${lat})` : null

  // ── Save shop ──
  const save = async () => {
    if (!form.shop_name || !form.club_id) { setErr('Name and Club required'); return }
    setMsg('Saving…'); setErr('')
    const p = {
      shop_name:    form.shop_name!,
      club_id:      form.club_id!,
      shop_type:    form.shop_type    || 'physical',
      contact:      form.contact      || '',
      address:      form.address      || '',
      description:  form.description  || '',
      is_active:    true,
      // ── new columns ──
      shop_emoji:   form.shop_emoji   || '',
      shop_tagline: form.shop_tagline || '',
      lat:          form.lat          ?? null,
      lng:          form.lng          ?? null,
      coords:       buildCoords(form.lat, form.lng), // auto-derived
    }
    const { error } = editing && form.shop_id
      ? await supabase.from('shops').update(p).eq('shop_id', form.shop_id)
      : await supabase.from('shops').insert(p)
    if (error) { setErr(error.message); setMsg(''); return }
    await loadCaches(); setOpen(false); load()
  }

  // ── Delete shop ──
  const doDeleteShop = async () => {
    if (!delShop) return
    await supabase.from('shops').delete().eq('shop_id', delShop.shop_id)
    setDelShop(null); await loadCaches(); load()
  }

  // ── Image CRUD ──
  const openImgAdd = () => {
    setImgForm({ ...EMPTY_IMG, shop_id: form.shop_id || '' })
    setImgEditing(false); setImgOpen(true); setImgErr(''); setImgMsg('')
  }
  const openImgEdit = (img: ShopImage) => {
    setImgForm(img); setImgEditing(true); setImgOpen(true); setImgErr(''); setImgMsg('')
  }
  const saveImg = async () => {
    if (!imgForm.image_url) { setImgErr('Image is required'); return }
    setImgMsg('Saving…'); setImgErr('')
    const p = {
      shop_id:    form.shop_id!,
      image_url:  imgForm.image_url!,
      caption:    imgForm.caption    || '',
      sort_order: imgForm.sort_order || 0,
    }
    const { error } = imgEditing && imgForm.image_id
      ? await supabase.from('shop_images').update(p).eq('image_id', imgForm.image_id)
      : await supabase.from('shop_images').insert(p)
    if (error) { setImgErr(error.message); setImgMsg(''); return }
    setImgOpen(false); loadImages(form.shop_id!)
  }
  const doDeleteImg = async () => {
    if (!delImg) return
    await supabase.from('shop_images').delete().eq('image_id', delImg.image_id)
    setDelImg(null); loadImages(form.shop_id!)
  }

  const tabStyle = (t: Tab) => ({
    padding: '.45rem 1.1rem', fontSize: '.78rem', fontWeight: 700,
    letterSpacing: '.06em', textTransform: 'uppercase' as const,
    cursor: 'pointer', border: 'none',
    borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === t ? 'var(--accent)' : 'var(--text3)',
    transition: 'color .15s',
  })

  const typeLabel = (v?: string) =>
    v === 'physical' ? 'Physical' : v === 'onwheel' ? 'On the Wheel' : v === 'online' ? 'Online' : '—'

  return (
    <div>
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">Shops</div>
          <div className="section-sub">{rows.length} shops</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Shop</button>
      </div>

      {/* ── Club Filter (superadmin only) ── */}
      {isSuperAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Club</span>
          <select
            value={filterClub}
            onChange={e => setFilterClub(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.85rem', minWidth: 220 }}>
            <option value="">— All Clubs —</option>
            {clubOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {/* ── Form Panel ── */}
      {open && (
        <div className="form-panel open">
          {/* Tabs — edit mode only */}
          {editing && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
              <button style={tabStyle('details')} onClick={() => setActiveTab('details')}>📋 Details</button>
              <button style={tabStyle('images')}  onClick={() => setActiveTab('images')}>🖼️ Images</button>
            </div>
          )}
          {!editing && <div className="form-panel-title">✏️ Add Shop</div>}

          {/* ── DETAILS TAB ── */}
          {(activeTab === 'details' || !editing) && (
            <>
              {/* Row 1 — Name & Emoji */}
              <div className="form-row">
                <div className="form-group">
                  <label>Shop Name</label>
                  <input
                    value={form.shop_name || ''}
                    onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))}
                    placeholder="Shop name"
                  />
                </div>
                <div className="form-group" style={{ maxWidth: 140 }}>
                  <label>Emoji</label>
                  <input
                    value={form.shop_emoji || ''}
                    onChange={e => setForm(f => ({ ...f, shop_emoji: e.target.value }))}
                    placeholder="🛍️"
                  />
                </div>
              </div>

              {/* Tagline */}
              <div className="form-group">
                <label>Tagline</label>
                <input
                  value={form.shop_tagline || ''}
                  onChange={e => setForm(f => ({ ...f, shop_tagline: e.target.value }))}
                  placeholder="A short catchy tagline for the shop"
                />
              </div>

              {/* Row 2 — Club & Type */}
              <div className="form-row">
                <div className="form-group">
                  <label>Club</label>
                  {isSuperAdmin
                    ? <Select value={form.club_id || ''} onChange={v => setForm(f => ({ ...f, club_id: v }))} options={clubOptions} placeholder="— Select Club —" />
                    : <input value={clubName(adminUser?.club_id)} readOnly style={{ opacity: .7, cursor: 'not-allowed' }} />
                  }
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.shop_type || 'physical'} onChange={e => setForm(f => ({ ...f, shop_type: e.target.value as Shop['shop_type'] }))}>
                    <option value="physical">Physical</option>
                    <option value="onwheel">On the Wheel</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>

              {/* Row 3 — Contact & Address */}
              <div className="form-row">
                <div className="form-group">
                  <label>Contact</label>
                  <input
                    value={form.contact || ''}
                    onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                    placeholder="Phone / Email"
                  />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input
                    value={form.address || ''}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Full address"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* ── GEO SECTION ───────────────────────────────────────────── */}
              <div style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '14px 16px',
                marginTop: 8,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text2)',
                  letterSpacing: '.04em', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  🗺️ Location
                </div>

                {/* Lat / Lon manual inputs */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lat ?? ''}
                      placeholder="e.g. 11.8745"
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                        setForm(f => ({ ...f, lat: v }))
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.lng ?? ''}
                      placeholder="e.g. 75.3704"
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                        setForm(f => ({ ...f, lng: v }))
                      }}
                    />
                  </div>
                </div>

                {/* Toggle map */}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginBottom: 10 }}
                  onClick={() => setShowMap(s => !s)}
                >
                  {showMap ? '🗺️ Hide Map' : '🗺️ Pick on Map'}
                </button>

                {/* coords derived notice */}
                {(form.lat != null && form.lng != null) && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                    ✅ <strong>coords</strong> will be saved as{' '}
                    <code style={{ fontFamily: 'monospace' }}>POINT({form.lng} {form.lat})</code>
                  </div>
                )}

                {/* Map picker */}
                {showMap && (
                  <MapPicker
                    lat={form.lat}
                    lng={form.lng}
                    onPick={(lat, lng) => setForm(f => ({ ...f, lat, lng }))}
                  />
                )}
              </div>
              {/* ── END GEO SECTION ───────────────────────────────────────── */}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginTop: 14 }}>
                <button className="btn btn-primary" onClick={save}>Save</button>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                {err && <span className="msg err">{err}</span>}
                {msg && <span className="msg">{msg}</span>}
              </div>
            </>
          )}

          {/* ── IMAGES TAB ── */}
          {editing && activeTab === 'images' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
                  Images for <strong style={{ color: 'var(--text)' }}>{form.shop_name}</strong>
                </span>
                <button className="btn btn-primary btn-sm" onClick={openImgAdd}>+ Add Image</button>
              </div>

              {/* Image form */}
              {imgOpen && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '.75rem' }}>
                    {imgEditing ? 'Edit Image' : 'New Image'}
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <ImageUpload value={imgForm.image_url || ''} onChange={url => setImgForm(f => ({ ...f, image_url: url }))} folder="shops" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Caption</label>
                      <input value={imgForm.caption || ''} onChange={e => setImgForm(f => ({ ...f, caption: e.target.value }))} placeholder="Optional caption" />
                    </div>
                    <div className="form-group" style={{ maxWidth: 160 }}>
                      <label>Sort Order</label>
                      <input type="number" value={imgForm.sort_order ?? 0} onChange={e => setImgForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveImg}>Save Image</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setImgOpen(false)}>Cancel</button>
                    {imgErr && <span className="msg err">{imgErr}</span>}
                    {imgMsg && <span className="msg">{imgMsg}</span>}
                  </div>
                </div>
              )}

              {/* Image grid */}
              {imgLoading
                ? <div className="empty"><span className="spinner" />Loading images…</div>
                : images.length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: '.82rem', padding: '1.5rem 0', textAlign: 'center' }}>No images yet — click "+ Add Image" to upload one.</div>
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.75rem' }}>
                      {images.map(img => (
                        <div key={img.image_id} style={{ border: '1px solid var(--border)', background: 'var(--bg2)', overflow: 'hidden' }}>
                          <img src={img.image_url} alt={img.caption || ''} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '.5rem .6rem' }}>
                            <div style={{ fontSize: '.75rem', color: 'var(--text)', marginBottom: '.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.caption || '—'}</div>
                            <div style={{ fontSize: '.68rem', color: 'var(--text3)', marginBottom: '.5rem' }}>Sort: {img.sort_order ?? 0}</div>
                            <div style={{ display: 'flex', gap: '.4rem' }}>
                              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openImgEdit(img)}>Edit</button>
                              <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => setDelImg(img)}>Del</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
              }
              <div style={{ marginTop: '1.25rem' }}>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {loading
        ? <div className="empty"><span className="spinner" />Loading…</div>
        : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Emoji</th>
                  <th>Name</th>
                  <th>Tagline</th>
                  <th>Club</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>No shops yet.</td></tr>
                  : rows.map(r => (
                    <tr key={r.shop_id}>
                      <td style={{ fontSize: 20 }}>{r.shop_emoji || '—'}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.shop_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.shop_tagline || '—'}
                      </td>
                      <td>{clubName(r.club_id)}</td>
                      <td><span className="badge badge-role">{typeLabel(r.shop_type)}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace' }}>
                        {r.lat != null && r.lng != null
                          ? `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelShop(r)}>Delete</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )
      }

      {delShop && <ConfirmDialog message={`Delete "${delShop.shop_name}"?`} onConfirm={doDeleteShop} onCancel={() => setDelShop(null)} />}
      {delImg  && <ConfirmDialog message="Delete this image?" onConfirm={doDeleteImg} onCancel={() => setDelImg(null)} />}
    </div>
  )
}
