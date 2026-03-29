import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { ShopProduct } from '../types/database'
const E:Partial<ShopProduct>={ shop_id:'', product_id:'', price_override:null, is_available:true }
export function ShopProducts() {
  const { shopOpts, prodOpts, shopName, prodName } = useAdminStore()
  const [rows,setRows]=useState<ShopProduct[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<ShopProduct>>(E)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<ShopProduct|null>(null)
  const load=async()=>{ setLoading(true); const{data}=await supabase.from('shop_products').select('*'); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const save=async()=>{
    if(!form.shop_id||!form.product_id){ setErr('Shop and Product required'); return }
    setMsg('Saving…'); setErr('')
    const{error}=await supabase.from('shop_products').insert({ shop_id:form.shop_id!, product_id:form.product_id!, price_override:form.price_override??null, is_available:form.is_available??true })
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('shop_products').delete().eq('id',del.id); setDel(null); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Shop Products</div><div className="section-sub">Link products to shops · {rows.length} links</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setOpen(true); setErr(''); setMsg('') }}>+ Link Product</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ Link Product to Shop</div>
        <div className="form-row">
          <div className="form-group"><label>Shop</label><Select value={form.shop_id||''} onChange={v=>setForm(f=>({...f,shop_id:v}))} options={shopOpts()} placeholder="— Select Shop —"/></div>
          <div className="form-group"><label>Product</label><Select value={form.product_id||''} onChange={v=>setForm(f=>({...f,product_id:v}))} options={prodOpts()} placeholder="— Select Product —"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Price Override (₹) — optional</label><input type="number" value={form.price_override??''} onChange={e=>setForm(f=>({...f,price_override:e.target.value?parseFloat(e.target.value):null}))} placeholder="Leave blank to use product price"/></div>
          <div className="form-group"><label>Available</label>
            <select value={form.is_available?'true':'false'} onChange={e=>setForm(f=>({...f,is_available:e.target.value==='true'}))}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>
        </div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Shop</th><th>Product</th><th>Price Override</th><th>Available</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No links yet.</td></tr>
          :rows.map(r=><tr key={r.id}>
            <td>{shopName(r.shop_id)}</td><td>{prodName(r.product_id)}</td>
            <td>{r.price_override!=null?`₹${Number(r.price_override).toLocaleString('en-IN')}`:'—'}</td>
            <td>{r.is_available?<span className="badge badge-active">Yes</span>:<span className="badge badge-inactive">No</span>}</td>
            <td className="td-actions"><button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Remove</button></td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message="Remove this link?" onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
