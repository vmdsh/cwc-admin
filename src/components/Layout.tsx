import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAdminStore } from '../lib/store'
import { logoutAdmin } from '../lib/auth'
import type { Theme } from '../types/admin'

const NAV = [
  { section:'Overview', items:[{ path:'/dashboard', label:'Dashboard', icon:'📊' }]},
  { section:'Clubs', items:[
    { path:'/clubs',        label:'Clubs',           icon:'🏛️' },
    { path:'/categories',   label:'Categories',      icon:'📂' },
    { path:'/cat-images',   label:'Category Images', icon:'🖼️' },
  ]},
  { section:'Products', items:[
    { path:'/products',     label:'Products',        icon:'📦' },
    { path:'/members',      label:'Members',         icon:'👥' },
  ]},
  { section:'Marketplace', items:[
    { path:'/shops',        label:'Shops',           icon:'🛍️' },
    { path:'/shop-products',label:'Shop Products',   icon:'🔗' },
  ]},
  { section:'Delivery', items:[
    { path:'/routes',       label:'Routes',          icon:'🗺️' },
    { path:'/waypoints',    label:'Waypoints',       icon:'📍' },
    { path:'/movements',    label:'Movements',       icon:'🚚' },
    { path:'/mov-products', label:'Mov. Products',   icon:'📦' },
    { path:'/bookings',     label:'Bookings',        icon:'🛒' },
    { path:'/agent-loc',    label:'Agent Locations', icon:'📡' },
  ]},
  { section:'Users', items:[
    { path:'/users',           label:'Users',          icon:'👤' },
    { path:'/user-addresses',  label:'User Addresses', icon:'🏠' },
    { path:'/user-profiles',   label:'Mentor Profiles',icon:'🎓' },
  ]},
]

const THEMES:{ key:Theme; style:React.CSSProperties }[] = [
  { key:'dark',  style:{ background:'linear-gradient(135deg,#0d1b2a,#c9a84c)' }},
  { key:'fresh', style:{ background:'linear-gradient(135deg,#f7faf9,#1a7a5e)' }},
  { key:'bold',  style:{ background:'linear-gradient(135deg,#080808,#e63946)' }},
]

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { adminUser, isSuperAdmin, theme, setTheme } = useAdminStore()
  const handleLogout = () => {
    logoutAdmin(); useAdminStore.getState().setAdminUser(null); navigate('/login')
  }
  return (
    <div style={{minHeight:'100vh'}}>
      <div className="admin-topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">C</div>
          <div>
            <div className="topbar-title">CoworkClub Admin</div>
            <div className="topbar-sub">{isSuperAdmin?'Super Admin':'Club Admin'}</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">Signed in as&nbsp;<span style={{color:'var(--accent)',fontWeight:600}}>{adminUser?.name||adminUser?.email}</span></div>
          <div className="theme-switcher">
            {THEMES.map(t=>(
              <div key={t.key} className={`tbtn${theme===t.key?' on':''}`} style={t.style} onClick={()=>setTheme(t.key)} title={t.key}/>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>
      <div className="admin-wrap">
        <div className="admin-sidebar">
          {NAV.map(group=>(
            <div key={group.section}>
              <div className="sidebar-section">{group.section}</div>
              {group.items.map(item=>(
                <button key={item.path}
                  className={`sidebar-item${location.pathname===item.path?' active':''}`}
                  onClick={()=>navigate(item.path)}>
                  <span className="si-icon">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="admin-main"><Outlet/></div>
      </div>
    </div>
  )
}
