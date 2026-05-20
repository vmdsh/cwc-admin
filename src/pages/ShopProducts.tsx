import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { ShopProduct } from '../types/database'
const E:Partial<ShopProduct>={ shop_id:'', product_id:'', price_override:null, is_available:true, stock_qty:1 }
export function ShopProducts() {
  const { adminUser, isSuperAdmin, clubs, clubOpts, shopOpts, prodOpts, shopName, prodName, shops, products, loadCaches } = useAdminStore()
  
  // Club filter
  const clubOptions = clubOpts()
  const defaultClub = isSuperAdmin
    ? (clubOptions.length > 0 ? clubOptions[0].value : '')
    : (adminUser?.club_id ?? '')
  const [filterClub, setFilterClub] = useState<string>(defaultClub)
  
  // Shop filter (filtered by selected club)
  const [filterShop, setFilterShop] = useState<string>('')
  
  const [rows,setRows]=useState<ShopProduct[]>([]); const [loading,setLoading]=useState(true)
  const [form,setForm]=useState<Partial<ShopProduct>>(E)
  const [open,setOpen]=useState(false); const [err,setErr]=useState(''); const [msg,setMsg]=useState('')
  const [editing,setEditing]=useState(false)
  const [del,setDel]=useState<ShopProduct|null>(null)
  
  // Get shops filtered by selected club
  const filteredShops = filterClub
    ? shops.filter(sh => sh.club_id === filterClub)
    : shops
  
  const shopOptions = filteredShops.map(sh => ({ value: sh.shop_id, label: sh.shop_name }))
  
  const load=async()=>{ 
    setLoading(true); 
    let q = supabase.from('shop_products').select('*')
    
    // If shop filter is selected, filter by shop
    if (filterShop) {
      q = q.eq('shop_id', filterShop)
    } 
    // Otherwise if club filter is selected, filter by shops in that club
    else if (filterClub) {
      const shopIds = filteredShops.map(sh => sh.shop_id)
      if (shopIds.length > 0) {
        q = q.in('shop_id', shopIds)
      } else {
        // No shops in this club, return empty
        setRows([])
        setLoading(false)
        return
      }
    }
    
    const{data}=await q; 
    setRows(data||[]); 
    setLoading(false) 
  }
  
  useEffect(()=>{ load() },[filterClub, filterShop])

  useEffect(() => {
    if (clubs.length === 0 || shops.length === 0 || products.length === 0) {
      loadCaches()
    }
  }, [])
  
  const save=async()=>{
    if(!form.shop_id||!form.product_id){ setErr('Shop and Product required'); return }
    setMsg('Saving…'); setErr('')

    const product = products.find(p => p.product_id === form.product_id)
    const isService = product ? product.service_type !== 'I' : false

    const qty = form.stock_qty !== undefined ? form.stock_qty : (isService ? 0 : 1)
    if (qty < 0) {
      setErr('Quantity cannot be negative')
      setMsg('')
      return
    }
    if (!isService && qty <= 0) {
      setErr('Physical items must have a quantity of at least 1')
      setMsg('')
      return
    }

    const payload = {
      shop_id: form.shop_id!,
      product_id: form.product_id!,
      price_override: form.price_override ?? null,
      is_available: form.is_available ?? true,
      stock_qty: qty
    }

    let res
    if (form.id) {
      res = await supabase.from('shop_products').update(payload).eq('id', form.id)
    } else {
      res = await supabase.from('shop_products').insert(payload)
    }

    const { error } = res
    if(error){ setErr(error.message); setMsg(''); return }
    setOpen(false); load()
  }
  
  const doDelete=async()=>{ if(!del) return; await supabase.from('shop_products').delete().eq('id',del.id); setDel(null); load() }

  const openAdd = () => {
    setForm(E)
    setEditing(false)
    setOpen(true)
    setErr('')
    setMsg('')
  }

  const openEdit = (r: ShopProduct) => {
    setForm(r)
    setEditing(true)
    setOpen(true)
    setErr('')
    setMsg('')
  }
  
  const product = products.find(p => p.product_id === form.product_id)
  const isService = product ? product.service_type !== 'I' : false

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Shop Products</div><div className="section-sub">Link products to shops · {rows.length} links</div></div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Link Product</button>
      </div>
      
      {/* Filter controls */}
      <div className="filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ minWidth: '200px' }}>
          <label>Club</label>
          <Select 
            value={filterClub} 
            onChange={v => { 
              setFilterClub(v)
              setFilterShop('') // Reset shop filter when club changes
            }} 
            options={clubOptions} 
            placeholder="— All Clubs —"
            disabled={!isSuperAdmin && !!adminUser?.club_id}
          />
        </div>
        <div className="form-group" style={{ minWidth: '200px' }}>
          <label>Shop</label>
          <Select 
            value={filterShop} 
            onChange={setFilterShop} 
            options={[{ value: '', label: '— All Shops —' }, ...shopOptions]} 
            placeholder="— Select Shop —"
            disabled={!filterClub}
          />
        </div>
        <div style={{ flex: 1 }}></div>
      </div>
      
      {open&&<div className="form-panel open">
        <div className="form-panel-title">{editing ? '✏️ Edit Shop Product Link' : '🔗 Link Product to Shop'}</div>
        <div className="form-row">
          <div className="form-group"><label>Shop</label><Select value={form.shop_id||''} onChange={v=>setForm(f=>({...f,shop_id:v}))} options={shopOpts()} placeholder="— Select Shop —" disabled={editing}/></div>
          <div className="form-group"><label>Product</label><Select value={form.product_id||''} onChange={v=>setForm(f=>({...f,product_id:v}))} options={prodOpts()} placeholder="— Select Product —" disabled={editing}/></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Price Override (₹) — optional</label>
            <input type="number" value={form.price_override??''} onChange={e=>setForm(f=>({...f,price_override:e.target.value?parseFloat(e.target.value):null}))} placeholder="Leave blank to use product price"/>
          </div>
          <div className="form-group">
            <label>Stock Quantity {isService && <span style={{color:'var(--accent)',fontSize:'.75rem'}}>(Service: can be 0)</span>}</label>
            <input type="number" min="0" value={form.stock_qty??''} onChange={e=>setForm(f=>({...f,stock_qty:e.target.value?parseInt(e.target.value):0}))} placeholder={isService ? "0" : "1"}/>
          </div>
          <div className="form-group">
            <label>Available</label>
            <select value={form.is_available?'true':'false'} onChange={e=>setForm(f=>({...f,is_available:e.target.value==='true'}))}>
              <option value="true">Yes</option><option value="false">No</option>
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
          <thead><tr><th>Shop</th><th>Product</th><th>Price Override</th><th>Stock Qty</th><th>Available</th><th>Actions</th></tr></thead>
          <tbody>{rows.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:'2rem',color:'var(--text3)'}}>No links yet.</td></tr>
          :rows.map(r=>{
            const isSvc = (() => {
              const p = products.find(prod => prod.product_id === r.product_id)
              return p ? p.service_type !== 'I' : false
            })()
            return (
              <tr key={r.id}>
                <td>{shopName(r.shop_id)}</td>
                <td>{prodName(r.product_id)}</td>
                <td>{r.price_override!=null?`₹${Number(r.price_override).toLocaleString('en-IN')}`:'—'}</td>
                <td>
                  {r.stock_qty ?? 0}
                  {isSvc && <span style={{ marginLeft: '.35rem', color: 'var(--accent)', fontSize: '.7rem', fontWeight: 600 }}>SVC</span>}
                </td>
                <td>{r.is_available?<span className="badge badge-active">Yes</span>:<span className="badge badge-inactive">No</span>}</td>
                <td className="td-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)} style={{ marginRight: '.5rem' }}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>setDel(r)}>Remove</button>
                </td>
              </tr>
            )
          })}</tbody>
        </table></div>
      )}
      {del&&<ConfirmDialog message="Remove this link?" onConfirm={doDelete} onCancel={()=>setDel(null)}/>}
    </div>
  )
}
