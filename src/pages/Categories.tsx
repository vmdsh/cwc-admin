import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImageUpload } from '../components/ImageUpload'
import { Select } from '../components/Select'
import type { ProductCategory, ProductCategoryImage } from '../types/database'

const EMPTY: Partial<ProductCategory> = {
  category_name: '', slug: '', icon_emoji: '', one_word: '',
  tagline: '', description: '', sort_order: 0, club_id: '', parent_id: ''
}
const EMPTY_IMG: Partial<ProductCategoryImage> = {
  category_id: '', image_url: '', title: '', subtitle: '', sort_order: 0
}

type Tab = 'details' | 'images'

export function Categories() {
  const { adminUser, isSuperAdmin, clubOpts, clubName, catName, loadCaches } = useAdminStore()
  const opts = clubOpts()
  const defaultClub = isSuperAdmin
    ? (opts.length > 0 ? opts[0].value : '')
    : (adminUser?.club_id ?? '')

  // ── Club filter (superadmin only) ──
  const [filterClub, setFilterClub] = useState<string>(defaultClub)

  // ── Category list ──
  const [rows, setRows]       = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)

  // ── Parent category options (filtered by club_id) ──
  const [parentOpts, setParentOpts] = useState<{ value: string; label: string }[]>([])

  // ── Form state ──
  const [form, setForm]       = useState<Partial<ProductCategory>>(EMPTY)
  const [editing, setEditing] = useState(false)
  const [open, setOpen]       = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [err, setErr]         = useState('')
  const [msg, setMsg]         = useState('')
  const [delCat, setDelCat]   = useState<ProductCategory | null>(null)

  // ── Images state (edit mode only) ──
  const [images, setImages]       = useState<ProductCategoryImage[]>([])
  const [imgLoading, setImgLoading] = useState(false)
  const [imgForm, setImgForm]     = useState<Partial<ProductCategoryImage>>(EMPTY_IMG)
  const [imgEditing, setImgEditing] = useState(false)
  const [imgOpen, setImgOpen]     = useState(false)
  const [imgErr, setImgErr]       = useState('')
  const [imgMsg, setImgMsg]       = useState('')
  const [delImg, setDelImg]       = useState<ProductCategoryImage | null>(null)

  // ── Load categories ──
  const load = async () => {
    setLoading(true)
    let q = supabase.from('product_categories').select('*').eq('is_predefined', false).order('sort_order')
    if (!isSuperAdmin && adminUser?.club_id) q = q.eq('club_id', adminUser.club_id)
    else if (isSuperAdmin && filterClub)     q = q.eq('club_id', filterClub)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterClub])

  // ── Load parent category options for a given club_id ──
  const loadParentOpts = async (clubId: string) => {
    if (!clubId) { setParentOpts([]); return }
    const { data } = await supabase
      .from('product_categories')
      .select('category_id, category_name')
      .eq('club_id', clubId)
      .eq('is_predefined', false)
      .order('sort_order')
    setParentOpts(
      (data || []).map(c => ({ value: c.category_id, label: c.category_name }))
    )
  }

  // ── Reload parent opts when the club changes in the form ──
  useEffect(() => {
    if (open) loadParentOpts(form.club_id || '')
  }, [form.club_id, open])

  // ── Load images for a category ──
  const loadImages = async (categoryId: string) => {
    setImgLoading(true)
    const { data } = await supabase
      .from('product_category_images')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order')
    setImages(data || [])
    setImgLoading(false)
  }

  // ── Open Add ──
  const openAdd = () => {
    const clubId = isSuperAdmin ? (filterClub || '') : adminUser?.club_id || ''
    setForm({ ...EMPTY, club_id: clubId })
    setEditing(false)
    setActiveTab('details')
    setOpen(true)
    setErr(''); setMsg('')
    loadParentOpts(clubId)
  }

  // ── Open Edit ──
  const openEdit = (r: ProductCategory) => {
    setForm(r)
    setEditing(true)
    setActiveTab('details')
    setOpen(true)
    setErr(''); setMsg('')
    loadImages(r.category_id)
    loadParentOpts(r.club_id || '')
  }

  // ── Save category ──
  const save = async () => {
    if (!form.category_name || !form.club_id) { setErr('Name and Club required'); return }
    setMsg('Saving…'); setErr('')
    const p = {
      category_name: form.category_name!,
      slug:          form.slug || '',
      icon_emoji:    form.icon_emoji || '',
      one_word:      form.one_word || '',
      tagline:       form.tagline || '',
      description:   form.description || '',
      sort_order:    form.sort_order || 0,
      club_id:       form.club_id!,
      parent_id:     form.parent_id || null,
      is_predefined: false,
    }
    const { error } = editing && form.category_id
      ? await supabase.from('product_categories').update(p).eq('category_id', form.category_id)
      : await supabase.from('product_categories').insert(p)
    if (error) { setErr(error.message); setMsg(''); return }
    await loadCaches()
    setOpen(false)
    load()
  }

  // ── Delete category ──
  const doDeleteCat = async () => {
    if (!delCat) return
    await supabase.from('product_categories').delete().eq('category_id', delCat.category_id)
    setDelCat(null)
    await loadCaches()
    load()
  }

  // ── Image: open add form ──
  const openImgAdd = () => {
    setImgForm({ ...EMPTY_IMG, category_id: form.category_id || '' })
    setImgEditing(false)
    setImgOpen(true)
    setImgErr(''); setImgMsg('')
  }

  // ── Image: open edit form ──
  const openImgEdit = (img: ProductCategoryImage) => {
    setImgForm(img)
    setImgEditing(true)
    setImgOpen(true)
    setImgErr(''); setImgMsg('')
  }

  // ── Image: save ──
  const saveImg = async () => {
    if (!imgForm.image_url) { setImgErr('Image is required'); return }
    setImgMsg('Saving…'); setImgErr('')
    const p = {
      category_id: form.category_id!,
      image_url:   imgForm.image_url!,
      title:       imgForm.title || '',
      subtitle:    imgForm.subtitle || '',
      sort_order:  imgForm.sort_order || 0,
      is_active:   true,
    }
    const { error } = imgEditing && imgForm.image_id
      ? await supabase.from('product_category_images').update(p).eq('image_id', imgForm.image_id)
      : await supabase.from('product_category_images').insert(p)
    if (error) { setImgErr(error.message); setImgMsg(''); return }
    setImgOpen(false)
    loadImages(form.category_id!)
  }

  // ── Image: delete ──
  const doDeleteImg = async () => {
    if (!delImg) return
    await supabase.from('product_category_images').delete().eq('image_id', delImg.image_id)
    setDelImg(null)
    loadImages(form.category_id!)
  }

  // ── Parent category label helper ──
  const parentLabel = (parentId?: string | null) => {
    if (!parentId) return '—'
    return rows.find(r => r.category_id === parentId)?.category_name || '—'
  }

  // ── Tab button style ──
  const tabStyle = (t: Tab) => ({
    padding: '.45rem 1.1rem',
    fontSize: '.78rem',
    fontWeight: 700,
    letterSpacing: '.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    border: 'none',
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
          <div className="section-title">Product Categories</div>
          <div className="section-sub">{rows.length} categories</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Category</button>
      </div>

      {/* ── Club Filter (superadmin only) ── */}
      {isSuperAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Club</span>
          <select
            value={filterClub}
            onChange={e => setFilterClub(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.85rem', minWidth: 220 }}
          >
            <option value="">— All Clubs —</option>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {/* ── Form Panel ── */}
      {open && (
        <div className="form-panel open">

          {/* Tab bar — only in edit mode */}
          {editing && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
              <button style={tabStyle('details')} onClick={() => setActiveTab('details')}>📋 Details</button>
              <button style={tabStyle('images')}  onClick={() => setActiveTab('images')}>🖼️ Images</button>
            </div>
          )}

          {/* Add mode title */}
          {!editing && (
            <div className="form-panel-title">✏️ Add Category</div>
          )}

          {/* ── DETAILS TAB ── */}
          {(activeTab === 'details' || !editing) && (
            <>
              {/* Row 1: Category Name + Club */}
              <div className="form-row">
                <div className="form-group">
                  <label>Category Name</label>
                  <input
                    value={form.category_name || ''}
                    onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}
                    placeholder="e.g. Meetup Club"
                  />
                </div>
                <div className="form-group">
                  <label>Club</label>
                  {isSuperAdmin
                    ? <Select value={form.club_id || ''} onChange={v => setForm(f => ({ ...f, club_id: v, parent_id: '' }))} options={opts} placeholder="— Select Club —" />
                    : <input value={clubName(adminUser?.club_id)} readOnly style={{ opacity: .7, cursor: 'not-allowed' }} />
                  }
                </div>
              </div>

              {/* Row 2: Parent Category (full width) */}
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Parent Category <span style={{ fontSize: '.72rem', fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
                  <Select
                    value={form.parent_id || ''}
                    onChange={v => setForm(f => ({ ...f, parent_id: v || '' }))}
                    options={
                      // Exclude the category being edited from its own parent list
                      parentOpts.filter(o => o.value !== form.category_id)
                    }
                    placeholder="— No Parent (Top-level) —"
                  />
                </div>
              </div>

              {/* Row 3: Slug + Icon Emoji */}
              <div className="form-row">
                <div className="form-group">
                  <label>Slug</label>
                  <input 
                    list="slug-options"
                    value={form.slug || ''} 
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} 
                    placeholder="e.g. Items" 
                  />
                  <datalist id="slug-options">
                    <option value="Classifieds" />
                    <option value="Items" />
                    <option value="Concierage" />
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Icon Emoji</label>
                  <input value={form.icon_emoji || ''} onChange={e => setForm(f => ({ ...f, icon_emoji: e.target.value }))} placeholder="🤝" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>One Word</label>
                  <input value={form.one_word || ''} onChange={e => setForm(f => ({ ...f, one_word: e.target.value }))} placeholder="Connect" />
                </div>
                <div className="form-group">
                  <label>Sort Order</label>
                  <input type="number" value={form.sort_order ?? 0} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Tagline</label>
                <input value={form.tagline || ''} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Short tagline" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={save}>Save</button>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                {err && <span className="msg err">{err}</span>}
                {msg && <span className="msg">{msg}</span>}
              </div>
            </>
          )}

          {/* ── IMAGES TAB (edit mode only) ── */}
          {editing && activeTab === 'images' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
                  Images for <strong style={{ color: 'var(--text)' }}>{form.category_name}</strong>
                </span>
                <button className="btn btn-primary btn-sm" onClick={openImgAdd}>+ Add Image</button>
              </div>

              {/* Image add/edit form */}
              {imgOpen && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '.75rem' }}>
                    {imgEditing ? 'Edit Image' : 'New Image'}
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <ImageUpload value={imgForm.image_url || ''} onChange={url => setImgForm(f => ({ ...f, image_url: url }))} folder="categories" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Title</label>
                      <input value={imgForm.title || ''} onChange={e => setImgForm(f => ({ ...f, title: e.target.value }))} placeholder="Slide title" />
                    </div>
                    <div className="form-group">
                      <label>Subtitle</label>
                      <input value={imgForm.subtitle || ''} onChange={e => setImgForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="Slide subtitle" />
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth: 160 }}>
                    <label>Sort Order</label>
                    <input type="number" value={imgForm.sort_order ?? 0} onChange={e => setImgForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveImg}>Save Image</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setImgOpen(false)}>Cancel</button>
                    {imgErr && <span className="msg err">{imgErr}</span>}
                    {imgMsg && <span className="msg">{imgMsg}</span>}
                  </div>
                </div>
              )}

              {/* Images list */}
              {imgLoading
                ? <div className="empty"><span className="spinner" />Loading images…</div>
                : images.length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: '.82rem', padding: '1.5rem 0', textAlign: 'center' }}>No images yet — click "+ Add Image" to upload one.</div>
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.75rem' }}>
                      {images.map(img => (
                        <div key={img.image_id} style={{ border: '1px solid var(--border)', background: 'var(--bg2)', overflow: 'hidden' }}>
                          <img src={img.image_url} alt={img.title || ''} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '.5rem .6rem' }}>
                            <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{img.title || '—'}</div>
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

              {/* Close button */}
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
                  <th>Icon</th>
                  <th>Name</th>
                  <th>Parent</th>
                  <th>Slug</th>
                  <th>Club</th>
                  <th>Sort</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>No categories yet.</td></tr>
                  : rows.map(r => (
                    <tr key={r.category_id}>
                      <td style={{ fontSize: '1.2rem' }}>{r.icon_emoji || '—'}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.category_name}</td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text3)' }}>{parentLabel(r.parent_id)}</td>
                      <td><code style={{ fontSize: '.72rem', color: 'var(--accent)' }}>{r.slug || '—'}</code></td>
                      <td>{clubName(r.club_id)}</td>
                      <td>{r.sort_order || 0}</td>
                      <td className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelCat(r)}>Delete</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )
      }

      {/* ── Confirm Dialogs ── */}
      {delCat && <ConfirmDialog message={`Delete category "${delCat.category_name}"?`} onConfirm={doDeleteCat} onCancel={() => setDelCat(null)} />}
      {delImg && <ConfirmDialog message="Delete this image?" onConfirm={doDeleteImg} onCancel={() => setDelImg(null)} />}
    </div>
  )
}

