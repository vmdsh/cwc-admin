import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImageUpload } from '../components/ImageUpload'
import type { Club, ClubImage } from '../types/database'

// ── CDN injections (add to index.html if not present) ────────────────────────
// Leaflet:
//   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
//   <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
// Quill:
//   <link rel="stylesheet" href="https://cdn.quilljs.com/1.3.7/quill.snow.css"/>
//   <script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
declare const L: any     // Leaflet — injected via CDN
declare const Quill: any // Quill   — injected via CDN

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = 'details' | 'content' | 'images'

// ── Empty form state ──────────────────────────────────────────────────────────
const E: Partial<Club> = {
  club_name:     '',
  flag_emoji:    '',
  status:        'active',
  country:       '',
  description:   '',
  lat:           undefined,
  lng:           undefined,
  geo_fence:     10000,
  alert_start:   30,
  alert_reach:   50,
  about_html:    '',
  mission_html:  '',
  vision_html:   '',
  contact_email: '',
  contact_phone: '',
}

const EMPTY_IMG: Partial<ClubImage> = {
  club_id: '', image_url: '', caption: '', sort_order: 0,
}

// ── MapPicker ─────────────────────────────────────────────────────────────────
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
    const zoom    = lat ? 13 : 5

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([initLat, initLng], zoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstance.current)

      mapInstance.current.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng
        onPick(parseFloat(clickLat.toFixed(7)), parseFloat(clickLng.toFixed(7)))
      })
    }

    if (lat && lng) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current)
      }
      mapInstance.current.setView([lat, lng], 13)
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

// ── QuillEditor ───────────────────────────────────────────────────────────────
// Wraps a Quill WYSIWYG instance. Calls onChange with the HTML string on every
// keystroke. Syncs externally if the parent resets the value (e.g. openAdd).
function QuillEditor({
  value,
  onChange,
  placeholder,
  minHeight,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const quillRef     = useRef<any>(null)
  const internalRef  = useRef<string>(value) // avoids cursor reset on re-render

  // ── Init once ──
  useEffect(() => {
    if (!containerRef.current || typeof Quill === 'undefined') return
    if (quillRef.current) return

    quillRef.current = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder: placeholder ?? 'Enter content…',
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean'],
        ],
      },
    })

    // Apply minHeight to the inner .ql-editor Quill creates
    if (minHeight) {
      const qlEditor = containerRef.current.querySelector('.ql-editor') as HTMLElement | null
      if (qlEditor) qlEditor.style.minHeight = `${minHeight}px`
    }

    if (value) {
      quillRef.current.clipboard.dangerouslyPasteHTML(value)
    }

    quillRef.current.on('text-change', () => {
      const html = quillRef.current.root.innerHTML
      internalRef.current = html
      onChange(html)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync when parent resets (e.g. openAdd clears the form) ──
  useEffect(() => {
    if (!quillRef.current) return
    if (value !== internalRef.current) {
      quillRef.current.clipboard.dangerouslyPasteHTML(value || '')
      internalRef.current = value
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      style={{ background: 'var(--bg)', borderRadius: 6 }}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function Clubs() {
  const { isSuperAdmin, loadCaches } = useAdminStore()

  // ── Club list ──
  const [rows,    setRows]    = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  // ── Club form ──
  const [form,      setForm]      = useState<Partial<Club>>(E)
  const [editing,   setEditing]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [err,  setErr]  = useState('')
  const [msg,  setMsg]  = useState('')
  const [del,  setDel]  = useState<Club | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // ── Images ──
  const [images,     setImages]     = useState<ClubImage[]>([])
  const [imgLoading, setImgLoading] = useState(false)
  const [imgForm,    setImgForm]    = useState<Partial<ClubImage>>(EMPTY_IMG)
  const [imgEditing, setImgEditing] = useState(false)
  const [imgOpen,    setImgOpen]    = useState(false)
  const [imgErr,     setImgErr]     = useState('')
  const [imgMsg,     setImgMsg]     = useState('')
  const [delImg,     setDelImg]     = useState<ClubImage | null>(null)

  // ── Load clubs ──
  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('clubs').select('*')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Load images for a club ──
  const loadImages = async (clubId: string) => {
    setImgLoading(true)
    const { data } = await supabase
      .from('club_images').select('*')
      .eq('club_id', clubId).order('sort_order')
    setImages(data || [])
    setImgLoading(false)
  }

  // ── Open Add ──
  const openAdd = () => {
    setForm(E)
    setEditing(false)
    setActiveTab('details')
    setOpen(true)
    setShowMap(false)
    setErr('')
    setMsg('')
  }

  // ── Open Edit ──
  const openEdit = (r: Club) => {
    setForm(r)
    setEditing(true)
    setActiveTab('details')
    setOpen(true)
    setShowMap(!!(r.lat && r.lng))
    setErr('')
    setMsg('')
    loadImages(r.club_id)
  }

  // ── Build WKT POINT for PostGIS ──
  const buildCoords = (lat?: number | null, lng?: number | null) =>
    lat != null && lng != null ? `POINT(${lng} ${lat})` : null

  // ── Save club ──
  const save = async () => {
    if (!form.club_name) { setErr('Name required'); return }
    setMsg('Saving…'); setErr('')

    const p = {
      club_name:     form.club_name!,
      flag_emoji:    form.flag_emoji    || '',
      status:        form.status        || 'active',
      country:       form.country       || '',
      description:   form.description   || '',
      // geo
      lat:           form.lat           ?? null,
      lng:           form.lng           ?? null,
      coords:        buildCoords(form.lat, form.lng),
      geo_fence:     form.geo_fence     ?? 10000,
      alert_start:   form.alert_start   ?? 30,
      alert_reach:   form.alert_reach   ?? 50,
      // content
      about_html:    form.about_html    || '',
      mission_html:  form.mission_html  || '',
      vision_html:   form.vision_html   || '',
      // contact
      contact_email: form.contact_email || '',
      contact_phone: form.contact_phone || '',
    }

    const { error } =
      editing && form.club_id
        ? await supabase.from('clubs').update(p).eq('club_id', form.club_id)
        : await supabase.from('clubs').insert(p)

    if (error) { setErr(error.message); setMsg(''); return }
    await loadCaches()
    setOpen(false)
    load()
  }

  // ── Delete club ──
  const doDelete = async () => {
    if (!del) return
    await supabase.from('clubs').delete().eq('club_id', del.club_id)
    setDel(null)
    await loadCaches()
    load()
  }

  // ── Image CRUD ──
  const openImgAdd = () => {
    setImgForm({ ...EMPTY_IMG, club_id: form.club_id || '' })
    setImgEditing(false); setImgOpen(true); setImgErr(''); setImgMsg('')
  }
  const openImgEdit = (img: ClubImage) => {
    setImgForm(img); setImgEditing(true); setImgOpen(true); setImgErr(''); setImgMsg('')
  }
  const saveImg = async () => {
    if (!imgForm.image_url) { setImgErr('Image is required'); return }
    setImgMsg('Saving…'); setImgErr('')
    const p = {
      club_id:    form.club_id!,
      image_url:  imgForm.image_url!,
      caption:    imgForm.caption    || '',
      sort_order: imgForm.sort_order || 0,
    }
    const { error } = imgEditing && imgForm.image_id
      ? await supabase.from('club_images').update(p).eq('image_id', imgForm.image_id)
      : await supabase.from('club_images').insert(p)
    if (error) { setImgErr(error.message); setImgMsg(''); return }
    setImgOpen(false); loadImages(form.club_id!)
  }
  const doDeleteImg = async () => {
    if (!delImg) return
    await supabase.from('club_images').delete().eq('image_id', delImg.image_id)
    setDelImg(null); loadImages(form.club_id!)
  }

  const setLatLng = (lat: number, lng: number) =>
    setForm(f => ({ ...f, lat, lng }))

  const numField = (
    label: string,
    key: keyof Club,
    unit: string,
    placeholder: string,
    defaultVal: number,
  ) => (
    <div className="form-group">
      <label>
        {label}
        <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 4, fontSize: 11 }}>
          ({unit})
        </span>
      </label>
      <input
        type="number"
        min={0}
        value={form[key] as number ?? defaultVal}
        placeholder={placeholder}
        onChange={e => setForm(f => ({
          ...f,
          [key]: e.target.value === '' ? defaultVal : parseInt(e.target.value, 10),
        }))}
      />
    </div>
  )

  const tabStyle = (t: Tab) => ({
    padding: '.45rem 1.1rem', fontSize: '.78rem', fontWeight: 700,
    letterSpacing: '.06em', textTransform: 'uppercase' as const,
    cursor: 'pointer', border: 'none',
    borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === t ? 'var(--accent)' : 'var(--text3)',
    transition: 'color .15s',
  })

  return (
    <div>
      {/* ── Header ── */}
      <div className="section-header">
        <div>
          <div className="section-title">Clubs</div>
          <div className="section-sub">{rows.length} clubs</div>
        </div>
        {isSuperAdmin && (
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Club</button>
        )}
      </div>

      {/* ── Form Panel ── */}
      {open && (
        <div className="form-panel open">

          {/* Tabs — edit mode only */}
          {editing && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
              <button style={tabStyle('details')} onClick={() => setActiveTab('details')}>📋 Details</button>
              <button style={tabStyle('content')} onClick={() => setActiveTab('content')}>📝 Content</button>
              <button style={tabStyle('images')}  onClick={() => setActiveTab('images')}>🖼️ Images</button>
            </div>
          )}
          {!editing && <div className="form-panel-title">✏️ Add Club</div>}

          {/* ── DETAILS TAB ── */}
          {(activeTab === 'details' || !editing) && (
            <>
              {/* Row 1 — Name & Flag */}
              <div className="form-row">
                <div className="form-group">
                  <label>Club Name</label>
                  <input
                    value={form.club_name || ''}
                    onChange={e => setForm(f => ({ ...f, club_name: e.target.value }))}
                    placeholder="e.g. Aryaprabha CoworkClub"
                  />
                </div>
                <div className="form-group" style={{ maxWidth: 140 }}>
                  <label>Flag Emoji</label>
                  <input
                    value={form.flag_emoji || ''}
                    onChange={e => setForm(f => ({ ...f, flag_emoji: e.target.value }))}
                    placeholder="🇮🇳"
                  />
                </div>
              </div>

              {/* Row 2 — Status & Country */}
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={form.status || 'active'}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Club['status'] }))}
                  >
                    <option value="active">Active</option>
                    <option value="launching">Launching</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input
                    value={form.country || ''}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                    placeholder="India"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* ── Contact section ── */}
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '14px 16px', marginTop: 8,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text2)',
                  letterSpacing: '.04em', marginBottom: 12,
                }}>
                  📞 Contact
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={form.contact_email || ''}
                      onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                      placeholder="hello@club.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={form.contact_phone || ''}
                      onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              </div>

              {/* ── GEO SECTION ── */}
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '14px 16px', marginTop: 8,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text2)',
                  letterSpacing: '.04em', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  🗺️ Location &amp; Geo Settings
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude</label>
                    <input
                      type="number" step="any"
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
                      type="number" step="any"
                      value={form.lng ?? ''}
                      placeholder="e.g. 75.3704"
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                        setForm(f => ({ ...f, lng: v }))
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginBottom: 10 }}
                  onClick={() => setShowMap(s => !s)}
                >
                  {showMap ? '🗺️ Hide Map' : '🗺️ Pick on Map'}
                </button>

                {(form.lat != null && form.lng != null) && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                    ✅ <strong>coords</strong> will be saved as{' '}
                    <code style={{ fontFamily: 'monospace' }}>POINT({form.lng} {form.lat})</code>
                  </div>
                )}

                {showMap && (
                  <MapPicker lat={form.lat} lng={form.lng} onPick={setLatLng} />
                )}

                <div className="form-row" style={{ marginTop: 12 }}>
                  {numField('Geo Fence',   'geo_fence',   'meters',  '10000', 10000)}
                  {numField('Alert Start', 'alert_start', 'minutes', '30',    30)}
                  {numField('Alert Reach', 'alert_reach', 'meters',  '50',    50)}
                </div>
              </div>
              {/* ── END GEO SECTION ── */}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginTop: 14 }}>
                <button className="btn btn-primary" onClick={save}>Save</button>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                {err && <span className="msg err">{err}</span>}
                {msg && <span className="msg">{msg}</span>}
              </div>
            </>
          )}

          {/* ── CONTENT TAB (edit mode only) ── */}
          {editing && activeTab === 'content' && (
            <div>
              <div className="form-group">
                <label>About Us</label>
                <QuillEditor
                  value={form.about_html || ''}
                  onChange={html => setForm(f => ({ ...f, about_html: html }))}
                  placeholder="Write about the club…"
                  minHeight={320}
                />
              </div>

              <div className="form-group" style={{ marginTop: 20 }}>
                <label>Mission</label>
                <QuillEditor
                  value={form.mission_html || ''}
                  onChange={html => setForm(f => ({ ...f, mission_html: html }))}
                  placeholder="Our mission is…"
                  minHeight={180}
                />
              </div>

              <div className="form-group" style={{ marginTop: 20 }}>
                <label>Vision</label>
                <QuillEditor
                  value={form.vision_html || ''}
                  onChange={html => setForm(f => ({ ...f, vision_html: html }))}
                  placeholder="Our vision is…"
                  minHeight={180}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginTop: 20 }}>
                <button className="btn btn-primary" onClick={save}>Save</button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowPreview(true)}
                >
                  👁️ Preview About Us Page
                </button>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                {err && <span className="msg err">{err}</span>}
                {msg && <span className="msg">{msg}</span>}
              </div>

              {/* ── Preview Modal ── */}
              {showPreview && (
                <div
                  style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,.65)', display: 'flex',
                    alignItems: 'flex-start', justifyContent: 'center',
                    padding: '40px 16px', overflowY: 'auto',
                  }}
                  onClick={e => { if (e.target === e.currentTarget) setShowPreview(false) }}
                >
                  <div style={{
                    background: '#fff', color: '#111', borderRadius: 12,
                    width: '100%', maxWidth: 780, padding: '40px 48px',
                    boxShadow: '0 24px 64px rgba(0,0,0,.35)',
                    fontFamily: 'Georgia, serif', lineHeight: 1.75,
                  }}>
                    {/* Modal header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 32,
                      paddingBottom: 16, borderBottom: '2px solid #e5e7eb',
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
                          Preview — About Us Page
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>
                          {form.flag_emoji && <span style={{ marginRight: 8 }}>{form.flag_emoji}</span>}
                          {form.club_name || 'Club Name'}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPreview(false)}
                        style={{
                          background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                          padding: '6px 14px', cursor: 'pointer', fontSize: 13,
                          color: '#374151', fontFamily: 'sans-serif',
                        }}
                      >
                        ✕ Close
                      </button>
                    </div>

                    {/* About Us */}
                    {form.about_html && (
                      <section style={{ marginBottom: 40 }}>
                        <h2 style={{
                          fontSize: 13, fontFamily: 'sans-serif', fontWeight: 700,
                          letterSpacing: '.1em', textTransform: 'uppercase',
                          color: '#6366f1', marginBottom: 16, marginTop: 0,
                        }}>
                          About Us
                        </h2>
                        <div
                          style={{ fontSize: 16, color: '#1f2937' }}
                          dangerouslySetInnerHTML={{ __html: form.about_html }}
                        />
                      </section>
                    )}

                    {/* Mission + Vision side by side if both exist, stacked if one */}
                    {(form.mission_html || form.vision_html) && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: form.mission_html && form.vision_html ? '1fr 1fr' : '1fr',
                        gap: 32,
                        borderTop: '1px solid #e5e7eb',
                        paddingTop: 32,
                      }}>
                        {form.mission_html && (
                          <section>
                            <h2 style={{
                              fontSize: 13, fontFamily: 'sans-serif', fontWeight: 700,
                              letterSpacing: '.1em', textTransform: 'uppercase',
                              color: '#059669', marginBottom: 16, marginTop: 0,
                            }}>
                              Our Mission
                            </h2>
                            <div
                              style={{ fontSize: 15, color: '#374151' }}
                              dangerouslySetInnerHTML={{ __html: form.mission_html }}
                            />
                          </section>
                        )}
                        {form.vision_html && (
                          <section>
                            <h2 style={{
                              fontSize: 13, fontFamily: 'sans-serif', fontWeight: 700,
                              letterSpacing: '.1em', textTransform: 'uppercase',
                              color: '#d97706', marginBottom: 16, marginTop: 0,
                            }}>
                              Our Vision
                            </h2>
                            <div
                              style={{ fontSize: 15, color: '#374151' }}
                              dangerouslySetInnerHTML={{ __html: form.vision_html }}
                            />
                          </section>
                        )}
                      </div>
                    )}

                    {/* Empty state */}
                    {!form.about_html && !form.mission_html && !form.vision_html && (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontFamily: 'sans-serif' }}>
                        Nothing to preview yet — add some content above.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── IMAGES TAB (edit mode only) ── */}
          {editing && activeTab === 'images' && (
            <div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '1rem',
              }}>
                <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
                  Images for <strong style={{ color: 'var(--text)' }}>{form.club_name}</strong>
                </span>
                <button className="btn btn-primary btn-sm" onClick={openImgAdd}>+ Add Image</button>
              </div>

              {/* Image form */}
              {imgOpen && (
                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  padding: '1rem', marginBottom: '1rem',
                }}>
                  <div style={{
                    fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '.75rem',
                  }}>
                    {imgEditing ? 'Edit Image' : 'New Image'}
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <ImageUpload
                      value={imgForm.image_url || ''}
                      onChange={url => setImgForm(f => ({ ...f, image_url: url }))}
                      folder="clubs"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Caption</label>
                      <input
                        value={imgForm.caption || ''}
                        onChange={e => setImgForm(f => ({ ...f, caption: e.target.value }))}
                        placeholder="Optional caption"
                      />
                    </div>
                    <div className="form-group" style={{ maxWidth: 160 }}>
                      <label>Sort Order</label>
                      <input
                        type="number"
                        value={imgForm.sort_order ?? 0}
                        onChange={e => setImgForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                      />
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
                  ? (
                    <div style={{ color: 'var(--text3)', fontSize: '.82rem', padding: '1.5rem 0', textAlign: 'center' }}>
                      No images yet — click "+ Add Image" to upload one.
                    </div>
                  )
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.75rem' }}>
                      {images.map(img => (
                        <div key={img.image_id} style={{
                          border: '1px solid var(--border)',
                          background: 'var(--bg2)', overflow: 'hidden',
                        }}>
                          <img
                            src={img.image_url}
                            alt={img.caption || ''}
                            style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                          />
                          <div style={{ padding: '.5rem .6rem' }}>
                            <div style={{
                              fontSize: '.75rem', color: 'var(--text)', marginBottom: '.15rem',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {img.caption || '—'}
                            </div>
                            <div style={{ fontSize: '.68rem', color: 'var(--text3)', marginBottom: '.5rem' }}>
                              Sort: {img.sort_order ?? 0}
                            </div>
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
      {loading ? (
        <div className="empty"><span className="spinner" />Loading…</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Flag</th>
                <th>Name</th>
                <th>Status</th>
                <th>Country</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Geo Fence</th>
                {isSuperAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>
                    No clubs yet.
                  </td>
                </tr>
              ) : rows.map(r => (
                <tr key={r.club_id}>
                  <td style={{ fontSize: 20 }}>{r.flag_emoji || '—'}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.club_name}</td>
                  <td>
                    <span className={`badge ${r.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                      {r.status || '—'}
                    </span>
                  </td>
                  <td>{r.country || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                    {r.contact_email && <div>{r.contact_email}</div>}
                    {r.contact_phone && <div>{r.contact_phone}</div>}
                    {!r.contact_email && !r.contact_phone && '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace' }}>
                    {r.lat != null && r.lng != null
                      ? `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}`
                      : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {r.geo_fence != null ? `${r.geo_fence} m` : '—'}
                  </td>
                  {isSuperAdmin && (
                    <td className="td-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDel(r)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {del && (
        <ConfirmDialog
          message={`Delete club "${del.club_name}"?`}
          onConfirm={doDelete}
          onCancel={() => setDel(null)}
        />
      )}
      {delImg && (
        <ConfirmDialog
          message="Delete this image?"
          onConfirm={doDeleteImg}
          onCancel={() => setDelImg(null)}
        />
      )}
    </div>
  )
}
