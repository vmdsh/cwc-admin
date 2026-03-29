import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { Route } from '../types/database'
const E:Partial<Route>={ route_name:'', club_id:'', description:'', is_active:true }
export function Routes() {
  const { adminUser, isSuperAdmin, clubOpts, loadDeliveryCaches, clubName } = useAdminStore()
  const [rows,setRows]=useState<Route[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<Route>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<Route|null>(null)
  const load=async()=>{ setLoading(true); await loadDeliveryCaches(); let q=supabase.from('routes').select('*').order('route_name'); if(!isSuperAdmin&&adminUser?.club_id) q=q.eq('club_id',adminUser.club_id); const{data}=await q; setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const save=async()=>{
    if(!form.route_name){ setErr('Name required'); return }
    setMsg('Saving…'); setErr('')
    const p={ route_name:form.route_name!, description:form.description||'', is_active:form.is_active??true, club_id:form.club_id||null }
    const{error}=editing&&form.route_id ? await supabase.from('routes').update(p).eq('route_id',form.route_id) : await supabase.from('routes').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    await loadDeliveryCaches(); setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('routes').delete().eq('route_id',del.route_id); setDel(null); await loadDeliveryCaches(); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Routes</div><div className="section-sub">{rows.length} routes</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm({...E,club_id:isSuperAdmin?'':adminUser?.club_id||''}); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add Route</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Route</div>
        <div className="form-row">
          <div className="form-group"><label>Route Name</label><input value={form.route_name||''} onChange={e=>setForm(f=>({...f,route_name:e.target.value}))} placeholder="e.g. Kannur North Circle"/></div>
          <div className="form-group"><label>Club</label><Select value={form.club_id||''} onChange={v=>setForm(f=>({...f,club_id:v}))} options={clubOpts()} placeholder="— Select Club —"/></div>
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Coverage area…" style={{minHeight:70}}/></div>
        <div className="form-group"><label>Active</label>
          <select value={form.is_active?'true':'false'} onChange={e=>setForm(f=>({...f,is_active:e.target.value==='true'}))}>
            <option value="true">Yes</option><option value="false">No</option>
          </select>
        </div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Route Name</th><th>Club</th><th>Description</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No routes yet.</td></tr>
          :rows.map(r=><tr key={r.route_id}>
            <td style={{fontWeight:500,color:'var(--text)'}}>{r.route_name}</td>
            <td>{clubName(r.club_id)}</td>
            <td style={{color:'var(--text2)',fontSize:'.78rem',maxWidth:240}}>{r.description||'—'}</td>
            <td>{r.is_active?<span className="badge badge-active">Active</span>:<span className="badge badge-inactive">Inactive</span>}</td>
            <td style={{color:'var(--text3)',fontSize:'.72rem'}}>{r.created_at?new Date(r.created_at).toLocaleDateString():'—'}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message={`Delete route "${del.route_name}"?`} onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
