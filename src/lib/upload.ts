import { STORAGE_URL, STORAGE_PUB, SUPABASE_ANON } from './supabase'

export async function uploadImage(file: File, folder: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${folder}/${Date.now()}-${safeName}`
  const res = await fetch(`${STORAGE_URL}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': file.type, 'x-upsert': 'true' },
    body: file,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message: string }).message || 'Upload failed')
  }
  return `${STORAGE_PUB}/${path}`
}
