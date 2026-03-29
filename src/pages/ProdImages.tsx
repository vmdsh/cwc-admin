import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImageUpload } from '../components/ImageUpload'
import { Select } from '../components/Select'
import type { ProductImage } from '../types/database'
const E:Partial<ProductImage>={ product_id:'', image_url:'', caption:'', sort_order:0 }
export function ProdImages() {
  const { prodOpts, prodName } = useAdminStore()
  const [rows,setRows]=useState<ProductImage[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<ProductImage>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<ProductImage|null>(null)
  const load=async()=>{ setLoading(true); const{data}=await supabase.from('product_images').select('*').order('sort_order'); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const save=async()=>{
    if(!form.product_id||!form.image_url){ setErr('Product and URL required'); return }
    setMsg('Saving…'); setErr('')
    const p={ product_id:form.product_id!, image_url:form.image_url!, caption:form.caption||'', sort_order:form.sort_order||0 }
    const{error}=editing&&form.image_id ? await supabase.from('product_images').update(p).eq('image_id',form.image_id) : await supabase.from('product_images').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('product_images').delete().eq('image_id',del.image_id); setDel(null); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Product Images</div><div className="section-sub">{rows.length} images</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add Image</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Image</div>
        <div className="form-row">
          <div className="form-group"><label>Product</label><Select value={form.product_id||''} onChange={v=>setForm(f=>({...f,product_id:v}))} options={prodOpts()} placeholder="— Select Product —"/></div>
          <div className="form-group"><label>Sort Order</label><input type="number" value={form.sort_order??0} onChange={e=>setForm(f=>({...f,sort_order:parseInt(e.target.value)||0}))}/></div>
        </div>
        <div className="form-group"><label>Image</label><ImageUpload value={form.image_url||''} onChange={url=>setForm(f=>({...f,image_url:url}))} folder="products"/></div>
        <div className="form-group"><label>Caption</label><input value={form.caption||''} onChange={e=>setForm(f=>({...f,caption:e.target.value}))} placeholder="Optional caption"/></div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Preview</th><th>Product</th><th>Caption</th><th>Sort</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No images.</td></tr>
          :rows.map(r=><tr key={r.image_id}>
            <td>{r.image_url?<img src={r.image_url} style={{width:60,height:36,objectFit:'cover',border:'1px solid var(--border)'}} alt=""/>:'—'}</td>
            <td>{prodName(r.product_id)}</td><td>{r.caption||'—'}</td><td>{r.sort_order??0}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message="Delete this image?" onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
