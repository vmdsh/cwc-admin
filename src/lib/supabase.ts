import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase      = createClient(supabaseUrl, supabaseAnon)
export const BUCKET        = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string) || 'coworkclub-media'
export const STORAGE_URL   = `${supabaseUrl}/storage/v1/object/${BUCKET}`
export const STORAGE_PUB   = `${supabaseUrl}/storage/v1/object/public/${BUCKET}`
export const SUPABASE_ANON = supabaseAnon
