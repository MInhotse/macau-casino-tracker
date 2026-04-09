/* ==========================================
   Supabase 客戶端初始化
   ========================================== */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️  已配置 Supabase 項目
const SUPABASE_URL  = 'https://zgkfuejazoloiodhucng.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WvMmzs-y-MsH6y3Cb7Zbqg_PCWHQdmC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,           // 登入狀態持久化（localStorage）
    storageKey: 'casino_tracker_auth',
    autoRefreshToken: true,
  }
});
