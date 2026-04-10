/* ==========================================
   澳門賭場玩家追蹤 App — app.js
   ========================================== */
import {
  dbLoadRecords, dbAddRecord, dbUpdateRecord, dbDeleteRecord,
  dbLoadPromos,  dbAddPromo,  dbUpdatePromo,  dbDeletePromo,
  getUserId, setUserId,
} from './db.js';
import { supabase } from './supabase.js';

// ── Global safe toast (bypass any broken showToast) ──────────────────────────
window._safeToast = function(msg, isError) {
  var toast = document.getElementById('toast');
  if (!toast) {
    // Fallback: alert if #toast missing
    console.warn('[_safeToast] #toast not found, using alert:', msg);
    alert(msg);
    return;
  }
  toast.textContent = msg;
  toast.style.background = isError ? '#ff4444' : '';
  toast.classList.add('show');
  if (window._toastTimer) clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3000);
};

// In-memory cache (loaded from Supabase on auth)
let _records = [];
let _promos   = [];

// Load from DB → fill cache
async function loadFromDB() {
  console.log('[DEBUG] loadFromDB starting, userId:', getUserId());
  _records = await dbLoadRecords();
  console.log('[DEBUG] records loaded:', _records.length, 'records');
  _promos  = await dbLoadPromos();
  console.log('[DEBUG] promos loaded:', _promos.length, 'promos');
}

// ==============================
// 澳門賭場名單（2026 準確版）
// ==============================
const CASINOS = [
  // ── 金沙中國 ──
  { value: 'venetian',  label: '威尼斯人 The Venetian',   group: '金沙中國' },
  { value: 'parisian',   label: '巴黎人 The Parisian',     group: '金沙中國' },
  { value: 'londoner',  label: '澳門倫敦人 The Londoner',  group: '金沙中國' },
  { value: 'sands',     label: '澳門金沙 Sands Macao',    group: '金沙中國' },
  { value: 'plaza',     label: '百利宮 The Plaza (四季)',  group: '金沙中國' },
  // ── 銀河娛樂 ──
  { value: 'galaxy',    label: '澳門銀河 Galaxy Macau',   group: '銀河娛樂' },
  { value: 'broadway',  label: '澳門百老匯 Broadway Macau',group: '銀河娛樂' },
  { value: 'starworld', label: '星際酒店 StarWorld',       group: '銀河娛樂' },
  { value: 'altira',    label: '新濠鋒 Altira',            group: '新濠博亞' },
  // ── 新濠博亞 ──
  { value: 'cod',       label: '新濠天地 City of Dreams',  group: '新濠博亞' },
  { value: 'studiocity',label: '新濠影滙 Studio City',    group: '新濠博亞' },
  // ── 永利澳門 ──
  { value: 'wynnpalace',label: '永利皇宮 Wynn Palace',     group: '永利澳門' },
  { value: 'wynn',      label: '永利澳門 Wynn Macau',     group: '永利澳門' },
  // ── 美高梅中國 ──
  { value: 'mgmcotai',  label: '美獅美高梅 MGM Cotai',     group: '美高梅中國' },
  { value: 'mgm',       label: '美高梅 MGM Macau',         group: '美高梅中國' },
  // ── 澳娛綜合 (SJM) ──
  { value: 'grandlisboa',label:'新葡京 Grand Lisboa',      group: '澳娛綜合' },
  { value: 'lisboa',    label: '葡京 Hotel Lisboa',        group: '澳娛綜合' },
  { value: 'glp',       label: '上葡京 Grand Lisboa Palace',group: '澳娛綜合' },
  { value: 'oceanus',   label: '海立方 Oceanus',           group: '澳娛綜合' },
  { value: 'jaialai',   label: '回力娛樂場 Jai Alai',      group: '澳娛綜合' },
  { value: 'larc',      label: '凱旋門 L\'Arc Macau',      group: '澳娛綜合' },
  // ── 自訂 ──
  { value: 'custom',    label: '✨ 其他 / 自訂賭場',        group: null },
];

// ==============================
// 遊戲列表
// Table = Real Table Game（實體真人牌桌，實體籌碼）
// LTG = Live Table Game（真人荷官，個人電子螢幕下注）
// ETG = Electronic Table Game（電腦 RNG，無真人荷官）
// Slot = 老虎機
// RTG/LTG/ETG 共用同一遊戲清單
// ==============================
const TABLE_GAMES = [
  '百家樂 Baccarat',
  '21點 Blackjack',
  '骰寶 Sic Bo',
  '輪盤 Roulette',
  '番攤 Fan Tan',
  '德州撲克 Texas Hold\'em',
  '牌九 Pai Gow',
  '龍虎 Dragon Tiger',
  '三公 3 Pictures',
  '富貴三寶 Caribbean Stud Poker',
  '其他遊戲 Other Game',
];

const GAME_LIST = {
  rtg:  TABLE_GAMES,
  ltg:  TABLE_GAMES,
  etg:  TABLE_GAMES,
  slot: [
    '五龍爭霸 5 Dragons',
    '多福多財 Duo Fu Duo Cai',
    '金吉報喜 Jin Ji Bao Xi',
    '龍之連環 Dragon Link',
    '其他老虎機 Other Slot',
  ],
  custom: ['其他 / 自訂遊戲'],
};

// ==============================
// 遊戲類型顯示名稱
// ==============================
const TYPE_LABEL = {
  rtg:  { name: 'Table 實體牌桌', badge: 'rtg' },
  ltg:  { name: 'LTG 直播混合', badge: 'ltg' },
  etg:  { name: 'ETG 電子機檯', badge: 'etg' },
  slot: { name: 'Slot 老虎機',  badge: 'slot' },
};

// ==============================
// 優惠類別
// ==============================
const CATEGORY_MAP = {
  table_credit:     { label: '賭枱獎賞碼',    emoji: '🎰' },
  slot_credit:     { label: '角子機獎賞錢',  emoji: '🎰' },
  fb_snack:        { label: '小食',           emoji: '🍽️' },
  fb_breakfast:    { label: '早餐',           emoji: '🌅' },
  fb_lunch:        { label: '午餐',           emoji: '🌞' },
  fb_afternoon_tea:{ label: '下午茶',         emoji: '🍰' },
  fb_dinner:       { label: '晚餐',           emoji: '🌙' },
  fb_late_night:   { label: '宵夜',           emoji: '🌛' },
  room:            { label: '住宿',           emoji: '🛏️' },
  transport:       { label: '交通',           emoji: '🚗' },
  gift:            { label: '禮品',           emoji: '🎁' },
  spa:             { label: '水療/娛樂',     emoji: '💆' },
  other:           { label: '其他',           emoji: '✨' },
};

function promoCatLabel(cat) {
  const info = CATEGORY_MAP[cat] || { label: cat, emoji: '✨' };
  return info.emoji + ' ' + info.label;
}

// ==============================
// genId（db.js 已匯出，這裡保留給前端局部用）
// ==============================
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ==============================
// Tab Navigation
// ==============================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard')  updateDashboard();
    if (btn.dataset.tab === 'history')    renderHistory();
    if (btn.dataset.tab === 'promotions') { updatePromoDashboard(); renderPromos(); }
  });
});

// ==============================
// Populate Casino Select
// ==============================
function populateCasinoSelect(selectEl, selectedValue) {
  selectEl.innerHTML = '<option value="">— 選擇賭場 —</option>';
  CASINOS.forEach(c => {
    const o = document.createElement('option');
    o.value = c.value;
    o.textContent = c.label;
    if (selectedValue && c.value === selectedValue) o.selected = true;
    selectEl.appendChild(o);
  });
  // Handle previous custom value
  if (selectedValue && !CASINOS.find(c => c.value === selectedValue)) {
    const customOpt = [...selectEl.options].find(o => o.value === 'custom');
    if (customOpt) {
      customOpt.selected = true;
      return 'CUSTOM';
    }
  }
  return selectedValue;
}

// ==============================
// Game Select Population
// ==============================
function populateGameSelect(selectEl, gameType, currentGame) {
  selectEl.innerHTML = '';
  const games = GAME_LIST[gameType] || [];
  games.forEach(g => {
    const o = document.createElement('option');
    o.value = g;
    o.textContent = g;
    if (currentGame && g === currentGame) o.selected = true;
    selectEl.appendChild(o);
  });
}

// ==============================
// Type Button Switching (Add Form)
// ==============================
function onGameTypeChange(type) {
  document.getElementById('rec-game-type').value = type;
  document.querySelectorAll('#tab-add-record .type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
  const gameSel = document.getElementById('rec-game');
  populateGameSelect(gameSel, type);
  // Show custom game row if "其他"
  onGameChange();
}

function onGameChange() {
  const game    = document.getElementById('rec-game').value;
  const type    = document.getElementById('rec-game-type').value;
  const isOther = game.includes('其他') || game.includes('Other');
  document.getElementById('custom-game-row').style.display = isOther ? '' : 'none';
}

function onCasinoChange() {
  const val = document.getElementById('rec-casino').value;
  document.getElementById('custom-casino-row').style.display = val === 'custom' ? '' : 'none';
}

// ==============================
// Type Button Switching (Edit Modal)
// ==============================
function onEditGameTypeChange(type) {
  document.getElementById('edit-game-type').value = type;
  document.querySelectorAll('#editRecordForm .type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
  populateGameSelect(document.getElementById('edit-game'), type);
  onEditGameChange();
}

function onEditGameChange() {
  const game    = document.getElementById('edit-game').value;
  const isOther = game.includes('其他') || game.includes('Other');
  document.getElementById('edit-custom-game-row').style.display = isOther ? '' : 'none';
}

function onEditCasinoChange() {
  const val = document.getElementById('edit-casino').value;
  document.getElementById('edit-custom-casino-row').style.display = val === 'custom' ? '' : 'none';
}

// ==============================
// Promo Category Change (Add Form)
// ==============================
function onPromoCategoryChange() {
  const cat    = document.getElementById('promo-category').value;
  const fbSub  = document.getElementById('promo-fb-sub-group');
  const priceRow = document.getElementById('promo-price-row');

  if (fbSub)  fbSub.style.display  = cat === 'fb' ? '' : 'none';
  if (priceRow) priceRow.style.display = (cat === 'table_credit' || cat === 'slot_credit') ? '' : 'none';
}

// ==============================
// Promo Category Change (Edit Modal)
// ==============================
function onEditPromoCategoryChange() {
  const cat      = document.getElementById('ep-category').value;
  const fbSub    = document.getElementById('ep-fb-sub-group');
  const priceRow = document.getElementById('ep-price-row');

  if (fbSub)    fbSub.style.display    = cat === 'fb' ? '' : 'none';
  if (priceRow) priceRow.style.display = (cat === 'table_credit' || cat === 'slot_credit') ? '' : 'none';
}

// ==============================
// Promo Days Toggle
// ==============================
function togglePromoDays() {
  const isCumulative = document.getElementById('promo-point-type').value === 'cumulative';
  document.getElementById('promo-days-group').style.display = isCumulative ? '' : 'none';
}

// ==============================
// Init Defaults
// ==============================
function initForms() {
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  document.getElementById('rec-datetime').value = localISO;
  document.getElementById('promo-date').value  = now.toISOString().slice(0, 10);

  populateCasinoSelect(document.getElementById('rec-casino'));
  populateCasinoSelect(document.getElementById('promo-casino'));
  populateCasinoSelect(document.getElementById('promo-filter-casino'));
  populateGameSelect(document.getElementById('rec-game'), 'rtg');

  // Force select first game option so gameName is never empty
  const recGame = document.getElementById('rec-game');
  if (recGame.options.length > 0 && !recGame.value) {
    recGame.selectedIndex = 0;
  }

  onGameTypeChange('rtg');
  document.getElementById('promo-days-group').style.display = 'none';
  onPromoCategoryChange(); // 初始化優惠類別 UI 狀態
}

function resetFormDefaults() {
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('rec-datetime').value = localISO;
  populateCasinoSelect(document.getElementById('rec-casino'));
  document.getElementById('custom-casino-row').style.display = 'none';
  onGameTypeChange('rtg');
  document.getElementById('rec-winloss-display').value = '—';
  document.getElementById('rec-winloss-display').style.color = 'var(--gold)';
}

// ==============================
// Record Form Submit
// ==============================
document.getElementById('recordForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  console.log('[DEBUG] recordForm submit triggered');

  const casinoSelectVal = document.getElementById('rec-casino').value;
  let casinoName = casinoSelectVal;
  if (casinoSelectVal === 'custom') {
    casinoName = document.getElementById('rec-custom-casino').value.trim() || '自訂賭場';
  }

  const gameType = document.getElementById('rec-game-type').value;
  let gameName   = document.getElementById('rec-game').value;
  const customGame = document.getElementById('rec-custom-game').value.trim();
  if (gameName.includes('其他') || customGame) {
    gameName = customGame || gameName;
  }

  const record = {
    datetime:  document.getElementById('rec-datetime').value,
    casino:    casinoName,
    area:      document.getElementById('rec-area').value.trim(),
    game_type: gameType,
    game:      gameName,
    points:      parseFloat(document.getElementById('rec-points').value) || 0,
    avg_bet:     parseFloat(document.getElementById('rec-avg-bet').value) || 0,
    start_coin:  parseFloat(document.getElementById('rec-start-coin').value) || 0,
    end_coin:    parseFloat(document.getElementById('rec-end-coin').value) || 0,
    note:      document.getElementById('rec-note').value.trim(),
  };
  // 自動計算盈虧
  record.win_loss = (record.end_coin || 0) - (record.start_coin || 0);

  console.log('[DEBUG] record payload:', record);
  console.log('[DEBUG] current userId:', getUserId());

  try {
    const saved = await dbAddRecord(record);
    console.log('[DEBUG] dbAddRecord success:', saved);
    _records.unshift(saved);
    showToast('✅ 記錄已儲存');
    this.reset();
    setTimeout(resetFormDefaults, 50);
  } catch (err) {
    console.error('[DEBUG] dbAddRecord error:', err);
    window._safeToast('❌ 儲存失敗：' + err.message, true);
    return;
  }

  try {
    updateDashboard();
  } catch (e) {
    console.error('[DEBUG] updateDashboard error:', e);
  }

  try {
    renderHistory();
  } catch (e) {
    console.error('[DEBUG] renderHistory error:', e);
  }
});

// ==============================
// Promo Form Submit
// ==============================
function el2(id) {
  const el = document.getElementById(id);
  if (!el) console.error('[promoForm] element not found:', id);
  return el;
}

document.getElementById('promoForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const mainCat = el2('promo-category')?.value || '';
  const finalCat = mainCat === 'fb'
    ? (el2('promo-fb-sub')?.value || '')
    : mainCat;

  const hasPrice = (mainCat === 'table_credit' || mainCat === 'slot_credit');
  const price = hasPrice ? parseFloat(el2('promo-price')?.value) || 0 : 0;

  const promo = {
    date:            el2('promo-date')?.value || '',
    casino:          el2('promo-casino')?.value || '',
    category:        finalCat,
    item:            (el2('promo-item')?.value || '').trim(),
    point_type:      el2('promo-point-type')?.value || 'daily',
    points_required: parseFloat(el2('promo-points-required')?.value) || 0,
    days:            parseInt(el2('promo-days')?.value) || null,
    price:           price,
    note:            (el2('promo-note')?.value || '').trim(),
  };

  console.log('[promoForm] promo to save:', promo, '| _userId:', getUserId());

  try {
    const saved = await dbAddPromo(promo);
    _promos.unshift(saved);
    window._safeToast('🎁 優惠記錄已儲存');
    this.reset();
    const elDate = el2('promo-date');
    if (elDate) elDate.value = new Date().toISOString().slice(0, 10);
    const elDays = el2('promo-days-group');
    if (elDays) elDays.style.display = 'none';
    onPromoCategoryChange();
    updatePromoDashboard();
    renderPromos();
  } catch (err) {
    console.error('[promoForm] save error:', err);
    window._safeToast('❌ 儲存失敗：' + err.message, true);
  }
});

// ==============================
// Render History
// ==============================
function renderHistory() {
  const container    = document.getElementById('history-list');
  const search       = (document.getElementById('history-search').value || '').toLowerCase();
  const filterType   = document.getElementById('history-filter-type').value;
  const filterResult = document.getElementById('history-filter-result').value;

  let records = [..._records].sort((a, b) => (b.datetime || '').localeCompare(a.datetime || ''));

  if (search)       records = records.filter(r => (r.casino + r.game + r.note).toLowerCase().includes(search));
  if (filterType)   records = records.filter(r => r.game_type === filterType);
  if (filterResult === 'win')   records = records.filter(r => (r.win_loss || 0) > 0);
  if (filterResult === 'lose')  records = records.filter(r => (r.win_loss || 0) < 0);
  if (filterResult === 'break') records = records.filter(r => (r.win_loss || 0) === 0);

  if (records.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎰</div><p>暫無記錄，開始記錄你的第一場吧！</p></div>`;
    return;
  }

  container.innerHTML = records.map(r => {
    const wl         = r.win_loss || 0;
    const dt         = r.datetime ? r.datetime.replace('T', ' ') : '—';
    const wlClass    = wl > 0 ? 'win-item' : wl < 0 ? 'lose-item' : 'break-item';
    const wlValClass = wl > 0 ? 'winloss-pos' : wl < 0 ? 'winloss-neg' : 'winloss-zero';
    const wlSign     = wl > 0 ? '+' : '';
    const badgeClass = 'badge-' + (r.game_type || 'ltg');
    const typeInfo    = TYPE_LABEL[r.game_type] || TYPE_LABEL.ltg;
    const casinoIcon = r.area ? '📍' : '🏨';

    return `<div class="history-item ${wlClass}">
      <div class="hi-main">
        <div class="hi-title">
          ${r.game}
          <span class="hi-badge ${badgeClass}">${typeInfo.name}</span>
        </div>
        <div class="hi-casino">${casinoIcon} ${r.casino}${r.area ? ' · ' + r.area : ''}</div>
        <div class="hi-meta">
          <span>📅 ${dt}</span>
          <span>⭐ ${(r.points || 0) > 0 ? '+' : ''}${(r.points || 0).toLocaleString()} 積分</span>
          <span>🎲 均注 HKD ${(r.avg_bet || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
          ${(r.start_coin || r.end_coin) ? `<span>💰 本金 ${(r.start_coin||0).toLocaleString()} → ${(r.end_coin||0).toLocaleString()} HKD</span>` : ''}
        </div>
        ${r.note ? `<div class="hi-note">📝 ${r.note}</div>` : ''}
      </div>
      <div>
        <div class="hi-winloss ${wlValClass}">${wlSign}${wl.toLocaleString()} HKD</div>
        <div class="hi-actions">
          <button class="btn-icon" onclick="openEditModal('${r.id}')" title="編輯">✏️</button>
          <button class="btn-icon" onclick="openDeleteModal('${r.id}', 'record')" title="刪除">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ==============================
// Render Promos
// ==============================
function renderPromos() {
  const container   = document.getElementById('promo-list');
  const filterCat   = document.getElementById('promo-filter-cat').value;
  const filterCasino= document.getElementById('promo-filter-casino').value;

  let promos = [..._promos].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (filterCat)    promos = promos.filter(p => p.category === filterCat);
  if (filterCasino) promos = promos.filter(p => p.casino === filterCasino);

  if (promos.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎁</div><p>暫無優惠記錄</p></div>`;
    return;
  }

  container.innerHTML = promos.map(p => {
    const catInfo   = CATEGORY_MAP[p.category] || { label: p.category, emoji: '✨' };
    const ptLabel   = p.point_type === 'daily'
      ? '每日積分'
      : `累計 ${p.days || '?'} 天積分`;
    const casinoChip= p.casino
      ? `<span class="promo-casino-chip">🏨 ${p.casino}</span>`
      : '';
    // 價格只在 table_credit / slot_credit 顯示
    const priceTag  = (p.category === 'table_credit' || p.category === 'slot_credit') && (p.price || 0) > 0
      ? `<span style="color:#D4AF37;font-weight:600">💰 ${(p.price||0).toLocaleString()} HKD</span>`
      : '';

    return `<div class="promo-item">
      <div class="hi-main">
        <div class="promo-title">
          ${p.item}
          <span class="promo-cat-badge">${catInfo.emoji} ${catInfo.label}</span>
          ${casinoChip}
        </div>
        <div class="promo-meta">
          <span>📅 ${p.date}</span>
          ${priceTag}
          <span>⭐ ${(p.points_required || 0).toLocaleString()} 積分</span>
          <span>📌 ${ptLabel}</span>
        </div>
        ${p.note ? `<div class="hi-note">📝 ${p.note}</div>` : ''}
      </div>
      <div class="hi-actions">
        <button class="btn-icon" onclick="openEditPromoModal('${p.id}')" title="編輯">✏️</button>
        <button class="btn-icon" onclick="openDeleteModal('${p.id}', 'promo')" title="刪除">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ==============================
// Dashboard
// ==============================
let chartWL = null, chartGP = null;
let chartPromoCat = null, chartPromoCasino = null;

function updateDashboard() {
  const records = _records;
  const promos  = _promos;

  const totalSessions = records.length;
  const totalWL       = records.reduce((s, r) => s + (r.win_loss || 0), 0);
  const avgBet        = totalSessions > 0
    ? (records.reduce((s, r) => s + (r.avg_bet || 0), 0) / totalSessions) : 0;
  const winCount      = records.filter(r => (r.win_loss || 0) > 0).length;
  const loseCount     = records.filter(r => (r.win_loss || 0) < 0).length;
  const promoCount    = promos.length;
  const promoPoints   = promos.reduce((s, p) => s + (p.points_required || 0), 0);

  const distinctCasinos = [...new Set(records.map(r => r.casino).filter(Boolean))];

  const el = (id) => document.getElementById(id);

  const statTotalSessions = el('stat-total-sessions');
  const statCasinoCount    = el('stat-casino-count');
  const statTotalWinloss  = el('stat-total-winloss');
  const statAvgBet        = el('stat-avg-bet');
  const statWinCount      = el('stat-win-count');
  const statLoseCount     = el('stat-lose-count');
  const statPromoCount    = el('stat-promo-count');
  const statPromoPoints   = el('stat-promo-points');
  const statStartCoin     = el('stat-start-coin');
  const statEndCoin       = el('stat-end-coin');

  if (statTotalSessions) statTotalSessions.textContent = totalSessions;
  if (statCasinoCount)   statCasinoCount.textContent  = distinctCasinos.length;
  if (statTotalWinloss) {
    statTotalWinloss.textContent = (totalWL >= 0 ? '+' : '') + totalWL.toLocaleString();
    statTotalWinloss.className   = 'stat-value ' + (totalWL > 0 ? 'win' : totalWL < 0 ? 'lose' : '');
  }
  if (statAvgBet)     statAvgBet.textContent     = avgBet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (statWinCount)  statWinCount.textContent   = winCount;
  if (statLoseCount) statLoseCount.textContent  = loseCount;
  if (statPromoCount) statPromoCount.textContent = promoCount;
  if (statPromoPoints)statPromoPoints.textContent= Math.round(promoPoints).toLocaleString();

  const latest = records[0];
  if (statStartCoin) statStartCoin.textContent = latest && (latest.start_coin || 0) > 0 ? (latest.start_coin || 0).toLocaleString() : '—';
  if (statEndCoin)   statEndCoin.textContent   = latest && (latest.end_coin || 0)   > 0 ? (latest.end_coin   || 0).toLocaleString()   : '—';

  renderCasinoPoints(records);
  renderChartWinLoss(records);
  renderChartGamePref(records);
}

// ==============================
// Per-Casino Points Breakdown
// ==============================
function renderCasinoPoints(records) {
  const container = document.getElementById('casino-points-list');
  const section   = document.getElementById('casino-points-section');

  if (records.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  // Group by casino
  const byCasino = {};
  records.forEach(r => {
    const c = r.casino || '未知賭場';
    if (!byCasino[c]) byCasino[c] = { points: 0, sessions: 0 };
    byCasino[c].points   += r.points || 0;
    byCasino[c].sessions += 1;
  });

  // Sort by points descending
  const sorted = Object.entries(byCasino).sort((a, b) => b[1].points - a[1].points);

  // Colors for casino chips
  const chipColors = ['#D4AF37','#4A90E2','#4CAF50','#E53935','#9C5CF5','#FF8C00','#00BCD4','#F06292'];

  container.innerHTML = sorted.map(([casino, data], i) => {
    const color = chipColors[i % chipColors.length];
    return `<div class="casino-pts-card">
      <div class="cpc-header">
        <span class="cpc-dot" style="background:${color}"></span>
        <span class="cpc-name">${casino}</span>
        <span class="cpc-sessions">${data.sessions} 局</span>
      </div>
      <div class="cpc-points" style="color:${color}">${Math.round(data.points).toLocaleString()}</div>
      <div class="cpc-unit">積分</div>
    </div>`;
  }).join('');
}

function renderChartWinLoss(records) {
  const sorted = [...records].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const labels = sorted.map(r => r.datetime ? r.datetime.slice(5, 10) : '');
  let cum = 0;
  const data = sorted.map(r => { cum += (r.win_loss || 0); return cum; });

  const ctx = document.getElementById('chartWinLoss').getContext('2d');
  if (chartWL) chartWL.destroy();
  chartWL = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '累計盈虧 HKD',
        data,
        borderColor: '#D4AF37',
        backgroundColor: (ctx) => {
          const canvas = ctx.chart.ctx;
          const grad = canvas.createLinearGradient(0, 0, 0, 300);
          grad.addColorStop(0, 'rgba(212, 175, 55, 0.2)');
          grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
          return grad;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: data.map(v => v >= 0 ? '#4CAF50' : '#E53935'),
        pointBorderColor: '#171717',
        pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E1E1E',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#A0A0A0',
          bodyColor: '#F5F5F5',
          padding: 12,
          callbacks: { label: ctx => ` HKD ${ctx.parsed.y.toLocaleString()}` },
        },
      },
      scales: {
        x: { ticks: { color: '#666666' }, grid: { display: false } },
        y: { ticks: { color: '#666666', callback: v => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  });
}

function renderChartGamePref(records) {
  const gameCount = {};
  records.forEach(r => {
    const key = r.game || '未知';
    gameCount[key] = (gameCount[key] || 0) + 1;
  });

  const sorted = Object.entries(gameCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sorted.map(([g]) => g.length > 16 ? g.slice(0, 16) + '…' : g);
  const data   = sorted.map(([, c]) => c);

  const colors = ['#D4AF37', '#8E9EAB', '#4A90E2', '#5C6BC0', '#4CAF50', '#E53935', '#A0A0A0', '#424242'];

  const ctx = document.getElementById('chartGamePref').getContext('2d');
  if (chartGP) chartGP.destroy();
  chartGP = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#171717',
        borderWidth: 3,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#A0A0A0', font: { size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 8 },
        },
        tooltip: {
          backgroundColor: '#1E1E1E',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
        },
      },
    },
  });
}

// ==============================
// Promo Summary Toggle
// ==============================
function togglePromoSummary() {
  const panel = document.getElementById('promo-summary-panel');
  panel.classList.toggle('collapsed');
}

function togglePromoList() {
  const panel = document.getElementById('promo-list-panel');
  panel.classList.toggle('collapsed');
}

// ==============================
// Promo Dashboard
// ==============================
function updatePromoDashboard() {
  const promos = _promos;

  const distinctCasinos = [...new Set(promos.map(p => p.casino).filter(Boolean))];
  const tablePromos     = promos.filter(p => p.category === 'table_credit');
  const slotPromos      = promos.filter(p => p.category === 'slot_credit');
  const fbPromos        = promos.filter(p => p.category?.startsWith('fb_'));
  const fbSnack         = promos.filter(p => p.category === 'fb_snack');
  const fbBreakfast     = promos.filter(p => p.category === 'fb_breakfast');
  const fbLunch         = promos.filter(p => p.category === 'fb_lunch');
  const fbAfternoonTea  = promos.filter(p => p.category === 'fb_afternoon_tea');
  const fbDinner        = promos.filter(p => p.category === 'fb_dinner');
  const fbLateNight     = promos.filter(p => p.category === 'fb_late_night');

  const el = (id) => document.getElementById(id);
  const d  = (id, val) => { const e = el(id); if (e) e.textContent = val; };

  d('pstat-count',   promos.length);
  d('pstat-casinos', distinctCasinos.length);
  d('pstat-table-count', tablePromos.length);
  d('pstat-slot-count',  slotPromos.length);
  d('pstat-fb-count',    fbPromos.length);

  const fmtMOP = (arr) => arr.reduce((s, p) => s + (p.price || 0), 0).toLocaleString();
  d('pstat-total-price', promos.reduce((s, p) => s + (p.price || 0), 0).toLocaleString());
  d('pstat-table-price', fmtMOP(tablePromos));
  d('pstat-slot-price',  fmtMOP(slotPromos));

  // F&B breakdown tags (只顯示次數，無價格)
  const fbBreakdown = el('promo-fb-breakdown');
  if (fbPromos.length > 0 && fbBreakdown) {
    fbBreakdown.style.display = '';
    const setFb = (id, arr) => { const e = el(id); if (e) e.textContent = `${arr.length}`; };
    setFb('fb-snack-row',        fbSnack);
    setFb('fb-breakfast-row',    fbBreakfast);
    setFb('fb-lunch-row',        fbLunch);
    setFb('fb-afternoon-tea-row',fbAfternoonTea);
    setFb('fb-dinner-row',       fbDinner);
    setFb('fb-late-night-row',   fbLateNight);
  } else if (fbBreakdown) {
    fbBreakdown.style.display = 'none';
  }

  renderPromoCharts(promos);
}

function renderPromoCharts(promos) {
  // Category donut
  const CAT_LABELS = {
    table_credit:'🎰 賭枱獎賞碼', slot_credit:'🎰 角子機獎賞錢',
    fb_snack:'🍽️ 小食', fb_breakfast:'🌅 早餐', fb_lunch:'🌞 午餐',
    fb_afternoon_tea:'🍰 下午茶', fb_dinner:'🌙 晚餐', fb_late_night:'🌛 宵夜',
    room:'🛏️ 住宿', transport:'🚗 交通', gift:'🎁 禮品', spa:'💆 水療', other:'✨ 其他',
  };
  const CAT_COLORS = {
    table_credit:'#D4AF37', slot_credit:'#9C27B0',
    fb_snack:'#4A90E2', fb_breakfast:'#FF9800', fb_lunch:'#FFB74D',
    fb_afternoon_tea:'#CE93D8', fb_dinner:'#4CAF50', fb_late_night:'#607D8B',
    room:'#4CAF50', transport:'#FF8C00', gift:'#E53935', spa:'#9C5CF5', other:'#8E9EAB',
  };

  const catCount = {};
  promos.forEach(p => { const k = p.category || 'other'; catCount[k] = (catCount[k] || 0) + 1; });
  const catSorted = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
  const catLabels = catSorted.map(([k]) => CAT_LABELS[k] || k);
  const catData   = catSorted.map(([, v]) => v);
  const catColors = catSorted.map(([k]) => CAT_COLORS[k] || '#8E9EAB');

  const ctxCat = document.getElementById('chart-promo-cat').getContext('2d');
  if (chartPromoCat) chartPromoCat.destroy();
  chartPromoCat = new Chart(ctxCat, {
    type: 'doughnut',
    data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: catColors, borderColor: '#171717', borderWidth: 3, hoverOffset: 4 }] },
    options: {
      responsive: true, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#A0A0A0', font: { size: 11 }, padding: 10, usePointStyle: true, pointStyleWidth: 8 } },
        tooltip: { backgroundColor: '#1E1E1E', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, callbacks: { label: ctx => ` ${ctx.parsed} 次` } },
      },
    },
  });

  // Casino donut — show top 8
  const casinoCount = {};
  promos.forEach(p => { if (p.casino) { casinoCount[p.casino] = (casinoCount[p.casino] || 0) + 1; } });
  const casSorted = Object.entries(casinoCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const casLabels = casSorted.map(([k]) => k.length > 14 ? k.slice(0, 14) + '…' : k);
  const casData   = casSorted.map(([, v]) => v);
  const casColors = ['#D4AF37','#4A90E2','#4CAF50','#E53935','#9C5CF5','#FF8C00','#00BCD4','#F06292'];

  const ctxCas = document.getElementById('chart-promo-casino').getContext('2d');
  if (chartPromoCasino) chartPromoCasino.destroy();
  chartPromoCasino = new Chart(ctxCas, {
    type: 'doughnut',
    data: { labels: casLabels, datasets: [{ data: casData, backgroundColor: casColors, borderColor: '#171717', borderWidth: 3, hoverOffset: 4 }] },
    options: {
      responsive: true, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#A0A0A0', font: { size: 11 }, padding: 10, usePointStyle: true, pointStyleWidth: 8 } },
        tooltip: { backgroundColor: '#1E1E1E', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, callbacks: { label: ctx => ` ${ctx.parsed} 次` } },
      },
    },
  });
}

// ==============================
// Edit Record Modal
// ==============================
function openEditModal(id) {
  const rec = _records.find(r => r.id === id);
  if (!rec) return;

  // Populate casino
  const casinoStatus = populateCasinoSelect(document.getElementById('edit-casino'), rec.casino);
  if (casinoStatus === 'CUSTOM') {
    document.getElementById('edit-casino').value = 'custom';
    document.getElementById('edit-custom-casino-row').style.display = '';
    document.getElementById('edit-custom-casino').value = rec.casino || '';
  } else {
    document.getElementById('edit-custom-casino-row').style.display = 'none';
  }

  // Game type
  const gameType = rec.game_type || 'rtg';
  document.getElementById('edit-game-type').value = gameType;
  document.querySelectorAll('#editRecordForm .type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === gameType);
  });
  populateGameSelect(document.getElementById('edit-game'), gameType, rec.game);

  // Check if other/custom
  const gameSel = document.getElementById('edit-game');
  const isOther = !([...gameSel.options].map(o => o.value).includes(rec.game));
  if (isOther) {
    const lastOpt = gameSel.options[gameSel.options.length - 1];
    gameSel.value = lastOpt.value;
    document.getElementById('edit-custom-game-row').style.display = '';
    document.getElementById('edit-custom-game').value = rec.game || '';
  } else {
    document.getElementById('edit-custom-game-row').style.display = 'none';
  }

  document.getElementById('edit-id').value        = rec.id;
  document.getElementById('edit-datetime').value  = rec.datetime || '';
  document.getElementById('edit-area').value       = rec.area || '';
  document.getElementById('edit-points').value     = rec.points  || 0;
  document.getElementById('edit-avg-bet').value   = rec.avg_bet || 0;
  document.getElementById('edit-start-coin').value = rec.start_coin || 0;
  document.getElementById('edit-end-coin').value   = rec.end_coin || 0;
  calcWinLossPreview('edit');
  document.getElementById('edit-note').value      = rec.note    || '';

  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

document.getElementById('editRecordForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;

  const casinoSelectVal = document.getElementById('edit-casino').value;
  let casinoName = casinoSelectVal;
  if (casinoSelectVal === 'custom') {
    casinoName = document.getElementById('edit-custom-casino').value.trim() || '自訂賭場';
  }

  const gameType   = document.getElementById('edit-game-type').value;
  let gameName     = document.getElementById('edit-game').value;
  const customGame = document.getElementById('edit-custom-game').value.trim();
  if (gameName.includes('其他') || customGame) gameName = customGame || gameName;

  const updates = {
    datetime:  document.getElementById('edit-datetime').value,
    casino:    casinoName,
    area:      document.getElementById('edit-area').value.trim(),
    game_type: gameType,
    game:      gameName,
    points:     parseFloat(document.getElementById('edit-points').value) || 0,
    avg_bet:    parseFloat(document.getElementById('edit-avg-bet').value) || 0,
    start_coin: parseFloat(document.getElementById('edit-start-coin').value) || 0,
    end_coin:   parseFloat(document.getElementById('edit-end-coin').value) || 0,
    note:      document.getElementById('edit-note').value.trim(),
  };
  // 自動計算盈虧：結束本金 - 起始本金（正=贏，負=輸）
  updates.win_loss = (updates.end_coin || 0) - (updates.start_coin || 0);

  try {
    await dbUpdateRecord(id, updates);
    const idx = _records.findIndex(r => r.id === id);
    if (idx !== -1) _records[idx] = { ..._records[idx], ...updates };
    closeEditModal();
    showToast('✅ 記錄已更新');
    renderHistory();
    updateDashboard();
  } catch (err) {
    window._safeToast('❌ 更新失敗：' + err.message, true);
  }
});

// ==============================
// Edit Promo Modal
// ==============================
function openEditPromoModal(id) {
  const promo = _promos.find(p => p.id === id);
  if (!promo) return;

  // 判定是 F&B 哪個子類（fb_*），還是主類
  const isFbSub = promo.category?.startsWith('fb_');
  const mainCat = isFbSub ? 'fb' : (promo.category || 'fb');

  document.getElementById('ep-id').value               = promo.id;
  document.getElementById('ep-date').value             = promo.date || '';
  document.getElementById('ep-category').value         = mainCat;
  populateCasinoSelect(document.getElementById('ep-casino'), promo.casino || '');

  // F&B 次選項
  const epFbSub  = document.getElementById('ep-fb-sub-group');
  if (isFbSub) {
    document.getElementById('ep-fb-sub').value = promo.category;
    if (epFbSub) epFbSub.style.display = '';
  } else {
    if (epFbSub) epFbSub.style.display = 'none';
  }

  // 價格行（只在 gaming credit 顯示）
  const epPriceRow = document.getElementById('ep-price-row');
  const isGamingCredit = (mainCat === 'table_credit' || mainCat === 'slot_credit');
  if (epPriceRow) epPriceRow.style.display = isGamingCredit ? '' : 'none';
  document.getElementById('ep-price').value = isGamingCredit ? (promo.price || '') : '';

  document.getElementById('ep-item').value            = promo.item || '';
  document.getElementById('ep-point-type').value      = promo.point_type || 'daily';
  document.getElementById('ep-points-required').value  = promo.points_required || 0;
  document.getElementById('ep-days').value            = promo.days || '';
  document.getElementById('ep-note').value            = promo.note || '';

  document.getElementById('editPromoModal').style.display = 'flex';
}

function closeEditPromoModal() {
  document.getElementById('editPromoModal').style.display = 'none';
}

document.getElementById('editPromoForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const id = document.getElementById('ep-id').value;

  // 決定最終類別：選擇「餐飲」時用次選項值
  const mainCat = document.getElementById('ep-category').value;
  const finalCat = mainCat === 'fb'
    ? document.getElementById('ep-fb-sub').value
    : mainCat;

  // 價格只在 gaming credit 有意義
  const hasPrice = (mainCat === 'table_credit' || mainCat === 'slot_credit');
  const price = hasPrice ? parseFloat(document.getElementById('ep-price').value) || 0 : 0;

  const updates = {
    date:            document.getElementById('ep-date').value,
    casino:          document.getElementById('ep-casino').value || '',
    category:        finalCat,
    item:            document.getElementById('ep-item').value.trim(),
    point_type:      document.getElementById('ep-point-type').value,
    points_required: parseFloat(document.getElementById('ep-points-required').value) || 0,
    days:            parseInt(document.getElementById('ep-days').value) || null,
    price:           price,
    note:            document.getElementById('ep-note').value.trim(),
  };

  try {
    await dbUpdatePromo(id, updates);
    const idx = _promos.findIndex(p => p.id === id);
    if (idx !== -1) _promos[idx] = { ..._promos[idx], ...updates };
    closeEditPromoModal();
    showToast('✅ 優惠記錄已更新');
    updatePromoDashboard();
    renderPromos();
  } catch (err) {
    window._safeToast('❌ 更新失敗：' + err.message, true);
  }
});

// ==============================
// Delete Modal
// ==============================
let _deleteTarget = null;

function openDeleteModal(id, type) {
  _deleteTarget = { id, type };
  document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
  _deleteTarget = null;
  document.getElementById('deleteModal').style.display = 'none';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!_deleteTarget) return;
  const { id, type } = _deleteTarget;
  try {
    if (type === 'record') {
      await dbDeleteRecord(id);
      _records = _records.filter(r => r.id !== id);
      renderHistory();
      updateDashboard();
      showToast('🗑️ 記錄已刪除');
    } else if (type === 'promo') {
      await dbDeletePromo(id);
      _promos = _promos.filter(p => p.id !== id);
      updatePromoDashboard();
      renderPromos();
      showToast('🗑️ 優惠已刪除');
    }
  } catch (err) {
    window._safeToast('❌ 刪除失敗：' + err.message, true);
  }
  closeDeleteModal();
});

// Close modals on overlay click
['editModal','editPromoModal','deleteModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) {
      if (id === 'editModal')        closeEditModal();
      if (id === 'editPromoModal')  closeEditPromoModal();
      if (id === 'deleteModal')     closeDeleteModal();
    }
  });
});

// ==============================
// Toast
// ==============================
let _toastTimer = null;
function showToast(msg) {
  try {
    const el = document.getElementById('toast');
    if (!el) { console.warn('[TOAST] #toast element not found in DOM'); return; }
    el.textContent = msg;
    el.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  } catch (e) {
    console.error('[TOAST] showToast failed:', e);
  }
}

// ==============================
// Init（等待 Auth Guard 完成後觸發）
// ==============================
async function initApp() {
  await loadFromDB();
  initForms();
  updateDashboard();
}

// auth-ready 事件由 index.html 的 auth script 觸發
window.addEventListener('auth-ready', () => {
  initApp();
});

// Fallback 1: 如果 auth-ready 已經觸發過，立即執行
if (window.__AUTH_READY__) {
  initApp();
}

// Fallback 2: Poll 等待 Supabase session restore 完成
let _initPolled = false;
async function pollForSession() {
  if (_initPolled || getUserId()) return;
  _initPolled = true;
  // 等 Supabase 完成 session restore（最多 5 秒）
  for (let i = 0; i < 50; i++) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      setUserId(data.session.user.id);
      await initApp();
      return;
    }
    await new Promise(r => setTimeout(r, 100));
  }
}
pollForSession();

// Fallback: 立即填充 casino selects（auth 前就應該有資料）
(function populateCasinoSelectsImmediately() {
  const promoCasino = document.getElementById('promo-casino');
  if (promoCasino) populateCasinoSelect(promoCasino);
  const filterCasino = document.getElementById('promo-filter-casino');
  if (filterCasino) populateCasinoSelect(filterCasino);
  const recCasino = document.getElementById('rec-casino');
  if (recCasino) populateCasinoSelect(recCasino);
})();

// ==============================
// 將所有 inline handler 函數暴露到 window
//（app.js 是 ES Module，函數預設不在 window 上）
// ==============================

// 自動計算盈虧預覽（共用：prefix = 'rec' 或 'edit'）
function calcWinLossPreview(prefix) {
  const sc = parseFloat(document.getElementById(`${prefix}-start-coin`).value) || 0;
  const ec = parseFloat(document.getElementById(`${prefix}-end-coin`).value) || 0;
  const wl = ec - sc;
  const el = document.getElementById(`${prefix}-winloss-display`);
  if (!el) return;
  if (sc === 0 && ec === 0) {
    el.value = '—';
    el.style.color = 'var(--gold)';
    return;
  }
  const sign = wl >= 0 ? '+' : '';
  el.value = `${sign}${wl.toLocaleString()} HKD`;
  el.style.color = wl > 0 ? '#4CAF50' : wl < 0 ? '#F44336' : 'var(--gold)';
}

window.onCasinoChange           = onCasinoChange;
window.onGameTypeChange         = onGameTypeChange;
window.onGameChange             = onGameChange;
window.onEditCasinoChange       = onEditCasinoChange;
window.onEditGameTypeChange     = onEditGameTypeChange;
window.onEditGameChange         = onEditGameChange;
window.onPromoCategoryChange    = onPromoCategoryChange;
window.onEditPromoCategoryChange = onEditPromoCategoryChange;
window.togglePromoDays          = togglePromoDays;
window.togglePromoSummary       = togglePromoSummary;
window.togglePromoList          = togglePromoList;
window.renderHistory        = renderHistory;
window.renderPromos          = renderPromos;
window.openEditModal         = openEditModal;
window.openEditPromoModal   = openEditPromoModal;
window.openDeleteModal       = openDeleteModal;
window.closeEditModal        = closeEditModal;
window.closeEditPromoModal  = closeEditPromoModal;
window.calcWinLossPreview   = calcWinLossPreview;
window.closeDeleteModal     = closeDeleteModal;
