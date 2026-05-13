# ClubImagePrompts.tsx Component Blueprint

## Component Structure

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { ClubImagePrompt } from '../types/database'

// Empty form template
const EMPTY: Partial<ClubImagePrompt> = {
  club_id: '',
  image_type: '',
  image_spec: '',
  image_prompt: '',
  image_layout: '',
  image_output: ''
}

export function ClubImagePrompts() {
  const { adminUser, isSuperAdmin, clubOpts, clubName } = useAdminStore()
  const opts = clubOpts()
  
  // Club filter state
  const [filterClub, setFilterClub] = useState<string>(
    isSuperAdmin ? (opts.length > 0 ? opts[0].value : '') : (adminUser?.club_id ?? '')
  )
  
  // Data state
  const [rows, setRows] = useState<ClubImagePrompt[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form state
  const [form, setForm] = useState<Partial<ClubImagePrompt>>(EMPTY)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [delPrompt, setDelPrompt] = useState<ClubImagePrompt | null>(null)
  
  // Load prompts
  const load = async () => {
    setLoading(true)
    let q = supabase.from('club_image_prompts').select('*').order('created_at', { ascending: false })
    
    if (!isSuperAdmin && adminUser?.club_id) {
      q = q.eq('club_id', adminUser.club_id)
    } else if (isSuperAdmin && filterClub) {
      q = q.eq('club_id', filterClub)
    }
    
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }
  
  useEffect(() => { load() }, [filterClub])
  
  // Form handlers
  const openAdd = () => {
    setForm({ 
      ...EMPTY, 
      club_id: isSuperAdmin ? (filterClub || '') : adminUser?.club_id || '' 
    })
    setEditing(false)
    setOpen(true)
    setErr(''); setMsg('')
  }
  
  const openEdit = (r: ClubImagePrompt) => {
    setForm(r)
    setEditing(true)
    setOpen(true)
    setErr(''); setMsg('')
  }
  
  const save = async () => {
    if (!form.club_id) { setErr('Club is required'); return }
    if (!form.image_type) { setErr('Image Type is required'); return }
    
    setMsg('Saving…'); setErr('')
    
    try {
      if (editing && form.prompt_id) {
        const { error } = await supabase
          .from('club_image_prompts')
          .update({
            image_type: form.image_type,
            image_spec: form.image_spec,
            image_prompt: form.image_prompt,
            image_layout: form.image_layout,
            image_output: form.image_output
          })
          .eq('prompt_id', form.prompt_id)
        if (error) throw error
        setMsg('Updated successfully')
      } else {
        const { error } = await supabase
          .from('club_image_prompts')
          .insert([{
            club_id: form.club_id,
            image_type: form.image_type,
            image_spec: form.image_spec,
            image_prompt: form.image_prompt,
            image_layout: form.image_layout,
            image_output: form.image_output
          }])
        if (error) throw error
        setMsg('Created successfully')
      }
      
      setTimeout(() => {
        setOpen(false)
        load()
      }, 800)
    } catch (e: any) {
      setErr(e.message || 'Save failed')
      setMsg('')
    }
  }
  
  const deletePrompt = async () => {
    if (!delPrompt) return
    const { error } = await supabase
      .from('club_image_prompts')
      .delete()
      .eq('prompt_id', delPrompt.prompt_id)
    if (!error) {
      setDelPrompt(null)
      load()
    }
  }
  
  // Render
  return (
    <div>
      {/* Header with club selector */}
      <div className="section-header">
        <div>
          <div className="section-title">Club Image Prompts</div>
          <div className="section-sub">Manage AI image generation prompts</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Prompt</button>
      </div>
      
      {/* Club selector for super admins */}
      {isSuperAdmin && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            Club Filter
          </span>
          <select
            value={filterClub}
            onChange={e => setFilterClub(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.35rem .75rem', fontSize: '.85rem', minWidth: 220 }}
          >
            <option value="">— All Clubs —</option>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {loading && <span className="spinner" style={{ marginLeft: '.5rem' }} />}
        </div>
      )}
      
      {/* Data table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>Loading prompts…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>
            No prompts found. {isSuperAdmin && !filterClub ? 'Select a club to see prompts.' : 'Click "Add Prompt" to create one.'}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image Type</th>
                <th>Image Spec</th>
                <th>Image Output</th>
                <th>Club</th>
                <th>Created</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.prompt_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.image_type || '—'}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 2 }}>
                      {r.image_layout ? `Layout: ${r.image_layout}` : 'No layout'}
                    </div>
                  </td>
                  <td>
                    <div style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.image_spec || '—'}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-role">{r.image_output || '—'}</span>
                  </td>
                  <td>{clubName(r.club_id)}</td>
                  <td>
                    <div style={{ fontSize: '.75rem', color: 'var(--text3)' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                      <button className="btn btn-ghost btn-sm btn-danger" onClick={() => setDelPrompt(r)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Form modal */}
      {open && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Edit Prompt' : 'Add New Prompt'}</div>
              <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {err && <div className="alert alert-error">{err}</div>}
              {msg && <div className="alert alert-success">{msg}</div>}
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* Club field */}
                <div>
                  <label className="form-label">Club</label>
                  {isSuperAdmin ? (
                    <select
                      value={form.club_id}
                      onChange={e => setForm({ ...form, club_id: e.target.value })}
                      className="form-select"
                      disabled={editing}
                    >
                      <option value="">Select Club</option>
                      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <div style={{ padding: '.5rem', background: 'var(--bg2)', borderRadius: 6 }}>
                      {clubName(adminUser?.club_id)}
                    </div>
                  )}
                </div>
                
                {/* Image Type */}
                <div>
                  <label className="form-label">Image Type <span style={{ color: 'var(--accent)' }}>*</span></label>
                  <input
                    type="text"
                    value={form.image_type || ''}
                    onChange={e => setForm({ ...form, image_type: e.target.value })}
                    className="form-input"
                    placeholder="e.g., banner, thumbnail, profile"
                    maxLength={30}
                  />
                  <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 4 }}>
                    Max 30 characters
                  </div>
                </div>
                
                {/* Image Spec */}
                <div>
                  <label className="form-label">Image Specification</label>
                  <textarea
                    value={form.image_spec || ''}
                    onChange={e => setForm({ ...form, image_spec: e.target.value })}
                    className="form-textarea"
                    placeholder="Detailed specifications for the image"
                    rows={4}
                  />
                </div>
                
                {/* Image Prompt */}
                <div>
                  <label className="form-label">Image Prompt (AI)</label>
                  <textarea
                    value={form.image_prompt || ''}
                    onChange={e => setForm({ ...form, image_prompt: e.target.value })}
                    className="form-textarea"
                    placeholder="AI prompt for image generation"
                    rows={6}
                  />
                </div>
                
                {/* Image Layout */}
                <div>
                  <label className="form-label">Image Layout</label>
                  <textarea
                    value={form.image_layout || ''}
                    onChange={e => setForm({ ...form, image_layout: e.target.value })}
                    className="form-textarea"
                    placeholder="Layout details, composition notes"
                    rows={3}
                  />
                </div>
                
                {/* Image Output */}
                <div>
                  <label className="form-label">Image Output Format</label>
                  <input
                    type="text"
                    value={form.image_output || ''}
                    onChange={e => setForm({ ...form, image_output: e.target.value })}
                    className="form-input"
                    placeholder="jpg, png, webp"
                    maxLength={30}
                  />
                  <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginTop: 4 }}>
                    File format (jpg, png, etc.)
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!!msg}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete confirmation */}
      {delPrompt && (
        <ConfirmDialog
          title="Delete Prompt"
          message={`Are you sure you want to delete the prompt "${delPrompt.image_type}"?`}
          onConfirm={deletePrompt}
          onCancel={() => setDelPrompt(null)}
        />
      )}
    </div>
  )
}
```

## Key Features

1. **Club Selector**: For super admins to filter prompts by club, matching the pattern used in other admin pages.

2. **Grid/List Display**: Shows image_type, image_spec (truncated), image_output, club name, and creation date.

3. **CRUD Operations**:
   - **Create**: Add new prompts with all fields
   - **Read**: Display prompts with filtering
   - **Update**: Edit existing prompts
   - **Delete**: Confirm before deletion

4. **Form Validation**:
   - Club and Image Type are required
   - Character limits enforced (30 chars for image_type and image_output)
   - Appropriate textarea sizes for different fields

5. **User Permissions**:
   - Super admins can select any club
   - Club admins only see/operate on their club's prompts
   - Club field is readonly for club admins

6. **UI Consistency**:
   - Uses existing admin CSS classes
   - Matches styling of other CRUD pages
   - Responsive design

## Integration Points

1. **Route**: `/club-prompts`
2. **Navigation**: Under "Clubs" section with 🎨 icon
3. **Database**: `club_image_prompts` table
4. **Types**: `ClubImagePrompt` interface in `database.ts`

## Testing Notes

- Verify club filtering works for super admins
- Test CRUD operations end-to-end
- Check form validation messages
- Ensure responsive design on different screen sizes
- Confirm navigation item appears correctly