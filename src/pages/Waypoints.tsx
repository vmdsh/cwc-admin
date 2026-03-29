import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { RouteWaypoint } from '../types/database'
const E:Partial<RouteWaypoint>={ route_id:'', way_name:'', sequence:1, lat:0, lng:0 }
export function Waypoints() {
  const { routeOpts, routeName, loadDeliveryCaches } = useAdminStore()
  const [rows,setRows]=useState<RouteWaypoint[]>([]); const [filtered,setFiltered]=useState<RouteWaypoint[]>([])
  const [rf,setRf]=useState(''); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<RouteWaypoint>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<RouteWaypoint|null>(null)
  const load=async()=>{ setLoading(true); await loadDeliveryCaches(); const{data}=await supabase.from('route_waypoints').select('*').order('sequence'); const all=data||[]; setRows(all); setFiltered(all); setLoading(false) }
  useEffect(()=>{ load() },[])
  const applyFilter=(v:string,all:RouteWaypoint[])=>{ setRf(v); setFiltered(v?all.filter(r=>r.route_id===v):all) }
  const save=async()=>{
    if(!form.route_id||!form.way_name||!form.sequence){ setErr('Route, Name and Sequence required'); return }
    setMsg('Saving…'); setErr('')
    const p={ route_id:form.route_id!, way_name:form.way_name!, sequence:form.sequence!, lat:form.lat||0, lng:form.lng||0 }
    const{error}=editing&&form.way_id ? await supabase.from('route_waypoints').update(p).eq('way_id',form.way_id) : await supabase.from('route_waypoints').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('route_waypoints').delete().eq('way_id',del.way_id); setDel(null); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Route Waypoints</div><div className="section-sub">Stops per route</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add Waypoint</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Waypoint</div>
        <div className="form-row">
          <div className="form-group"><label>Route</label><Select value={form.route_id||''} onChange={v=>setForm(f=>({...f,route_id:v}))} options={routeOpts()} placeholder="— Select Route —"/></div>
          <div className="form-group"><label>Waypoint Name</label><input value={form.way_name||''} onChange={e=>setForm(f=>({...f,way_name:e.target.value}))} placeholder="e.g. Thavakkara Junction"/></div>
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>Sequence #</label><input type="number" value={form.sequence||''} onChange={e=>setForm(f=>({...f,sequence:parseInt(e.target.value)}))} min="1"/></div>
          <div className="form-group"><label>Latitude</label><input type="number" step="any" value={form.lat||''} onChange={e=>setForm(f=>({...f,lat:parseFloat(e.target.value)}))} placeholder="11.8745"/></div>
          <div className="form-group"><label>Longitude</label><input type="number" step="any" value={form.lng||''} onChange={e=>setForm(f=>({...f,lng:parseFloat(e.target.value)}))} placeholder="75.3704"/></div>
        </div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      <div style={{display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'1rem'}}>
        <span style={{fontSize:'.72rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em'}}>Route:</span>
        <select value={rf} onChange={e=>applyFilter(e.target.value,rows)} style={{padding:'.35rem .75rem',background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--text)',fontFamily:"'Outfit',sans-serif",fontSize:'.78rem',outline:'none'}}>
          <option value="">All Routes</option>
          {routeOpts().map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Seq</th><th>Waypoint Name</th><th>Route</th><th>Lat</th><th>Lng</th><th>Actions</th></tr></thead>
          <tbody>{filtered.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No waypoints.</td></tr>
          :filtered.map(r=><tr key={r.way_id}>
            <td style={{fontSize:'.8rem',fontWeight:700,color:'var(--accent)',textAlign:'center',width:48}}>{r.sequence}</td>
            <td style={{fontWeight:500,color:'var(--text)'}}>{r.way_name}</td>
            <td>{routeName(r.route_id)}</td>
            <td style={{fontFamily:'monospace',fontSize:'.75rem',color:'var(--text3)'}}>{r.lat}</td>
            <td style={{fontFamily:'monospace',fontSize:'.75rem',color:'var(--text3)'}}>{r.lng}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message={`Delete waypoint "${del.way_name}"?`} onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
