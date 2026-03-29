import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { ProductUser } from '../types/database'
export function Members() {
  const { prodName, userName } = useAdminStore()
  const [rows,setRows]=useState<ProductUser[]>([]); const [loading,setLoading]=useState(true)
  const [del,setDel]=useState<ProductUser|null>(null)
  const load=async()=>{ setLoading(true); const{data}=await supabase.from('product_users').select('*'); setRows(data||[]); setLoading(false) }
  useEffect(()=>{ load() },[])
  const doDelete=async()=>{ if(!del) return; await supabase.from('product_users').delete().eq('product_user_id',del.product_user_id); setDel(null); load() }
  return (
    <div>
      <div className="section-header"><div><div className="section-title">Community Members</div><div className="section-sub">{rows.length} memberships</div></div></div>
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>User</th><th>Product</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No memberships.</td></tr>
          :rows.map(r=><tr key={r.product_user_id}>
            <td>{userName(r.user_id)}</td><td>{prodName(r.product_id)}</td>
            <td>{r.is_admin?<span className="badge badge-active">Admin</span>:<span className="badge badge-inactive">Member</span>}</td>
            <td style={{color:'var(--text3)',fontSize:'.72rem'}}>{r.joined_at?new Date(r.joined_at).toLocaleDateString():'—'}</td>
            <td className="td-actions"><button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Remove</button></td>
          </tr>)}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message="Remove this member?" onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
