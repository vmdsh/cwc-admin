import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { Club } from '../types/database'
const E:Partial<Club>={ club_name:'', flag_emoji:'', status:'active', country:'', description:'' }
export function Clubs() {
  const { isSuperAdmin, loadCaches } = useAdminStore()
  const [rows,setRows]=useState<Club[]>([])
  const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<Club>>(E)
  const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false)
  const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<Club|null>(null)
  const load=async()=>{ setLoading(true); const{data}=await supabase.from('clubs').select('*'); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const openAdd=()=>{ setForm(E); setEditing(false); setOpen(true); setErr(''); setMsg('') }
  const openEdit=(r:Club)=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }
  const save=async()=>{
    if(!form.club_name){ setErr('Name required'); return }
    setMsg('Saving…'); setErr('')
    const p={ club_name:form.club_name!, flag_emoji:form.flag_emoji||'', status:form.status||'active', country:form.country||'', description:form.description||'' }
    const{error}=editing&&form.club_id ? await supabase.from('clubs').update(p).eq('club_id',form.club_id) : await supabase.from('clubs').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    await loadCaches(); setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('clubs').delete().eq('club_id',del.club_id); setDel(null); await loadCaches(); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Clubs</div><div className="section-sub">{rows.length} clubs</div></div>
        {isSuperAdmin&&<button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Club</button>}
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Club</div>
        <div className="form-row">
          <div className="form-group"><label>Club Name</label><input value={form.club_name||''} onChange={e=>setForm(f=>({...f,club_name:e.target.value}))} placeholder="e.g. Aryaprabha CoworkClub"/></div>
          <div className="form-group"><label>Flag Emoji</label><input value={form.flag_emoji||''} onChange={e=>setForm(f=>({...f,flag_emoji:e.target.value}))} placeholder="🇮🇳"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Status</label>
            <select value={form.status||'active'} onChange={e=>setForm(f=>({...f,status:e.target.value as Club['status']}))}>
              <option value="active">Active</option><option value="launching">Launching</option><option value="upcoming">Upcoming</option>
            </select>
          </div>
          <div className="form-group"><label>Country</label><input value={form.country||''} onChange={e=>setForm(f=>({...f,country:e.target.value}))} placeholder="India"/></div>
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Flag</th><th>Name</th><th>Status</th><th>Country</th>{isSuperAdmin&&<th>Actions</th>}</tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No clubs yet.</td></tr>
          :rows.map(r=><tr key={r.club_id}>
            <td>{r.flag_emoji||'—'}</td>
            <td style={{fontWeight:500,color:'var(--text)'}}>{r.club_name}</td>
            <td><span className={`badge ${r.status==='active'?'badge-active':'badge-inactive'}`}>{r.status||'—'}</span></td>
            <td>{r.country||'—'}</td>
            {isSuperAdmin&&<td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(r)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>}
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message={`Delete club "${del.club_name}"?`} onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
