import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAdminStore } from './lib/store'
import { restoreAdminSession } from './lib/auth'
import { Layout }      from './components/Layout'
import { LoginPage }   from './components/LoginPage'
import { Dashboard }   from './pages/Dashboard'
import { Clubs }       from './pages/Clubs'
import { Categories }  from './pages/Categories'
import { Products }    from './pages/Products'
import { Members }     from './pages/Members'
import { Shops }       from './pages/Shops'
import { ShopProducts }from './pages/ShopProducts'
import { Routes as RoutesPage } from './pages/Routes'
import { Waypoints }   from './pages/Waypoints'
import { Movements }   from './pages/Movements'
import { MovProducts } from './pages/MovProducts'
import { Bookings }    from './pages/Bookings'
import { AgentLoc }    from './pages/AgentLoc'
import { Users }       from './pages/Users'
import { UserAddresses }from './pages/UserAddresses'
import { UserProfiles } from './pages/UserProfiles'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const adminUser = useAdminStore(s => s.adminUser)
  return adminUser ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { setAdminUser, loadCaches, setTheme } = useAdminStore()

  useEffect(() => {
    // Apply saved theme immediately
    const saved = localStorage.getItem('cwc_theme') as 'dark' | 'fresh' | 'bold' | null
    if (saved) setTheme(saved)
    // Restore session
    const user = restoreAdminSession()
    if (user) { setAdminUser(user); loadCaches() }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index               element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="clubs"        element={<Clubs />} />
          <Route path="categories"   element={<Categories />} />
          <Route path="products"     element={<Products />} />
          <Route path="members"      element={<Members />} />
          <Route path="shops"        element={<Shops />} />
          <Route path="shop-products"element={<ShopProducts />} />
          <Route path="routes"       element={<RoutesPage />} />
          <Route path="waypoints"    element={<Waypoints />} />
          <Route path="movements"    element={<Movements />} />
          <Route path="mov-products" element={<MovProducts />} />
          <Route path="bookings"     element={<Bookings />} />
          <Route path="agent-loc"    element={<AgentLoc />} />
          <Route path="users"        element={<Users />} />
          <Route path="user-addresses" element={<UserAddresses />} />
          <Route path="user-profiles"  element={<UserProfiles />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
