import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { User } from '../types/database'
const E:Partial<User>={ name:'', email:'', password:'', role:'member', club_id:'', speak_lang:'ml-IN', keyboard_lang:'en_GB', phone:'', user_whatsapp:'' }
const LANGS = [
  { v: 'en_GB', l: 'English (UK)' },
  { v: 'de-LU', l: 'German (LU)' },
  { v: 'ar-SA', l: 'Arabic (SA)' },
  { v: 'fr-LU', l: 'French (LU)' },
  { v: 'ml-IN', l: 'Malayalam' },
  { v: 'hi_IN', l: 'Hindi' },
]
const COUNTRY_EXTS = [
  { v: '+91', l: '+91 (India)' },
  { v: '+1', l: '+1 (US/Canada)' },
  { v: '+44', l: '+44 (UK)' },
  { v: '+971', l: '+971 (UAE)' },
  { v: '+966', l: '+966 (Saudi Arabia)' },
  { v: '+974', l: '+974 (Qatar)' },
  { v: '+965', l: '+965 (Kuwait)' },
  { v: '+968', l: '+968 (Oman)' },
  { v: '+973', l: '+973 (Bahrain)' },
  { v: '+49', l: '+49 (Germany)' },
  { v: '+33', l: '+33 (France)' },
  { v: '+61', l: '+61 (Australia)' },
  { v: '+65', l: '+65 (Singapore)' },
  { v: '+60', l: '+60 (Malaysia)' },
]

function parsePhone(val?: string | null) {
  if (!val) return { ext: '+91', num: '' }
  const trimmed = val.trim()
  if (trimmed.startsWith('+')) {
    const parts = trimmed.split(' ')
    if (parts.length > 1) {
      return { ext: parts[0], num: parts.slice(1).join(' ') }
    } else {
      const m = trimmed.match(/^(\+\d{1,4})(\d*)$/)
      if (m) {
        return { ext: m[1], num: m[2] }
      }
    }
  }
  return { ext: '+91', num: trimmed }
}
export function Users() {
  const { adminUser, isSuperAdmin, clubOpts, loadCaches, clubName, clubSlug } = useAdminStore()
  
  // Club filter
  const clubOptions = clubOpts()
  const [filterClub, setFilterClub] = useState<string>('') // Empty string = All clubs
  const [searchText, setSearchText] = useState('')
  
  const [rows,setRows]=useState<User[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<User>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<User|null>(null)

  const [phoneExt, setPhoneExt] = useState('+91')
  const [phoneNum, setPhoneNum] = useState('')
  const [waExt, setWaExt] = useState('+91')
  const [waNum, setWaNum] = useState('')
  
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
    const p={ 
      name:form.name!, 
      email:form.email!, 
      password:form.password||'', 
      role:form.role||'member', 
      club_id:form.club_id||null,
      speak_lang: form.speak_lang || 'ml-IN',
      keyboard_lang: form.keyboard_lang || 'en_GB',
      phone: phoneNum ? `${phoneExt} ${phoneNum.trim()}` : '',
      user_whatsapp: waNum ? `${waExt} ${waNum.trim()}` : ''
    }
    const{error}=editing&&form.user_id ? await supabase.from('users').update(p).eq('user_id',form.user_id) : await supabase.from('users').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    await loadCaches(); setOpen(false); load()
  }
  
  const doDelete=async()=>{ if(!del) return; await supabase.from('users').delete().eq('user_id',del.user_id); setDel(null); await loadCaches(); load() }
  
  const filteredRows = rows.filter(r => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.role && r.role.toLowerCase().includes(q))
    )
  })

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Users</div><div className="section-sub">{filteredRows.length} users</div></div>
        {isSuperAdmin&&<button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setPhoneExt('+91'); setPhoneNum(''); setWaExt('+91'); setWaNum(''); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add User</button>}
       </div>
      
       <div className="filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {isSuperAdmin && (
          <div className="form-group" style={{ minWidth: '200px', marginBottom: 0 }}>
            <label>Club</label>
            <Select 
              value={filterClub} 
              onChange={setFilterClub} 
              options={[{ value: '', label: '— All Clubs —' }, ...clubOptions]} 
              placeholder="— Select Club —"
            />
          </div>
        )}
        <div className="form-group" style={{ minWidth: '240px', flex: isSuperAdmin ? undefined : 1, marginBottom: 0 }}>
          <label>Search Users</label>
          <input 
            type="text" 
            value={searchText} 
            onChange={e => setSearchText(e.target.value)} 
            placeholder="Search by name, email, or role..." 
          />
        </div>
        <div style={{ flex: 1 }}></div>
      </div>
      
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
              <option value="errand">Errand</option>
              <option value="vendadmin">Vendor Admin</option>
              <option value="custadmin">Customer Admin</option>
              {isSuperAdmin&&<option value="superadmin">Super Admin</option>}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Speak Language</label>
            <select value={form.speak_lang || ''} onChange={e => setForm(f => ({ ...f, speak_lang: e.target.value }))}>
              <option value="">— Select Language —</option>
              {LANGS.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Keyboard Language</label>
            <input list="kbLangs" value={form.keyboard_lang||''} onChange={e=>setForm(f=>({...f,keyboard_lang:e.target.value}))} placeholder="e.g. en"/>
            <datalist id="kbLangs">{LANGS.map(l=><option key={l.v} value={l.v}>{l.l}</option>)}</datalist>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Cell Phone</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={phoneExt} onChange={e => setPhoneExt(e.target.value)} style={{ width: '135px' }}>
                {COUNTRY_EXTS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
              <input type="tel" value={phoneNum} onChange={e => setPhoneNum(e.target.value)} placeholder="Phone number" style={{ flex: 1 }} />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>WhatsApp Number</span>
              <button 
                type="button" 
                onClick={() => { setWaExt(phoneExt); setWaNum(phoneNum); }} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
              >
                Same as Cell Phone
              </button>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={waExt} onChange={e => setWaExt(e.target.value)} style={{ width: '135px' }}>
                {COUNTRY_EXTS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
              <input type="tel" value={waNum} onChange={e => setWaNum(e.target.value)} placeholder="WhatsApp number" style={{ flex: 1 }} />
            </div>
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
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Languages</th><th>Club</th><th>Actions</th></tr></thead>
          <tbody>{filteredRows.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No users found.</td></tr>
          :filteredRows.map(r=><tr key={r.user_id}>
            <td style={{fontWeight:500,color:'var(--text)'}}>{r.name||'—'}</td>
            <td style={{color:'var(--text2)'}}>{r.email}</td>
            <td><span className="badge badge-role" style={{ textTransform: 'none' }}>{r.role||'member'}</span></td>
            <td>
              {r.phone && <div style={{fontSize:'0.75rem', color:'var(--text2)'}}>📞 {r.phone}</div>}
              {r.user_whatsapp && <div style={{fontSize:'0.75rem', color:'var(--text2)'}}>💬 {r.user_whatsapp}</div>}
              {(!r.phone && !r.user_whatsapp) && <span style={{color:'var(--text3)', fontSize:'0.75rem'}}>—</span>}
            </td>
            <td>
              <div style={{fontSize:'0.75rem', color:'var(--text3)'}}>Speak: <span style={{color:'var(--text2)'}}>{r.speak_lang||'ml-IN'}</span></div>
              <div style={{fontSize:'0.75rem', color:'var(--text3)'}}>Kbd: <span style={{color:'var(--text2)'}}>{r.keyboard_lang||'en_GB'}</span></div>
            </td>
            <td>{clubSlug(r.club_id)}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); const pPhone = parsePhone(r.phone); setPhoneExt(pPhone.ext); setPhoneNum(pPhone.num); const pWa = parsePhone(r.user_whatsapp); setWaExt(pWa.ext); setWaNum(pWa.num); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              {isSuperAdmin&&<button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>}
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message={`Delete user "${del.name||del.email}"?`} onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
