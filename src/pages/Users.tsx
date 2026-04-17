import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { User } from '../types/database'
const E:Partial<User>={ name:'', email:'', password:'', role:'member', club_id:'' }
export function Users() {
  const { adminUser, isSuperAdmin, clubOpts, loadCaches, clubName } = useAdminStore()
  
  // Club filter
  const clubOptions = clubOpts()
  const [filterClub, setFilterClub] = useState<string>('') // Empty string = All clubs
  
  const [rows,setRows]=useState<User[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<User>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<User|null>(null)
  
  const load=async()=>{ 
    setLoading(true); 
    let q=supabase.from('users').select('*'); 
    
    // For non-superadmins, always filter by their club
    if(!isSuperAdmin && adminUser?.club_id) {
      q = q.eq('club_id', adminUser.club_id)
    } 
    // For superadmins, filter by selected club if any
    else if (isSuperAdmin && filterClub) {
      q = q.eq('club_id', filterClub)
    }
    
    const{data}=await q; 
    setRows(data||[]); 
    setLoading(false) 
  }
  
  useEffect(()=>{ load() },[filterClub, adminUser?.club_id, isSuperAdmin])
  
  const save=async()=>{
    if(!form.name||!form.email){ setErr('Name and Email required'); return }
    setMsg('Saving…'); setErr('')
    const p={ name:form.name!, email:form.email!, password:form.password||'', role:form.role||'member', club_id:form.club_id||null }
    const{error}=editing&&form.user_id ? await supabase.from('users').update(p).eq('user_id',form.user_id) : await supabase.from('users').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    await loadCaches(); setOpen(false); load()
  }
  
  const doDelete=async()=>{ if(!del) return; await supabase.from('users').delete().eq('user_id',del.user_id); setDel(null); await loadCaches(); load() }
  
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Users</div><div className="section-sub">{rows.length} users</div></div>
        {isSuperAdmin&&<button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add User</button>}
      </div>
      
      {/* Club filter - only show for superadmins */}
      {isSuperAdmin && (
        <div className="filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: '200px' }}>
            <label>Club</label>
            <Select 
              value={filterClub} 
              onChange={setFilterClub} 
              options={[{ value: '', label: '— All Clubs —' }, ...clubOptions]} 
              placeholder="— Select Club —"
            />
          </div>
          <div style={{ flex: 1 }}></div>
        </div>
      )}
      
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} User</div>
        <div className="form-row">
          <div className="form-group"><label>Name</label><input value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Full name"/></div>
          <div className="form-group"><label>Email</label><input type="email" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Password</label><input type="text" value={form.password||''} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Password"/></div>
          <div className="form-group"><label>Role</label>
            <select value={form.role||'member'} onChange={e=>setForm(f=>({...f,role:e.target.value as User['role']}))}>
              <option value="member">Member</option>
              <option value="clubadmin">Club Admin</option>
              {isSuperAdmin&&<option value="superadmin">Super Admin</option>}
            </select>
          </div>
        </div>
        <div className="form-group"><label>Club</label><Select value={form.club_id||''} onChange={v=>setForm(f=>({...f,club_id:v}))} options={clubOpts()} placeholder="— Select Club —"/></div>
        <div style={{display:'flex',gap:'.75rem',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
          {err&&<span className="msg err">{err}</span>}{msg&&<span className="msg">{msg}</span>}
        </div>
      </div>}
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Club</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No users.</td></tr>
          :rows.map(r=><tr key={r.user_id}>
            <td style={{fontWeight:500,color:'var(--text)'}}>{r.name||'—'}</td>
            <td style={{color:'var(--text2)'}}>{r.email}</td>
            <td><span className="badge badge-role">{r.role||'member'}</span></td>
            <td>{clubName(r.club_id)}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              {isSuperAdmin&&<button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>}
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message={`Delete user "${del.name||del.email}"?`} onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
