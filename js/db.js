/* ==========================================
   數據層 — 對接 Supabase（替換 LocalStorage）
   ========================================== */
import { supabase } from './supabase.js';

// ─── 用戶 ID（從 session 取）───
let _userId = null;
export function setUserId(uid) { _userId = uid; }
export function getUserId()    { return _userId; }

// ─── ID 生成 ──
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ──────────────────────────────────────────
// casino_records
// ──────────────────────────────────────────

export async function dbLoadRecords() {
  if (!_userId) return [];
  const { data, error } = await supabase
    .from('casino_records')
    .select('*')
    .eq('user_id', _userId)
    .order('datetime', { ascending: false });
  if (error) { console.error('load records error:', error); return []; }
  return data || [];
}

export async function dbAddRecord(record) {
  if (!_userId) throw new Error('Not authenticated');
  const newRec = {
    id: genId(),
    user_id: _userId,
    datetime:  record.datetime  || null,
    casino:    record.casino    || null,
    area:      record.area      || null,
    game_type: record.game_type || null,
    game:      record.game      || null,
    points:    record.points    ?? 0,
    avg_bet:   record.avg_bet   ?? 0,
    win_loss:  record.win_loss  ?? 0,
    start_coin:record.start_coin ?? 0,
    end_coin:  record.end_coin  ?? 0,
    note:      record.note      || null,
    created_at: new Date().toISOString(),
  };
  console.log('[DB] dbAddRecord inserting:', JSON.stringify(newRec));
  const { data, error } = await supabase.from('casino_records').insert(newRec);
  console.log('[DB] dbAddRecord result:', { data, error });
  if (error) {
    console.error('[DB] dbAddRecord Supabase error:', error);
    throw error;
  }
  return newRec;
}

export async function dbUpdateRecord(id, updates) {
  if (!_userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('casino_records')
    .update(updates)
    .eq('id', id)
    .eq('user_id', _userId);
  if (error) throw error;
}

export async function dbDeleteRecord(id) {
  if (!_userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('casino_records')
    .delete()
    .eq('id', id)
    .eq('user_id', _userId);
  if (error) throw error;
}

// ──────────────────────────────────────────
// casino_promos
// ──────────────────────────────────────────

export async function dbLoadPromos() {
  if (!_userId) return [];
  const { data, error } = await supabase
    .from('casino_promos')
    .select('*')
    .eq('user_id', _userId)
    .order('date', { ascending: false });
  if (error) { console.error('load promos error:', error); return []; }
  return data || [];
}

export async function dbAddPromo(promo) {
  if (!_userId) throw new Error('Not authenticated');
  const newPromo = { ...promo, user_id: _userId, id: genId(), created_at: new Date().toISOString() };
  const { error } = await supabase.from('casino_promos').insert(newPromo);
  if (error) throw error;
  return newPromo;
}

export async function dbUpdatePromo(id, updates) {
  if (!_userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('casino_promos')
    .update(updates)
    .eq('id', id)
    .eq('user_id', _userId);
  if (error) throw error;
}

export async function dbDeletePromo(id) {
  if (!_userId) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('casino_promos')
    .delete()
    .eq('id', id)
    .eq('user_id', _userId);
  if (error) throw error;
}
