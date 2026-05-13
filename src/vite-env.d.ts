/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_STORAGE_BUCKET: string
  readonly VITE_PHOTOROOM_API_KEY: string
  readonly VITE_GLOBAL_IMAGE_VARIANTS: string
  readonly VITE_GLOBAL_CLUB_PROMPT: string
  readonly VITE_GLOBAL_CLUB_SPEC: string
  readonly VITE_BAKERY_CATEGORY_SPEC: string
  readonly VITE_TECH_CATEGORY_SPEC: string
  readonly VITE_GLOBAL_PRODUCT_LAYOUT: string
  readonly VITE_GLOBAL_MARKETING_PROMPT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}