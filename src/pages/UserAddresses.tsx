import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { UserAddress } from '../types/database'
const E:Partial<UserAddress>={ user_id:'', label:'', address:'', landmark:'', lat:null, lng:null, is_default:false }
export function UserAddresses() {
  const { userOpts, userName } = useAdminStore()
  const [rows,setRows]=useState<UserAddress[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<UserAddress>>(E); const [editing,setEditing]=useState(false)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [del,setDel]=useState<UserAddress|null>(null)
  const load=async()=>{ setLoading(true); const{data}=await supabase.from('user_addresses').select('*').order('created_at',{ascending:false}); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const save=async()=>{
    if(!form.address){ setErr('Address required'); return }
    setMsg('Saving…'); setErr('')
    const p={ user_id:form.user_id||null, label:form.label||'', address:form.address!, landmark:form.landmark||null, lat:form.lat??null, lng:form.lng??null, is_default:form.is_default??false }
    const{error}=editing&&form.address_id ? await supabase.from('user_addresses').update(p).eq('address_id',form.address_id) : await supabase.from('user_addresses').insert(p)
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  const doDelete=async()=>{ if(!del) return; await supabase.from('user_addresses').delete().eq('address_id',del.address_id); setDel(null); load() }
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">User Addresses</div><div className="section-sub">{rows.length} addresses</div></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{ setForm(E); setEditing(false); setOpen(true); setErr(''); setMsg('') }}>+ Add Address</button>
      </div>
      {open&&<div className="form-panel open">
        <div className="form-panel-title">✏️ {editing?'Edit':'Add'} Address</div>
        <div className="form-row">
          <div className="form-group"><label>User</label><Select value={form.user_id||''} onChange={v=>setForm(f=>({...f,user_id:v}))} options={userOpts()} placeholder="— Select User —"/></div>
          <div className="form-group"><label>Label</label><input value={form.label||''} onChange={e=>setForm(f=>({...f,label:e.target.value}))} placeholder="Home, Office…"/></div>
        </div>
        <div className="form-group"><label>Full Address</label><textarea value={form.address||''} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="House no, street…" style={{minHeight:60}}/></div>
        <div className="form-group"><label>Landmark</label><input value={form.landmark||''} onChange={e=>setForm(f=>({...f,landmark:e.target.value}))} placeholder="Near…"/></div>
        <div className="form-row-3">
          <div className="form-group"><label>Latitude</label><input type="number" step="any" value={form.lat??''} onChange={e=>setForm(f=>({...f,lat:e.target.value?parseFloat(e.target.value):null}))} placeholder="11.8745"/></div>
          <div className="form-group"><label>Longitude</label><input type="number" step="any" value={form.lng??''} onChange={e=>setForm(f=>({...f,lng:e.target.value?parseFloat(e.target.value):null}))} placeholder="75.3704"/></div>
          <div className="form-group"><label>Default?</label>
            <select value={form.is_default?'true':'false'} onChange={e=>setForm(f=>({...f,is_default:e.target.value==='true'}))}>
              <option value="false">No</option><option value="true">Yes</option>
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
          <thead><tr><th>User</th><th>Label</th><th>Address</th><th>Landmark</th><th>Lat</th><th>Lng</th><th>Default</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={8} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No addresses.</td></tr>
          :rows.map(r=><tr key={r.address_id}>
            <td style={{fontWeight:500,color:'var(--text)'}}>{userName(r.user_id)}</td>
            <td><span className="badge badge-role">{r.label||'—'}</span></td>
            <td style={{color:'var(--text2)',fontSize:'.78rem',maxWidth:200}}>{r.address}</td>
            <td style={{color:'var(--text3)',fontSize:'.75rem'}}>{r.landmark||'—'}</td>
            <td style={{fontFamily:'monospace',fontSize:'.72rem',color:'var(--text3)'}}>{r.lat??'—'}</td>
            <td style={{fontFamily:'monospace',fontSize:'.72rem',color:'var(--text3)'}}>{r.lng??'—'}</td>
            <td>{r.is_default?<span className="badge badge-active">Default</span>:'—'}</td>
            <td className="td-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>{ setForm(r); setEditing(true); setOpen(true); setErr(''); setMsg('') }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message="Delete this address?" onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
