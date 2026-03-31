export interface Club {
  club_id: string; club_name: string; flag_emoji?: string
  status?: 'active' | 'launching' | 'upcoming'; country?: string
  description?: string; created_at?: string
  lat?:         number | null
  lng?:         number | null
  coords?:      string | null   
  geo_fence?:   number | null
  alert_start?: number | null
  alert_reach?: number | null
  about_html?:    string | null
  mission_html?:  string | null
  vision_html?:   string | null
  contact_email?: string | null
  contact_phone?: string | null
}
export interface ClubImage {
  image_id:   string
  club_id:    string
  image_url:  string
  caption?:   string | null
  sort_order?: number | null
}
export interface ProductCategory {
  category_id: string; category_name: string; slug?: string
  icon_emoji?: string; one_word?: string; tagline?: string
  description?: string; sort_order?: number; club_id: string
  is_predefined?: boolean; created_at?: string
}
export interface ProductCategoryImage {
  image_id: string; category_id: string; image_url: string
  title?: string; subtitle?: string; sort_order?: number; is_active?: boolean
}
export interface Product {
  product_id: string; product_name: string; description?: string
  price: number; uom?: string; service_type?: 'E' | 'B' | 'S' | 'I'
  category_id: string; club_id: string; created_at?: string
}
export interface ProductImage {
  image_id: string; product_id: string; image_url: string
  caption?: string; sort_order?: number
}
export interface ProductUser {
  product_user_id: string; product_id: string; user_id: string
  is_admin?: boolean; joined_at?: string
}
export interface Shop {
  shop_id: string; shop_name: string; club_id: string
  shop_type?: 'physical' | 'onwheel' | 'online'
  contact?: string; address?: string; description?: string
  is_active?: boolean; created_at?: string
  shop_emoji?:   string | null
  shop_tagline?: string | null
  lat?:         number | null
  lon?:         number | null
  lng?:         number | null
  coords?:       string | null
}
export interface ShopImage {
  image_id: string; shop_id: string; image_url: string
  caption?: string; sort_order?: number
}
export interface ShopProduct {
  id: string; shop_id: string; product_id: string
  price_override?: number | null; is_available?: boolean
}
export interface User {
  user_id: string; name?: string; email: string; password?: string
  role?: 'superadmin' | 'clubadmin' | 'member'; club_id?: string; created_at?: string
}
export interface UserAddress {
  address_id: string; user_id?: string; label?: string; address: string
  landmark?: string; lat?: number | null; lng?: number | null
  is_default?: boolean; created_at?: string
}
export interface UserProfile {
  user_id: string; tagline?: string; bio?: string; skills?: string[]
  experience_yr?: number | null; rate_per_hr?: number | null
  availability?: 'anytime' | 'weekends' | 'evenings'
  is_mentor?: boolean; linkedin_url?: string; website_url?: string; updated_at?: string
}
export interface Route {
  route_id: string; route_name: string; club_id?: string
  description?: string; is_active?: boolean; created_at?: string
}
export interface RouteWaypoint {
  way_id: string; route_id: string; way_name: string
  sequence: number; lat: number; lng: number
}
export interface RouteMovement {
  movement_id: string; route_id: string; shop_id?: string; driver_id?: string
  movement_date: string; start_time?: string; end_time?: string
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string; created_at?: string
}
export interface MovementProduct {
  id: string; movement_id: string; product_id: string
  planned_qty?: number; actual_qty?: number | null; notes?: string
}
export interface RouteBooking {
  booking_id: string; movement_id?: string; product_id?: string
  customer_id?: string; address_id?: string; qty?: number; amount?: number
  status?: 'pending' | 'confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled'
  notes?: string; booked_at?: string
}
export interface AgentLocation {
  id: string; driver_id: string; movement_id?: string
  lat?: number; lng?: number; is_online?: boolean; updated_at?: string
}
