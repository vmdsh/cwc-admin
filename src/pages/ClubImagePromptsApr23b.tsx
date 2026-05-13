import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAdminStore } from '../lib/store'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { uploadImage } from '../lib/upload'
import type { ClubImagePrompt } from '../types/database'

// Empty form template
const EMPTY: Partial<ClubImagePrompt> = {
    club_id: '',
    image_type: '',
    image_spec: '',
    image_prompt: '',
    image_layout: '',
    image_output: '',
    image_title: '',
    image_id: '',
    image_url: '',
    image_nos: 1
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
    const [isAiProcessing, setIsAiProcessing] = useState(false)
    const [delPrompt, setDelPrompt] = useState<ClubImagePrompt | null>(null)
    const [masterImages, setMasterImages] = useState<any[]>([])

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

    const loadMasters = async () => {
        const { data } = await supabase
            .from('club_images')
            .select('image_id, caption, image_url')
            .eq('slug', 'master')
        setMasterImages(data || [])
    }

    useEffect(() => {
        load()
        loadMasters()
    }, [filterClub])

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
                        image_output: form.image_output,
                        image_title: form.image_title,
                        image_id: form.image_id,
                        image_url: form.image_url,
                        image_nos: form.image_nos
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
                        image_output: form.image_output,
                        image_title: form.image_title,
                        image_id: form.image_id,
                        image_url: form.image_url,
                        image_nos: form.image_nos
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

    // ── ✨ AI Image Generation Logic ──

    const extractImageUrl = (response: any): string | null => {
        if (response.choices?.[0]?.message?.content) {
            const content = response.choices[0].message.content
            if (content.startsWith('http')) return content
            if (content.startsWith('data:image')) return content
            const urlMatch = content.match(/https?:\/\/[^\s]+/)
            if (urlMatch) return urlMatch[0]
        }
        if (response.data?.[0]?.url) return response.data[0].url
        if (response.data?.[0]?.b64_json) return `data:image/png;base64,${response.data[0].b64_json}`
        if (response.url) return response.url
        if (response.images?.[0]?.url) return response.images[0].url
        if (response.images?.[0]?.b64_json) return `data:image/png;base64,${response.images[0].b64_json}`
        return null
    }

    const uploadImageFromUrl = async (url: string, folder: string = 'clubs'): Promise<string> => {
        let blob: Blob
        if (url.startsWith('data:')) {
            const res = await fetch(url)
            blob = await res.blob()
        } else {
            const res = await fetch(url)
            if (!res.ok) throw new Error(`Failed to download image: ${res.statusText}`)
            blob = await res.blob()
        }
        const file = new File([blob], `ai-generated-${Date.now()}.png`, { type: blob.type || 'image/png' })
        return await uploadImage(file, folder)
    }

    const generateAiImage = async () => {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
        if (!apiKey) { setErr('API Key missing'); return }
        if (!form.image_prompt) { setErr('Prompt missing'); return }

        setIsAiProcessing(true); setErr(''); setMsg('🤖 Starting AI image generation...')

        try {
            // Split by :: to handle multi-part stories
            const promptParts = form.image_prompt.split('::').map(p => p.trim()).filter(p => p.length > 0)
            const total = promptParts.length

            for (let i = 0; i < total; i++) {
                setMsg(`✨ Generating image ${i + 1} of ${total}...`)

                const iRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": window.location.origin
                    },
                    body: JSON.stringify({
                        model: import.meta.env.VITE_IMAGE_MODEL_ID || "black-forest-labs/flux.2-pro",
                        modalities: ["image"],
                        messages: [{
                            role: "user",
                            content: form.image_url
                                ? [
                                    { type: "text", text: `${form.image_spec}. ${promptParts[i]}` },
                                    { type: "image_url", image_url: { url: form.image_url } }
                                ]
                                : promptParts[i]
                        }]
                    })
                })

                if (!iRes.ok) throw new Error(`Generation failed at part ${i + 1}`)

                const iData = await iRes.json()
                let imageUrl = extractImageUrl(iData)
                if (!imageUrl) throw new Error(`No image found for part ${i + 1}`)

                setMsg(`💾 Uploading image ${i + 1} to storage...`)
                let uploadedUrl = await uploadImageFromUrl(imageUrl, 'clubs')

                setMsg(`💾 Saving record ${i + 1}...`)
                const { error: insErr } = await supabase.from('club_images').insert({
                    club_id: form.club_id,
                    image_url: uploadedUrl,
                    caption: `${form.image_type || 'AI Prompt'} - Part ${i + 1}`,
                    prompt_id: form.prompt_id
                })

                if (insErr) throw insErr
            }

            setMsg(`✅ Successfully generated ${total} images!`)
        } catch (e: any) {
            setErr(`AI Generation Failed: ${e.message}`)
            setMsg('')
        } finally {
            setIsAiProcessing(false)
        }
    }

    // Render
    return (
        <div>
            <div className="section-header">
                <div>
                    <div className="section-title">Club Image Prompts</div>
                    <div className="section-sub">Manage AI image generation prompts</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Prompt</button>
            </div>

            {isSuperAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
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

            {loading ? (
                <div className="empty"><span className="spinner" />Loading prompts…</div>
            ) : rows.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text3)' }}>
                    No prompts found. {isSuperAdmin && !filterClub ? 'Select a club to see prompts.' : 'Click "Add Prompt" to create one.'}
                </div>
            ) : (
                <div className="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 60 }}>Image</th>
                                <th>Type & Title</th>
                                <th>Spec & Layout</th>
                                <th>Nos</th>
                                <th>Output</th>
                                <th>Club</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.prompt_id}>
                                    <td style={{ padding: '4px 12px' }}>
                                        {r.image_url ? (
                                            <img src={r.image_url} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} alt="" />
                                        ) : (
                                            <div style={{ width: 44, height: 44, background: 'var(--bg2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem', color: 'var(--text3)' }}>No Img</div>
                                        )}
                                    </td>
                                    <td style={{ padding: '4px 12px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{r.image_type || '—'}</div>
                                        <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: 1 }}>{r.image_title || '—'}</div>
                                    </td>
                                    <td style={{ padding: '4px 12px' }}>
                                        <div style={{ fontSize: '.75rem', color: 'var(--text2)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.image_spec || '—'}
                                        </div>
                                        <div style={{ fontSize: '.7rem', color: 'var(--text3)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                            {r.image_layout || '—'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '4px 12px' }}>
                                        <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{r.image_nos || 1}</span>
                                    </td>
                                    <td style={{ padding: '4px 12px' }}>
                                        <span className="badge badge-role" style={{ padding: '2px 6px', fontSize: '.65rem' }}>{r.image_output || '—'}</span>
                                    </td>
                                    <td style={{ padding: '4px 12px' }}>
                                        <div style={{ fontSize: '.8rem' }}>{clubName(r.club_id)}</div>
                                    </td>
                                    <td className="td-actions" style={{ padding: '4px 12px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '.75rem' }} onClick={() => openEdit(r)}>Edit</button>
                                            <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: '.75rem' }} onClick={() => setDelPrompt(r)}>Del</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {open && (
                <div className="form-panel open">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div className="form-panel-title" style={{ marginBottom: 0 }}>{editing ? '✏️ Edit Prompt' : '✏️ Add New Prompt'}</div>
                        {editing && (
                            <button
                                className="btn btn-sm"
                                style={{ background: 'gold', color: 'black', fontWeight: 700 }}
                                onClick={generateAiImage}
                                disabled={isAiProcessing}
                            >
                                {isAiProcessing ? '🪄 PROCESSING...' : '✨ AI GENERATE IMAGE'}
                            </button>
                        )}
                    </div>

                    {err && <div className="msg err">{err}</div>}
                    {msg && <div className="msg">{msg}</div>}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Club</label>
                            {isSuperAdmin ? (
                                <select
                                    value={form.club_id}
                                    onChange={e => setForm({ ...form, club_id: e.target.value })}
                                    disabled={editing}
                                >
                                    <option value="">— Select Club —</option>
                                    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            ) : (
                                <input value={clubName(adminUser?.club_id)} readOnly style={{ opacity: .7, cursor: 'not-allowed' }} />
                            )}
                        </div>

                        <div className="form-group">
                            <label>Image Type <span style={{ color: 'var(--accent)' }}>*</span></label>
                            <input
                                type="text"
                                value={form.image_type || ''}
                                onChange={e => setForm({ ...form, image_type: e.target.value })}
                                placeholder="e.g., banner, thumbnail, profile"
                                maxLength={30}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Image Title</label>
                            <input
                                type="text"
                                value={form.image_title || ''}
                                onChange={e => setForm({ ...form, image_title: e.target.value })}
                                placeholder="Title for the image"
                            />
                        </div>

                        <div className="form-group">
                            <label>No. of Images</label>
                            <input
                                type="number"
                                value={form.image_nos || 1}
                                onChange={e => setForm({ ...form, image_nos: parseInt(e.target.value) || 1 })}
                                min={1}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Master Image Selection</label>
                            <select
                                value={form.image_id || ''}
                                onChange={e => {
                                    const sel = masterImages.find(m => m.image_id === e.target.value)
                                    setForm({
                                        ...form,
                                        image_id: e.target.value,
                                        image_url: sel ? sel.image_url : ''
                                    })
                                }}
                            >
                                <option value="">— Select Master Image —</option>
                                {masterImages.map(m => (
                                    <option key={m.image_id} value={m.image_id}>
                                        {m.caption || m.image_id}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Image Preview & URL</label>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                {form.image_url ? (
                                    <img src={form.image_url} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} alt="" />
                                ) : (
                                    <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg2)', border: '1px solid var(--border)' }} />
                                )}
                                <input
                                    type="text"
                                    value={form.image_url || ''}
                                    readOnly
                                    placeholder="Selected master image URL"
                                    style={{ background: 'var(--bg1)', opacity: 0.8, fontSize: '.75rem', flex: 1 }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Image Specification</label>
                        <textarea
                            value={form.image_spec || ''}
                            onChange={e => setForm({ ...form, image_spec: e.target.value })}
                            placeholder="Detailed specifications for the image"
                            rows={2}
                            style={{ fontSize: '.8rem' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Image Prompt (AI)</label>
                        <textarea
                            value={form.image_prompt || ''}
                            onChange={e => setForm({ ...form, image_prompt: e.target.value })}
                            placeholder="AI prompt for image generation. Use :: to separate multiple images."
                            rows={4}
                            style={{ fontSize: '.8rem' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Image Layout</label>
                        <textarea
                            value={form.image_layout || ''}
                            onChange={e => setForm({ ...form, image_layout: e.target.value })}
                            placeholder="Layout details, composition notes"
                            rows={1}
                            style={{ fontSize: '.8rem' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Image Output Format</label>
                        <input
                            type="text"
                            value={form.image_output || ''}
                            onChange={e => setForm({ ...form, image_output: e.target.value })}
                            placeholder="jpg, png, webp"
                            maxLength={30}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginTop: 14 }}>
                        <button className="btn btn-primary" onClick={save} disabled={!!msg}>
                            {editing ? 'Update' : 'Create'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {delPrompt && (
                <ConfirmDialog
                    message={`Are you sure you want to delete the prompt "${delPrompt.image_type}"?`}
                    onConfirm={deletePrompt}
                    onCancel={() => setDelPrompt(null)}
                />
            )}
        </div>
    )
}