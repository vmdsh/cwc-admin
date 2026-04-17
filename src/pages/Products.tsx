import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImageUpload } from '../components/ImageUpload'
import { Select } from '../components/Select'
import type { Product, ProductImage } from '../types/database'

const EMPTY: Partial<Product> = {
  product_name: '', description: '', price: 0, uom: '',
  service_type: 'E', category_id: '', club_id: ''
}
const EMPTY_IMG: Partial<ProductImage> = {
  product_id: '', image_url: '', caption: '', sort_order: 0
}

type Tab = 'details' | 'images'

const SVC_TYPES: { value: string; label: string }[] = [
  { value: 'E', label: 'E — Enrollment' },
  { value: 'B', label: 'B — Booking' },
  { value: 'S', label: 'S — Service' },
  { value: 'I', label: 'I — Item' },
]

export function Products() {
  const { adminUser, isSuperAdmin, clubOpts, catOpts, loadCaches, clubName, catName } = useAdminStore()

  // ── Filters ──
  const [filterClub,    setFilterClub]    = useState<string>(isSuperAdmin ? '' : (adminUser?.club_id ?? ''))
  const [filterCat,     setFilterCat]     = useState<string>('')
  const [filterSvc,     setFilterSvc]     = useState<string>('')

  // ── List ──
  const [rows,    setRows]    = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // ── Form ──
  const [form,     setForm]     = useState<Partial<Product>>(EMPTY)
  const [editing,  setEditing]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [activeTab,setActiveTab]= useState<Tab>('details')
  const [err,  setErr]  = useState('')
  const [msg,  setMsg]  = useState('')
  const [delProd, setDelProd] = useState<Product | null>(null)

  // ── Images ──
  const [images,     setImages]     = useState<ProductImage[]>([])
  const [imgLoading, setImgLoading] = useState(false)
  const [imgForm,    setImgForm]    = useState<Partial<ProductImage>>(EMPTY_IMG)
  const [imgEditing, setImgEditing] = useState(false)
  const [imgOpen,    setImgOpen]    = useState(false)
  const [imgErr,     setImgErr]     = useState('')
  const [imgMsg,     setImgMsg]     = useState('')
  const [delImg,     setDelImg]     = useState<ProductImage | null>(null)

  // ── AI Generation State ──
  const [isAiProcessing, setIsAiProcessing] = useState(false)

  const load = async () => {
    setLoading(true)
    let q = supabase.from('products').select('*')
    if (!isSuperAdmin && adminUser?.club_id) q = q.eq('club_id', adminUser.club_id)
    else if (isSuperAdmin && filterClub)     q = q.eq('club_id', filterClub)
    if (filterCat) q = q.eq('category_id', filterCat)
    if (filterSvc) q = q.eq('service_type', filterSvc)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterClub, filterCat, filterSvc])

  const handleFilterClub = (v: string) => { setFilterClub(v); setFilterCat('') }

  const loadImages = async (productId: string) => {
    setImgLoading(true)
    const { data } = await supabase
      .from('product_images').select('*')
      .eq('product_id', productId).order('sort_order')
    setImages(data || [])
    setImgLoading(false)
  }

  const openAdd = () => {
    setForm({ ...EMPTY, club_id: isSuperAdmin ? (filterClub || '') : adminUser?.club_id || '' })
    setEditing(false); setActiveTab('details')
    setOpen(true); setErr(''); setMsg('')
  }

  const openEdit = (r: Product) => {
    setForm(r); setEditing(true); setActiveTab('details')
    setOpen(true); setErr(''); setMsg('')
    loadImages(r.product_id)
  }

  const save = async () => {
    if (!form.product_name || !form.club_id || !form.category_id) {
      setErr('Name, Club and Category required'); return
    }
    setMsg('Saving…'); setErr('')
    const p = {
      product_name: form.product_name!, description: form.description || '',
      price: form.price || 0, uom: form.uom || '',
      service_type: form.service_type || 'E',
      category_id: form.category_id!, club_id: form.club_id!,
    }
    const { error } = editing && form.product_id
      ? await supabase.from('products').update(p).eq('product_id', form.product_id)
      : await supabase.from('products').insert(p)
    if (error) { setErr(error.message); setMsg(''); return }
    await loadCaches(); setOpen(false); load()
  }

  const doDeleteProd = async () => {
    if (!delProd) return
    await supabase.from('products').delete().eq('product_id', delProd.product_id)
    setDelProd(null); await loadCaches(); load()
  }

  // ── Image CRUD ──
  const openImgAdd = () => {
    setImgForm({ ...EMPTY_IMG, product_id: form.product_id || '' })
    setImgEditing(false); setImgOpen(true); setImgErr(''); setImgMsg('')
  }
  const openImgEdit = (img: ProductImage) => {
    setImgForm(img); setImgEditing(true); setImgOpen(true); setImgErr(''); setImgMsg('')
  }
  const saveImg = async () => {
    if (!imgForm.image_url) { setImgErr('Image is required'); return }
    setImgMsg('Saving…'); setImgErr('')
    const p = {
      product_id: form.product_id!, image_url: imgForm.image_url!,
      caption: imgForm.caption || '', sort_order: imgForm.sort_order || 0,
    }
    const { error } = imgEditing && imgForm.image_id
      ? await supabase.from('product_images').update(p).eq('image_id', imgForm.image_id)
      : await supabase.from('product_images').insert(p)
    if (error) { setImgErr(error.message); setImgMsg(''); return }
    setImgOpen(false); loadImages(form.product_id!)
  }
  const doDeleteImg = async () => {
    if (!delImg) return
    await supabase.from('product_images').delete().eq('image_id', delImg.image_id)
    setDelImg(null); loadImages(form.product_id!)
  }

  // ── AI Catalog Generation via Vercel Proxy ──
  const generateAiImages = async () => {
    if (!imgForm.image_url) { setImgErr('Please upload/select a source image first.'); return }
    setIsAiProcessing(true); setImgMsg('AI is creating 4 professional images...')
    setImgErr('')
    
    const prompts = [
      `Professional studio shot of ${form.product_name} on a clean light grey background`,
      `Product photography of ${form.product_name} on a white marble surface`,
      `Artisanal presentation of ${form.product_name} on a light textured wooden table`,
      `${form.product_name} styled on a minimalist white linen cloth`
    ];

    try {
      for (let i = 0; i < prompts.length; i++) {
        // Call your internal Vercel API instead of Photoroom directly
        const res = await fetch('/api/photoroom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imgForm.image_url,
            prompt: prompts[i]
          })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Server error: ${res.statusText}`);
        }
        
        const resultBlob = await res.blob();

        // Upload to Supabase Storage
        const path = `products/ai_${form.product_id}_${i}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'media')
          .upload(path, resultBlob, { contentType: 'image/jpeg' });

        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabase.storage
          .from(import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'media')
          .getPublicUrl(path);

        await supabase.from('product_images').insert({
          product_id: form.product_id,
          image_url: publicUrl,
          caption: `AI Scene ${i + 1}`,
          sort_order: i + 1
        });
      }
      setImgMsg('✅ 4 images generated and saved!');
      loadImages(form.product_id!);
    } catch (e: any) {
      setImgErr(`AI Failed: ${e.message}`);
    } finally {
      setIsAiProcessing(false);
    }
  }

  const clubOptions = clubOpts()
  const catOptions  = catOpts('', filterClub || form.club_id || '')
  const hasSetDefault = useRef(false)

  useEffect(() => {
    if (isSuperAdmin && !filterClub && clubOptions.length > 0 && !hasSetDefault.current) {
      setFilterClub(clubOptions[0].value)
      hasSetDefault.current = true
    }
  }, [isSuperAdmin, filterClub, clubOptions])

  const tabStyle = (t: Tab) => ({
    padding: '.45rem 1.1rem', fontSize: '.78rem', fontWeight: 700,
    letterSpacing: '.06em', textTransform: 'uppercase' as const,
    cursor: 'pointer', border: 'none',
    borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === t ? 'var(--accent)' : 'var(--text3)',
    transition: 'color .15s',
  })

  const svcLabel = (v?: string) => SVC_TYPES.find(s => s.value === v)?.label.split(' — ')[1] || v || '—'

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Products</div>
          <div className="section-sub">{rows.length} products</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Product</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Club</span>
            <select value={filterClub} onChange={e => handleFilterClub(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.82rem', minWidth: 180 }}>
              <option value="">— All —</option>
              {clubOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Category</span>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.82rem', minWidth: 180 }}>
            <option value="">— All —</option>
            {catOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Type</span>
          <select value={filterSvc} onChange={e => setFilterSvc(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.82rem', minWidth: 150 }}>
            <option value="">— All —</option>
            {SVC_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {(filterCat || filterSvc || (isSuperAdmin && filterClub)) && (
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setFilterCat(''); setFilterSvc(''); if (isSuperAdmin) setFilterClub('') }}>
            ✕ Clear
          </button>
        )}
      </div>

      {open && (
        <div className="form-panel open">
          {editing && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
              <button style={tabStyle('details')} onClick={() => setActiveTab('details')}>📋 Details</button>
              <button style={tabStyle('images')}  onClick={() => setActiveTab('images')}>🖼️ Images</button>
            </div>
          )}
          {!editing && <div className="form-panel-title">✏️ Add Product</div>}

          {(activeTab === 'details' || !editing) && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name</label>
                  <input value={form.product_name || ''} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} placeholder="Product name" />
                </div>
                <div className="form-group">
                  <label>Club</label>
                  {isSuperAdmin
                    ? <Select value={form.club_id || ''} onChange={v => setForm(f => ({ ...f, club_id: v, category_id: '' }))} options={clubOptions} placeholder="— Select Club —" />
                    : <input value={clubName(adminUser?.club_id)} readOnly style={{ opacity: .7, cursor: 'not-allowed' }} />
                  }
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <Select value={form.category_id || ''} onChange={v => setForm(f => ({ ...f, category_id: v }))}
                    options={catOpts('', form.club_id)} placeholder="— Select Category —" />
                </div>
                <div className="form-group">
                  <label>Product Type</label>
                  <select value={form.service_type || 'E'} onChange={e => setForm(f => ({ ...f, service_type: e.target.value as 'E' | 'B' | 'S' | 'I' }))}>
                    {SVC_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price (₹)</label>
                  <input type="number" value={form.price ?? 0} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Unit of Measure</label>
                  <input value={form.uom || ''} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} placeholder="kg, litre, piece…" />
                </div>
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

          {editing && activeTab === 'images' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
                  Images for <strong style={{ color: 'var(--text)' }}>{form.product_name}</strong>
                </span>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button 
                    className="btn btn-sm" 
                    style={{ background: 'var(--accent)', color: 'white' }}
                    onClick={generateAiImages}
                    disabled={isAiProcessing || (!images.length && !imgForm.image_url)}
                  >
                    {isAiProcessing ? '✨ Processing...' : '✨ ADD AI Images'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={openImgAdd}>+ Add Image</button>
                </div>
              </div>

              {imgOpen && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '.75rem' }}>
                    {imgEditing ? 'Edit Image' : 'New Image'}
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <ImageUpload value={imgForm.image_url || ''} onChange={url => setImgForm(f => ({ ...f, image_url: url }))} folder="products" />
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

      {loading
        ? <div className="empty"><span className="spinner" />Loading…</div>
        : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Club</th><th>Category</th><th>Type</th><th>Price</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>No products yet.</td></tr>
                  : rows.map(r => (
                    <tr key={r.product_id}>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>{r.product_name}</td>
                      <td>{clubName(r.club_id)}</td>
                      <td>{catName(r.category_id)}</td>
                      <td><span className="badge badge-role">{svcLabel(r.service_type)}</span></td>
                      <td>₹{Number(r.price).toLocaleString('en-IN')}</td>
                      <td className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDelProd(r)}>Delete</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )
      }

      {delProd && <ConfirmDialog message={`Delete "${delProd.product_name}"?`} onConfirm={doDeleteProd} onCancel={() => setDelProd(null)} />}
      {delImg  && <ConfirmDialog message="Delete this image?" onConfirm={doDeleteImg} onCancel={() => setDelImg(null)} />}
    </div>
  )
}
