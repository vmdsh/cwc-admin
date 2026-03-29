import { supabase } from './supabase'
import type { AdminUser } from '../types/admin'

const KEY = 'cwc_admin'

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  // Step 1: Find user by email first (to distinguish "not found" vs "wrong password")
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .limit(1)

  if (error) throw new Error(`Database error: ${error.message}`)
  if (!data?.length) throw new Error('Invalid email or password')

  const user = data[0] as AdminUser

  // Step 2: Check password (plaintext comparison)
  if (user.password !== password) throw new Error('Invalid email or password')

  // Step 3: Check admin role
  if (!['superadmin', 'clubadmin'].includes(user.role))
    throw new Error('Access denied — admin role required')

  // Step 4: Persist session (exclude password from stored object)
  const { password: _pw, ...safeUser } = user as AdminUser & { password: string }
  localStorage.setItem(KEY, JSON.stringify(safeUser))

  return safeUser as AdminUser
}

export function logoutAdmin() {
  localStorage.removeItem(KEY)
}

export function restoreAdminSession(): AdminUser | null {
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) return null
    const user = JSON.parse(saved) as AdminUser
    if (!['superadmin', 'clubadmin'].includes(user.role)) return null
    return user
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
}
