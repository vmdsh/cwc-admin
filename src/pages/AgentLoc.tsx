import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import type { AgentLocation } from '../types/database'
export function AgentLoc() {
  const { userName, movementLabel, loadDeliveryCaches } = useAdminStore()
  const [rows,setRows]=useState<AgentLocation[]>([]); const [loading,setLoading]=useState(true)
  const [ts,setTs]=useState(new Date())
  const load=async()=>{ setLoading(true); await loadDeliveryCaches(); const{data}=await supabase.from('agent_locations').select('*'); setRows(data||[]); setTs(new Date()); setLoading(false) }
  useEffect(()=>{ load() },[])
  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Agent Locations</div><div className="section-sub">Live GPS · read-only · {rows.length} agents</div></div>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
      </div>
      <div style={{background:'var(--bg3)',border:'1px solid var(--border)',padding:'.75rem 1rem',marginBottom:'1.2rem',fontSize:'.78rem',color:'var(--text2)',display:'flex',alignItems:'center',gap:'.5rem'}}>
        📡 Updated by Flutter app — <strong style={{color:'var(--text)'}}>read-only</strong> · Last: <strong style={{color:'var(--accent)'}}>{ts.toLocaleTimeString()}</strong>
      </div>
      {loading?<div className="empty"><span className="spinner"/>Loading…</div>:(
        <div className="tbl-wrap"><table>
          <thead><tr><th>Driver</th><th>Movement</th><th>Lat</th><th>Lng</th><th>Online</th><th>Last Updated</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No agent data yet.</td></tr>
          :rows.map(r=><tr key={r.id}>
            <td style={{fontWeight:500,color:'var(--text)'}}>{userName(r.driver_id)}</td>
            <td style={{fontSize:'.78rem'}}>{movementLabel(r.movement_id)}</td>
            <td style={{fontFamily:'monospace',fontSize:'.75rem',color:'var(--text3)'}}>{r.lat??'—'}</td>
            <td style={{fontFamily:'monospace',fontSize:'.75rem',color:'var(--text3)'}}>{r.lng??'—'}</td>
            <td>{r.is_online?<span className="badge badge-active">● Online</span>:<span className="badge badge-inactive">○ Offline</span>}</td>
            <td style={{color:'var(--text3)',fontSize:'.72rem'}}>{r.updated_at?new Date(r.updated_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}):'—'}</td>
          </tr>)}</tbody>
        </table></div>
      )}
    </div>
  )
}
