/* ==========================================
   認證層 — 登入 / 登出
   ========================================== */
import { supabase } from './supabase.js';

// ─── 郵箱 Magic Link（無需密碼，點連結即登入）───
export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + '/index.html',
    },
  });
  if (error) throw error;
}

// ─── Google OAuth ───
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/index.html',
    },
  });
  if (error) throw error;
}

// ─── 電話 OTP（需要 SMS）───
// export async function signInWithPhone(phone) {
//   const { error } = await supabase.auth.signInWithOtp({ phone });
//   if (error) throw error;
// }
// export async function verifyPhoneOtp(phone, token) {
//   const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
//   if (error) throw error;
// }

// ─── 登出 ───
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

// ─── 取得當前 Session ───
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── 取得當前 User ───
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// ─── 監聽 Auth 狀態變化 ───
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ─── 更新 Nickname ───
export async function updateNickname(userId, nickname) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, nickname, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ─── 取得 Nickname ───
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, created_at')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}
