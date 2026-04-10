-- ==========================================
-- 澳門賭場追蹤 App — Supabase Schema
-- 執行方式：Supabase Dashboard > SQL Editor > Run
-- ==========================================

-- 1. profiles 表（用戶基本資料）
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 自動建立 profile（用户註冊後觸發）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. casino_records 表
CREATE TABLE IF NOT EXISTS public.casino_records (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  datetime   TEXT,
  casino     TEXT,
  area       TEXT,
  game_type  TEXT,
  game       TEXT,
  points     NUMERIC DEFAULT 0,
  avg_bet    NUMERIC DEFAULT 0,
  win_loss   NUMERIC DEFAULT 0,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. casino_promos 表
CREATE TABLE IF NOT EXISTS public.casino_promos (
  id               TEXT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date             TEXT,
  casino           TEXT,
  category         TEXT,
  item             TEXT,
  point_type       TEXT DEFAULT 'daily',
  points_required  NUMERIC DEFAULT 0,
  days             INTEGER,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Row Level Security（RLS）— 數據完全隔離
-- ==========================================

-- 開啟 RLS
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casino_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casino_promos   ENABLE ROW LEVEL SECURITY;

-- profiles：只有本人可讀寫
CREATE POLICY "profiles: own row only" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- casino_records：只有本人可讀寫
CREATE POLICY "records: own row only" ON public.casino_records
  FOR ALL USING (auth.uid() = user_id);

-- casino_promos：只有本人可讀寫
CREATE POLICY "promos: own row only" ON public.casino_promos
  FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- Realtime（可選，有需要即時同步再開）
-- ==========================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_records;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_promos;

-- ==========================================
-- 升級：新增本金欄位（已有數據庫使用者執行）
-- ==========================================
ALTER TABLE public.casino_promos ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
