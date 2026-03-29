import { create } from 'zustand'
import { supabase } from './supabase'
import type { AdminUser, Theme } from '../types/admin'
import type { Club, ProductCategory, Product, Shop, User, Route, RouteMovement } from '../types/database'

interface Opt { value: string; label: string }

interface AdminStore {
  adminUser: AdminUser | null; isSuperAdmin: boolean
  setAdminUser: (u: AdminUser | null) => void
  theme: Theme; setTheme: (t: Theme) => void
  clubs: Club[]; categories: ProductCategory[]; products: Product[]
  shops: Shop[]; users: User[]; routes: Route[]; movements: RouteMovement[]
  loadCaches: () => Promise<void>
  loadDeliveryCaches: () => Promise<void>
  clubName: (id?: string | null) => string
  catName:  (id?: string | null) => string
  prodName: (id?: string | null) => string
  shopName: (id?: string | null) => string
  userName: (id?: string | null) => string
  routeName:(id?: string | null) => string
  movementLabel:(id?: string | null) => string
  clubOpts: (sel?: string) => Opt[]
  catOpts:  (sel?: string, clubId?: string) => Opt[]
  prodOpts: (sel?: string) => Opt[]
  shopOpts: (sel?: string) => Opt[]
  userOpts: (sel?: string) => Opt[]
  routeOpts:(sel?: string) => Opt[]
  movementOpts:(sel?: string) => Opt[]
}

const s = (id?: string | null) => id ? id.slice(0,8)+'…' : '—'

export const useAdminStore = create<AdminStore>((set, get) => ({
  adminUser: null, isSuperAdmin: false,
  setAdminUser: (u) => set({ adminUser: u, isSuperAdmin: u?.role === 'superadmin' }),

  theme: (localStorage.getItem('cwc_theme') as Theme) || 'dark',
  setTheme: (t) => { localStorage.setItem('cwc_theme', t); document.body.setAttribute('data-theme', t); set({ theme: t }) },

  clubs:[], categories:[], products:[], shops:[], users:[], routes:[], movements:[],

  loadCaches: async () => {
    const { adminUser, isSuperAdmin } = get()
    try {
      let cq = supabase.from('clubs').select('*')
      if (!isSuperAdmin && adminUser?.club_id) cq = cq.eq('club_id', adminUser.club_id)
      const [{ data: clubs },{ data: cats },{ data: prods },{ data: shps },{ data: usrs }] = await Promise.all([
        cq,
        supabase.from('product_categories').select('*'),
        supabase.from('products').select('*'),
        supabase.from('shops').select('*'),
        supabase.from('users').select('*'),
      ])
      set({
        clubs: clubs||[],
        categories: (cats||[]).filter((c:ProductCategory)=> isSuperAdmin||c.club_id===adminUser?.club_id),
        products:   (prods||[]).filter((p:Product)=> isSuperAdmin||p.club_id===adminUser?.club_id),
        shops:      (shps||[]).filter((sh:Shop)=> isSuperAdmin||sh.club_id===adminUser?.club_id),
        users: usrs||[],
      })
    } catch(e){ console.warn('cache:', e) }
  },

  loadDeliveryCaches: async () => {
    const { adminUser, isSuperAdmin } = get()
    try {
      const [{ data: rt },{ data: mv }] = await Promise.all([
        supabase.from('routes').select('*').order('route_name'),
        supabase.from('route_movements').select('*'),
      ])
      set({
        routes:    (rt||[]).filter((r:Route)=> isSuperAdmin||r.club_id===adminUser?.club_id),
        movements: mv||[],
      })
    } catch(e){ console.warn('delivery cache:', e) }
  },

  clubName:  (id) => get().clubs.find(c=>c.club_id===id)?.club_name || s(id),
  catName:   (id) => get().categories.find(c=>c.category_id===id)?.category_name || s(id),
  prodName:  (id) => get().products.find(p=>p.product_id===id)?.product_name || s(id),
  shopName:  (id) => get().shops.find(sh=>sh.shop_id===id)?.shop_name || s(id),
  userName:  (id) => { const u=get().users.find(u=>u.user_id===id); return u?(u.name||u.email):s(id) },
  routeName: (id) => get().routes.find(r=>r.route_id===id)?.route_name || s(id),
  movementLabel:(id) => { const m=get().movements.find(x=>x.movement_id===id); return m?`${get().routeName(m.route_id)} · ${m.movement_date}`:s(id) },

  clubOpts:  () => get().clubs.map(c=>({ value:c.club_id, label:`${c.flag_emoji||''} ${c.club_name}`.trim() })),
  catOpts:   (_='', clubId='') => {
    const list = clubId ? get().categories.filter(c=>c.club_id===clubId) : get().categories
    return list.map(c=>({ value:c.category_id, label:c.category_name }))
  },
  prodOpts:  () => get().products.map(p=>({ value:p.product_id, label:p.product_name })),
  shopOpts:  () => get().shops.map(sh=>({ value:sh.shop_id, label:sh.shop_name })),
  userOpts:  () => get().users.map(u=>({ value:u.user_id, label:u.name||u.email })),
  routeOpts: () => get().routes.map(r=>({ value:r.route_id, label:r.route_name })),
  movementOpts: () => get().movements.map(m=>({ value:m.movement_id, label:`${get().routeName(m.route_id)} · ${m.movement_date} [${m.status}]` })),
}))
