import type { User } from './database'
export type AdminRole = 'superadmin' | 'clubadmin' | 'vendadmin' | 'vendor'
export interface AdminUser extends Omit<User, 'role'> { role: AdminRole }
export type Theme = 'dark' | 'fresh' | 'bold'
