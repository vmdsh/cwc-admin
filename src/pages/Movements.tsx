import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { RouteMovement } from '../types/database'
type St='scheduled'|'in_progress'|'completed'|'cancelled'
const SB:Record<St,string>={ scheduled:'badge-role', in_progress:'badge-active', completed:'badge-inactive', cancelled:'badge-inactive' }
const E:Partial<RouteMovement>={ route_id:'', shop_id:'', driver_id:'', movement_date:'', start_time:'', end_time:'', status:'scheduled', notes:'' }
export function Movements() {
  const { routeOpts, shopOpts, userOpts, routeName, shopName, userName, loadDeliveryCaches } = useAdminStore()
  const [rows,setRows]=useState<RouteMovement[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<RouteMovement>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<RouteMovement|null>(null)
  const load=async()=>{ setLoading(true); await loadDeliveryCaches(); const{data}=await supabase.from('route_movements').select('*').order('movement_date',{ascending:false}); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const save=async()=>{
    if(!form.route_id||!form.movement_date){ setErr('Route and Date required'); return }
    setMsg('Saving…'); setErr('')
    const p={ route_id:form.route_id!, shop_id:form.shop_id||null, driver_id:form.driver_id||null, movement_date:form.movement_date!, start_time:form.start_time||null, end_time:form.end_time||null, status:form.status||'scheduled', notes:form.notes||'' }
    const{error}=editing&&form.movement_id ? await supabase.from('route_movements').update(p).eq('movement_id',form.movement_id) : await supabase.from('route_movements').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    await loadDeliveryCaches(); setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('route_movements').delete().eq('movement_id',del.movement_id); setDel(null); await loadDeliveryCaches(); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Route Movements</div><div className="section-sub">Trip scheduling — {rows.length} movements</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm({...E,movement_date:new Date().toISOString().slice(0,10)}); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Schedule Movement</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Schedule'} Movement</div>
        <div className="form-row">
          <div className="form-group"><label>Route</label><Select value={form.route_id||''} onChange={v=>setForm(f=>({...f,route_id:v}))} options={routeOpts()} placeholder="— Select Route —"/></div>
          <div className="form-group"><label>Shop (Seller)</label><Select value={form.shop_id||''} onChange={v=>setForm(f=>({...f,shop_id:v}))} options={shopOpts()} placeholder="— Select Shop —"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Driver</label><Select value={form.driver_id||''} onChange={v=>setForm(f=>({...f,driver_id:v}))} options={userOpts()} placeholder="— Select Driver —"/></div>
          <div className="form-group"><label>Movement Date</label><input type="date" value={form.movement_date||''} onChange={e=>setForm(f=>({...f,movement_date:e.target.value}))}/></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>Start Time</label><input type="time" value={form.start_time||''} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))}/></div>
          <div className="form-group"><label>End Time</label><input type="time" value={form.end_time||''} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))}/></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status||'scheduled'} onChange={e=>setForm(f=>({...f,status:e.target.value as St}))}>
              <option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option>
              <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Notes</label><input value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes…"/></div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Date</th><th>Route</th><th>Shop</th><th>Driver</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={8} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No movements yet.</td></tr>
          :rows.map(r=><tr key={r.movement_id}>
            <td style={{fontWeight:500,color:'var(--text)'}}>{r.movement_date}</td>
            <td>{routeName(r.route_id)}</td><td>{shopName(r.shop_id)}</td><td>{userName(r.driver_id)}</td>
            <td style={{fontFamily:'monospace',fontSize:'.75rem'}}>{r.start_time||'—'}</td>
            <td style={{fontFamily:'monospace',fontSize:'.75rem'}}>{r.end_time||'—'}</td>
            <td><span className={`badge ${SB[r.status as St]||'badge-role'}`}>{r.status||'—'}</span></td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message={`Delete movement on ${del.movement_date}?`} onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
