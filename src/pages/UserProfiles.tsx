import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { UserProfile } from '../types/database'
const E:Partial<UserProfile>={ user_id:'', tagline:'', bio:'', skills:[], experience_yr:null, rate_per_hr:null, availability:'anytime', is_mentor:true, linkedin_url:'', website_url:'' }
export function UserProfiles() {
  const { userOpts, userName } = useAdminStore()
  const [rows,setRows]=useState<UserProfile[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<UserProfile>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [skillsText,setSkillsText]=useState('')
  const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<UserProfile|null>(null)
  const load=async()=>{ setLoading(true); const{data}=await supabase.from('user_profiles').select('*'); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const openAdd=()=>{ setForm(E); setSkillsText(''); setEditing(false); setOpen(true); setErr(''); setMsg('') }
  const openEdit=(r:UserProfile)=>{ setForm(r); setSkillsText((r.skills||[]).join(', ')); setEditing(true); setOpen(true); setErr(''); setMsg('') }
  const save=async()=>{
    if(!form.user_id){ setErr('User required'); return }
    setMsg('Saving…'); setErr('')
    const skills=skillsText?skillsText.split(',').map(s=>s.trim()).filter(Boolean):[]
    const p={ user_id:form.user_id!, tagline:form.tagline||'', bio:form.bio||'', skills, experience_yr:form.experience_yr??null, rate_per_hr:form.rate_per_hr??null, availability:form.availability||'anytime', is_mentor:form.is_mentor??true, linkedin_url:form.linkedin_url||'', website_url:form.website_url||'', updated_at:new Date().toISOString() }
    const{error}=await supabase.from('user_profiles').upsert(p,{onConflict:'user_id'})
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('user_profiles').delete().eq('user_id',del.user_id); setDel(null); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Mentor Profiles</div><div className="section-sub">{rows.length} profiles</div></div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Profile</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Profile</div>
        <div className="form-group"><label>User</label><Select value={form.user_id||''} onChange={v=>setForm(f=>({...f,user_id:v}))} options={userOpts()} placeholder="— Select User —"/></div>
        <div className="form-row">
          <div className="form-group"><label>Tagline</label><input value={form.tagline||''} onChange={e=>setForm(f=>({...f,tagline:e.target.value}))} placeholder="AI & Productivity Coach"/></div>
          <div className="form-group"><label>Experience (years)</label><input type="number" value={form.experience_yr??''} onChange={e=>setForm(f=>({...f,experience_yr:e.target.value?parseInt(e.target.value):null}))} placeholder="5"/></div>
        </div>
        <div className="form-group"><label>Bio</label><textarea value={form.bio||''} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} style={{minHeight:100}} placeholder="About this mentor…"/></div>
        <div className="form-row">
          <div className="form-group"><label>Skills (comma separated)</label><input value={skillsText} onChange={e=>setSkillsText(e.target.value)} placeholder="Python, AI, Design"/></div>
          <div className="form-group"><label>Rate per Hour (₹)</label><input type="number" value={form.rate_per_hr??''} onChange={e=>setForm(f=>({...f,rate_per_hr:e.target.value?parseFloat(e.target.value):null}))} placeholder="500"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Availability</label>
            <select value={form.availability||'anytime'} onChange={e=>setForm(f=>({...f,availability:e.target.value as UserProfile['availability']}))}>
              <option value="anytime">Anytime</option><option value="weekends">Weekends</option><option value="evenings">Evenings</option>
            </select>
          </div>
          <div className="form-group"><label>Is Mentor</label>
            <select value={form.is_mentor?'true':'false'} onChange={e=>setForm(f=>({...f,is_mentor:e.target.value==='true'}))}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>LinkedIn</label><input value={form.linkedin_url||''} onChange={e=>setForm(f=>({...f,linkedin_url:e.target.value}))} placeholder="https://linkedin.com/in/…"/></div>
          <div className="form-group"><label>Website</label><input value={form.website_url||''} onChange={e=>setForm(f=>({...f,website_url:e.target.value}))} placeholder="https://…"/></div>
        </div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>User</th><th>Tagline</th><th>Mentor</th><th>Rate/hr</th><th>Availability</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No profiles.</td></tr>
          :rows.map(r=><tr key={r.user_id}>
            <td style={{fontWeight:500,color:'var(--text)'}}>{userName(r.user_id)}</td>
            <td>{r.tagline||'—'}</td>
            <td>{r.is_mentor?<span className="badge badge-active">Yes</span>:<span className="badge badge-inactive">No</span>}</td>
            <td>{r.rate_per_hr?`₹${r.rate_per_hr}`:'Free'}</td>
            <td>{r.availability||'—'}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(r)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message={`Delete profile for "${userName(del.user_id)}"?`} onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
