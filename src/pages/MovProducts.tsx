import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { MovementProduct } from '../types/database'
const E:Partial<MovementProduct>={ movement_id:'', product_id:'', planned_qty:1, actual_qty:null, notes:'' }
export function MovProducts() {
  const { movementOpts, prodOpts, movementLabel, prodName, loadDeliveryCaches } = useAdminStore()
  const [rows,setRows]=useState<MovementProduct[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<MovementProduct>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<MovementProduct|null>(null)
  const load=async()=>{ setLoading(true); await loadDeliveryCaches(); const{data}=await supabase.from('movement_products').select('*'); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const save=async()=>{
    if(!form.movement_id||!form.product_id){ setErr('Movement and Product required'); return }
    setMsg('Saving…'); setErr('')
    const p={ movement_id:form.movement_id!, product_id:form.product_id!, planned_qty:form.planned_qty||1, actual_qty:form.actual_qty??null, notes:form.notes||'' }
    const{error}=editing&&form.id ? await supabase.from('movement_products').update(p).eq('id',form.id) : await supabase.from('movement_products').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('movement_products').delete().eq('id',del.id); setDel(null); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Movement Products</div><div className="section-sub">Products per trip · {rows.length} entries</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Movement Product</div>
        <div className="form-row">
          <div className="form-group"><label>Movement</label><Select value={form.movement_id||''} onChange={v=>setForm(f=>({...f,movement_id:v}))} options={movementOpts()} placeholder="— Select Movement —"/></div>
          <div className="form-group"><label>Product</label><Select value={form.product_id||''} onChange={v=>setForm(f=>({...f,product_id:v}))} options={prodOpts()} placeholder="— Select Product —"/></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>Planned Qty</label><input type="number" value={form.planned_qty??1} min="1" onChange={e=>setForm(f=>({...f,planned_qty:parseInt(e.target.value)||1}))}/></div>
          <div className="form-group"><label>Actual Qty</label><input type="number" value={form.actual_qty??''} onChange={e=>setForm(f=>({...f,actual_qty:e.target.value?parseInt(e.target.value):null}))} placeholder="After delivery"/></div>
          <div className="form-group"><label>Notes</label><input value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional"/></div>
        </div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Movement</th><th>Product</th><th>Planned</th><th>Actual</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No entries.</td></tr>
          :rows.map(r=><tr key={r.id}>
            <td style={{fontSize:'.78rem'}}>{movementLabel(r.movement_id)}</td>
            <td style={{fontWeight:500,color:'var(--text)'}}>{prodName(r.product_id)}</td>
            <td style={{textAlign:'center'}}>{r.planned_qty}</td>
            <td style={{textAlign:'center'}}>{r.actual_qty??'—'}</td>
            <td style={{color:'var(--text3)',fontSize:'.75rem'}}>{r.notes||'—'}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message="Delete this entry?" onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
