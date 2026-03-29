import type { User } from './database'
export type AdminRole = 'superadmin' | 'clubadmin'
export interface AdminUser extends User { role: AdminRole }
export type Theme = 'dark' | 'fresh' | 'bold'
