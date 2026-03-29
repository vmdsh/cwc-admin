import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { RouteBooking } from '../types/database'
type Bs='pending'|'confirmed'|'out_for_delivery'|'delivered'|'cancelled'
const SB:Record<Bs,string>={ pending:'badge-role', confirmed:'badge-active', out_for_delivery:'badge-active', delivered:'badge-active', cancelled:'badge-inactive' }
const FILTERS=[{v:'',l:'All'},{v:'pending',l:'Pending'},{v:'confirmed',l:'Confirmed'},{v:'out_for_delivery',l:'Out for Delivery'},{v:'delivered',l:'Delivered'},{v:'cancelled',l:'Cancelled'}]
const E:Partial<RouteBooking>={ movement_id:'', product_id:'', customer_id:'', address_id:'', qty:1, amount:0, status:'pending', notes:'' }
export function Bookings() {
  const { movementOpts, prodOpts, userOpts, movementLabel, prodName, userName, loadDeliveryCaches } = useAdminStore()
  const [rows,setRows]=useState<RouteBooking[]>([]); const [filtered,setFiltered]=useState<RouteBooking[]>([])
  const [af,setAf]=useState(''); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<RouteBooking>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<RouteBooking|null>(null)
  const load=async()=>{ setLoading(true); await loadDeliveryCaches(); const{data}=await supabase.from('route_bookings').select('*').order('booked_at',{ascending:false}); const all=data||[]; setRows(all); setFiltered(all); setLoading(false) }
  useEffect(()=>{ load() },[])
  const applyFilter=(v:string)=>{ setAf(v); setFiltered(v?rows.filter(r=>r.status===v):rows) }
  const save=async()=>{
    setMsg('Saving…'); setErr('')
    const p={ movement_id:form.movement_id||null, product_id:form.product_id||null, customer_id:form.customer_id||null, address_id:form.address_id?.trim()||null, qty:form.qty||1, amount:form.amount||0, status:form.status||'pending', notes:form.notes||'' }
    const{error}=editing&&form.booking_id ? await supabase.from('route_bookings').update(p).eq('booking_id',form.booking_id) : await supabase.from('route_bookings').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('route_bookings').delete().eq('booking_id',del.booking_id); setDel(null); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Bookings</div><div className="section-sub">{rows.length} total</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add Booking</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Booking</div>
        <div className="form-row">
          <div className="form-group"><label>Movement</label><Select value={form.movement_id||''} onChange={v=>setForm(f=>({...f,movement_id:v}))} options={movementOpts()} placeholder="— Select Movement —"/></div>
          <div className="form-group"><label>Product</label><Select value={form.product_id||''} onChange={v=>setForm(f=>({...f,product_id:v}))} options={prodOpts()} placeholder="— Select Product —"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Customer</label><Select value={form.customer_id||''} onChange={v=>setForm(f=>({...f,customer_id:v}))} options={userOpts()} placeholder="— Select Customer —"/></div>
          <div className="form-group"><label>Delivery Address ID</label><input value={form.address_id||''} onChange={e=>setForm(f=>({...f,address_id:e.target.value}))} placeholder="address_id (UUID)"/></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>Qty</label><input type="number" value={form.qty??1} min="1" onChange={e=>setForm(f=>({...f,qty:parseInt(e.target.value)||1}))}/></div>
          <div className="form-group"><label>Amount (₹)</label><input type="number" value={form.amount??0} step="0.01" onChange={e=>setForm(f=>({...f,amount:parseFloat(e.target.value)||0}))}/></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status||'pending'} onChange={e=>setForm(f=>({...f,status:e.target.value as Bs}))}>
              <option value="pending">Pending</option><option value="confirmed">Confirmed</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Notes</label><input value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Special instructions…"/></div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        <span style={{fontSize:'.72rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em'}}>Status:</span>
        {FILTERS.map(f=><button key={f.v} onClick={()=>applyFilter(f.v)} style={{padding:'.28rem .75rem',fontSize:'.68rem',fontWeight:600,letterSpacing:'.06em',cursor:'pointer',border:'1px solid var(--border)',fontFamily:"'Outfit',sans-serif",transition:'.15s',background:af===f.v?'var(--accent)':'var(--bg3)',color:af===f.v?'var(--bg)':'var(--text2)'}}>{f.l}</button>)}
      </div>
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Booked At</th><th>Movement</th><th>Product</th><th>Customer</th><th>Qty</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filtered.length===0?<tr><td colSpan={8} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No bookings.</td></tr>
          :filtered.map(r=><tr key={r.booking_id}>
            <td style={{color:'var(--text3)',fontSize:'.72rem'}}>{r.booked_at?new Date(r.booked_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}):'—'}</td>
            <td style={{fontSize:'.78rem'}}>{movementLabel(r.movement_id)}</td>
            <td style={{fontWeight:500,color:'var(--text)'}}>{prodName(r.product_id)}</td>
            <td>{userName(r.customer_id)}</td>
            <td style={{textAlign:'center',fontWeight:600}}>{r.qty||1}</td>
            <td style={{fontWeight:600,color:'var(--accent)'}}>{r.amount?`₹${Number(r.amount).toLocaleString('en-IN')}`:'—'}</td>
            <td><span className={`badge ${SB[r.status as Bs]||'badge-role'}`}>{r.status||'pending'}</span></td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message="Delete this booking?" onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
