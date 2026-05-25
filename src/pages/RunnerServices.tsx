import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Select } from '../components/Select'
import type { RunnerService } from '../types/database'

const EMPTY: Partial<RunnerService> = {
  user_id: '',
  product_id: '',
  service_price: 0,
  service_uom: '',
  service_description: ''
}

export function RunnerServices() {
  const { 
    adminUser, 
    isSuperAdmin, 
    clubs, 
    clubOpts, 
    users, 
    products, 
    loadCaches, 
    clubName,
    userName 
  } = useAdminStore()

  // Club filter
  const clubOptions = clubOpts()
  const defaultClub = isSuperAdmin
    ? (clubOptions.length > 0 ? clubOptions[0].value : '')
    : (adminUser?.club_id ?? '')
  
  const [filterClub, setFilterClub] = useState<string>(defaultClub)
  
  // List state
  const [rows, setRows] = useState<RunnerService[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [form, setForm] = useState<Partial<RunnerService>>(EMPTY)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [del, setDel] = useState<RunnerService | null>(null)

  // Load runner services
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('runner_services')
      .select('*')
    if (error) {
      console.warn('Error loading runner services:', error)
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (clubs.length === 0 || users.length === 0 || products.length === 0) {
      loadCaches()
    }
  }, [])

  // Filter errand runners by selected club
  const errandRunners = users.filter(u => 
    u.role === 'errand' && (!filterClub || u.club_id === filterClub)
  )
  const runnerOptions = errandRunners.map(u => ({
    value: u.user_id,
    label: u.name || u.email
  }))

  // Filter service products by selected club
  const serviceProducts = products.filter(p => 
    p.service_type === 'S' && (!filterClub || p.club_id === filterClub)
  )
  const serviceOptions = serviceProducts.map(p => ({
    value: p.product_id,
    label: p.product_name
  }))

  // Local filtering of table rows based on selected club
  const filteredRows = rows.filter(r => {
    const runner = users.find(u => u.user_id === r.user_id)
    const product = products.find(p => p.product_id === r.product_id)
    if (filterClub) {
      const runnerClubId = runner?.club_id
      const productClubId = product?.club_id
      if (runnerClubId !== filterClub && productClubId !== filterClub) {
        return false
      }
    }
    return true
  })

  // Handle service product selection to auto-populate fields
  const handleServiceChange = (productId: string) => {
    const prod = products.find(p => p.product_id === productId)
    if (prod) {
      setForm(f => ({
        ...f,
        product_id: productId,
        service_price: prod.price,
        service_uom: prod.uom || '',
        service_description: prod.product_name
      }))
    } else {
      setForm(f => ({
        ...f,
        product_id: '',
        service_price: 0,
        service_uom: '',
        service_description: ''
      }))
    }
  }

  // Save record
  const save = async () => {
    if (!form.user_id || !form.product_id || form.service_price === undefined || !form.service_uom) {
      setErr('Runner, Service, Price, and Unit of Measure are required')
      return
    }
    setMsg('Saving…')
    setErr('')

    const payload = {
      user_id: form.user_id,
      product_id: form.product_id,
      service_price: Number(form.service_price),
      service_uom: form.service_uom,
      service_description: form.service_description || ''
    }

    let res
    if (form.id) {
      res = await supabase
        .from('runner_services')
        .update(payload)
        .eq('id', form.id)
    } else {
      res = await supabase
        .from('runner_services')
        .insert(payload)
    }

    const { error } = res
    if (error) {
      setErr(error.message)
      setMsg('')
    } else {
      setOpen(false)
      load()
    }
  }

  const doDelete = async () => {
    if (!del) return
    const { error } = await supabase
      .from('runner_services')
      .delete()
      .eq('id', del.id)
    if (error) {
      alert(error.message)
    } else {
      load()
    }
    setDel(null)
  }

  const openAdd = () => {
    setForm(EMPTY)
    setEditing(false)
    setOpen(true)
    setErr('')
    setMsg('')
  }

  const openEdit = (r: RunnerService) => {
    setForm(r)
    setEditing(true)
    setOpen(true)
    setErr('')
    setMsg('')
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Runner Services</div>
          <div className="section-sub">Manage service offerings assigned to errand runners · {filteredRows.length} services</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Runner Service</button>
      </div>

      {/* Filter controls */}
      <div className="filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ minWidth: '200px' }}>
          <label>Club</label>
          <Select 
            value={filterClub} 
            onChange={setFilterClub} 
            options={clubOptions} 
            placeholder="— All Clubs —"
            disabled={!isSuperAdmin && !!adminUser?.club_id}
          />
        </div>
        <div style={{ flex: 1 }}></div>
      </div>

      {open && (
        <div className="form-panel open">
          <div className="form-panel-title">{editing ? '✏️ Edit Runner Service' : '🏃 Add Runner Service'}</div>
          <div className="form-row">
            <div className="form-group">
              <label>Runner</label>
              <Select 
                value={form.user_id || ''} 
                onChange={v => setForm(f => ({ ...f, user_id: v }))} 
                options={runnerOptions} 
                placeholder="— Select Runner (Errand) —"
              />
            </div>
            <div className="form-group">
              <label>Service</label>
              <Select 
                value={form.product_id || ''} 
                onChange={handleServiceChange} 
                options={serviceOptions} 
                placeholder="— Select Service (Type S) —"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Service Price (₹)</label>
              <input 
                type="number" 
                value={form.service_price ?? ''} 
                onChange={e => setForm(f => ({ ...f, service_price: parseFloat(e.target.value) || 0 }))} 
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Unit of Measure</label>
              <input 
                type="text" 
                value={form.service_uom || ''} 
                onChange={e => setForm(f => ({ ...f, service_uom: e.target.value }))} 
                placeholder="e.g. hr, km, job"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Service Description</label>
            <textarea 
              value={form.service_description || ''} 
              onChange={e => setForm(f => ({ ...f, service_description: e.target.value }))} 
              placeholder="Provide details about the runner service..."
            />
          </div>
          <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            {err && <span className="msg err">{err}</span>}
            {msg && <span className="msg">{msg}</span>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty"><span className="spinner" />Loading…</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Runner Name</th>
                <th>Service Description</th>
                <th>UOM</th>
                <th>Price</th>
                {isSuperAdmin && !filterClub && <th>Club</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin && !filterClub ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)' }}>
                    No runner services found.
                  </td>
                </tr>
              ) : (
                filteredRows.map(r => {
                  const runner = users.find(u => u.user_id === r.user_id)
                  const runnerClub = runner ? clubName(runner.club_id) : '—'
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {userName(r.user_id)}
                      </td>
                      <td>{r.service_description || '—'}</td>
                      <td>{r.service_uom}</td>
                      <td>₹{Number(r.service_price).toLocaleString('en-IN')}</td>
                      {isSuperAdmin && !filterClub && <td>{runnerClub}</td>}
                      <td className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)} style={{ marginRight: '.5rem' }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDel(r)}>Remove</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {del && (
        <ConfirmDialog 
          message="Are you sure you want to remove this runner service?" 
          onConfirm={doDelete} 
          onCancel={() => setDel(null)} 
        />
      )}
    </div>
  )
}
