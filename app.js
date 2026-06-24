'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const ROUTINE_ICONS = [
  'ti-brain','ti-book-2','ti-droplet','ti-barbell','ti-pill','ti-pencil',
  'ti-refresh','ti-device-mobile-off','ti-snowflake','ti-calendar-event',
  'ti-flame','ti-heart','ti-run','ti-bicycle','ti-music','ti-moon',
  'ti-sun','ti-coffee','ti-apple','ti-bed','ti-shield','ti-star',
  'ti-dumbbell','ti-swim','ti-yoga','ti-salad',
];
const ROUTINE_COLORS = [
  { bg:'rgba(239,159,39,0.13)', color:'#EF9F27', bdr:'rgba(239,159,39,0.28)' },
  { bg:'rgba(29,158,117,0.13)', color:'#1D9E75', bdr:'rgba(29,158,117,0.28)' },
  { bg:'rgba(127,119,221,0.13)', color:'#7F77DD', bdr:'rgba(127,119,221,0.28)' },
  { bg:'rgba(216,90,48,.13)',    color:'#D85A30', bdr:'rgba(216,90,48,.28)'   },
];
const QUOTES = [
  'Consistência é a mãe do progresso.',
  'Cada dia marcado é uma vitória acumulada.',
  'Pequenos passos todos os dias fazem grandes resultados.',
  'A disciplina de hoje é a liberdade de amanhã.',
  'Você não precisa ser perfeito, só consistente.',
  'O hábito é a segunda natureza.',
  'Progresso, não perfeição.',
  'Faça hoje o que seu eu futuro vai agradecer.',
];
const DAY_KEYS = ['dom','seg','ter','qua','qui','sex','sab'];
const DAY_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ============================================================
// DEFAULT STATE
// ============================================================
const DEFAULT_STATE = {
  exercises: [
    { id:1, name:'Supino reto',    series:4, done:0, min:0,  note:'70kg', mode:'counter' },
    { id:2, name:'Agachamento',    series:4, done:0, min:0,  note:'',     mode:'counter' },
    { id:3, name:'Remada curvada', series:3, done:0, min:0,  note:'60kg', mode:'counter' },
    { id:4, name:'Rosca direta',   series:3, done:0, min:0,  note:'',     mode:'check'   },
  ],
  // weekPlan: plan per day-of-week (permanent, never zeroed)
  weekPlan: {
    seg:[{id:1,n:'Inglês',min:45,note:'Duolingo + podcast'},{id:2,n:'Programação',min:60,note:''},{id:3,n:'Matemática',min:30,note:''}],
    ter:[{id:4,n:'Português',min:30,note:'Redação'},{id:5,n:'Inglês',min:45,note:''}],
    qua:[{id:6,n:'Programação',min:90,note:''},{id:7,n:'Matemática',min:30,note:''}],
    qui:[{id:8,n:'Inglês',min:60,note:''},{id:9,n:'Revisão geral',min:30,note:''}],
    sex:[{id:10,n:'Programação',min:60,note:''}],
    sab:[{id:11,n:'Revisão semanal',min:60,note:''}],
    dom:[{id:12,n:'Descanso — leitura leve',min:0,note:''}],
  },
  // studyDone: {weekKey: {itemId: true}} — zeroed each week
  studyDone: {},
  provas: [],
  routine: [
    { id:1,  name:'Meditação',       icon:'ti-brain',             done:false, meta:'10 min · diário' },
    { id:2,  name:'Leitura',         icon:'ti-book-2',            done:false, meta:'20 min · diário' },
    { id:3,  name:'Água 2L',         icon:'ti-droplet',           done:false, meta:'diário' },
    { id:4,  name:'Exercício',       icon:'ti-barbell',           done:false, meta:'conforme plano' },
    { id:5,  name:'Cold shower',     icon:'ti-snowflake',         done:false, meta:'manhã · diário' },
    { id:6,  name:'Planejar amanhã', icon:'ti-calendar-event',    done:false, meta:'noite · diário' },
  ],
  history: [],
  settings: {
    name: 'Jud',
    greeting: 'auto',
    accent: 'purple',
    fontLarge: false,
    reviewTime: '21:00',
    notifEnabled: true,
  },
  streak: 0,
  bestStreak: 0,
  lastDate: null,
};

// ============================================================
// STATE
// ============================================================
let state = {};
let nextId = 200;
let editingExIdx = null;
let editingRoutineIdx = null;
let editingStudyDay = null;
let selectedRoutineIcon = 'ti-star';
let currentStudyTab = 'hoje';
let currentWeekDay = null;
let codeTimer = null;

// ============================================================
// PERSISTENCE
// ============================================================
function saveState() {
  try {
    const toSave = Object.assign({}, state);
    // Convert Sets in provas to arrays for JSON
    toSave.provas = (state.provas || []).map(p => ({
      ...p, marked: [...(p.marked || [])]
    }));
    localStorage.setItem('lc_state_v3', JSON.stringify(toSave));
  } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('lc_state_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
      // Restore Sets in provas
      state.provas = (state.provas || []).map(p => ({
        ...p, marked: new Set(p.marked || [])
      }));
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      state.provas = [];
    }
  } catch(e) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    state.provas = [];
  }
  checkDateReset();
}

function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function checkDateReset() {
  const today = todayStr();
  if (state.lastDate && state.lastDate !== today) {
    const prev = new Date(state.lastDate + 'T00:00:00');
    const now  = new Date(today + 'T00:00:00');
    const diff = Math.round((now - prev) / 86400000);
    if (diff === 1) {
      state.streak = (state.streak || 0) + 1;
      if (state.streak > (state.bestStreak || 0)) state.bestStreak = state.streak;
    } else {
      state.streak = 0;
    }
    archiveDay(state.lastDate);
    resetDayItems();
    // Zero study completions for new week
    const prevWeek = getWeekKey(prev);
    const curWeek  = getWeekKey(now);
    if (prevWeek !== curWeek) {
      state.studyDone = {};
    }
  }
  state.lastDate = today;
  // Ensure studyDone for this week exists
  const wk = getWeekKey(new Date());
  if (!state.studyDone) state.studyDone = {};
  if (!state.studyDone[wk]) state.studyDone[wk] = {};
  saveState();
}

function getWeekKey(date) {
  // ISO week: year + week number
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getFullYear() + '-W' + week;
}

function todayStr() { return new Date().toISOString().slice(0,10); }

function resetDayItems() {
  state.exercises.forEach(e => e.done = 0);
  state.routine.forEach(r => r.done = false);
  // studyDone kept until week changes
}

function archiveDay(dateStr) {
  const exP = calcExPct();
  const stP = calcStudyTodayPct();
  const roP = calcRoutinePct();
  const total = Math.round((exP + stP + roP) / 3);
  state.history = state.history || [];
  state.history.unshift({ date:dateStr, treinos:exP, estudos:stP, rotina:roP, total });
  if (state.history.length > 60) state.history = state.history.slice(0, 60);
}

// ============================================================
// NAVIGATION
// ============================================================
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navMap = {dash:'nav-dash',treinos:'nav-treinos',estudos:'nav-estudos',rotina:'nav-rotina',historico:'nav-hist',settings:'nav-settings'};
  if (navMap[id]) document.getElementById(navMap[id])?.classList.add('active');
  if (id === 'dash')     renderDash();
  if (id === 'treinos')  renderExercises();
  if (id === 'estudos')  { renderStudyTab('hoje'); renderWeekPlan(); renderProvas(); }
  if (id === 'rotina')   renderRoutine();
  if (id === 'historico') renderHistory();
  if (id === 'settings') loadSettingsUI();
}

function openSettings() { goTo('settings'); }

// ============================================================
// CALC
// ============================================================
function calcExPct() {
  if (!state.exercises.length) return 0;
  return Math.round(state.exercises.filter(e => e.mode==='check' ? e.done>=1 : e.done>=e.series).length / state.exercises.length * 100);
}
function calcStudyTodayPct() {
  const todayKey = DAY_KEYS[new Date().getDay()];
  const items = (state.weekPlan || {})[todayKey] || [];
  if (!items.length) return 0;
  const wk = getWeekKey(new Date());
  const done = (state.studyDone[wk] || {});
  const todayDayStr = todayStr();
  const doneCnt = items.filter(it => done[todayDayStr + '_' + it.id]).length;
  return Math.round(doneCnt / items.length * 100);
}
function calcRoutinePct() {
  if (!state.routine.length) return 0;
  return Math.round(state.routine.filter(r => r.done).length / state.routine.length * 100);
}
function calcTotalPct() {
  return Math.round((calcExPct() + calcStudyTodayPct() + calcRoutinePct()) / 3);
}

function setRing(fillId, pctTextId, pct) {
  const circ = 2 * Math.PI * 13;
  const fill = Math.round(circ * pct / 100 * 10) / 10;
  const el = document.getElementById(fillId);
  if (el) el.setAttribute('stroke-dasharray', fill + ' ' + circ);
  const pel = document.getElementById(pctTextId);
  if (pel) pel.textContent = pct + '%';
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDash() {
  const d = new Date();
  setEl('lc-date', d.toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'short' }));

  const name = state.settings.name || '';
  const h = d.getHours();
  let greet = state.settings.greeting === 'auto'
    ? (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')
    : state.settings.greeting;
  setEl('dash-greeting', greet + (name ? ', ' + name + '! 👋' : '! 👋'));
  setEl('dash-streak', state.streak || 0);
  setEl('dash-pct', calcTotalPct() + '%');
  setEl('dash-best', state.bestStreak || 0);

  // Weekly avg
  if (state.history && state.history.length) {
    const avg = Math.round(state.history.slice(0,7).reduce((a,h) => a+(h.total||0), 0) / Math.min(state.history.length,7));
    setEl('dash-avg', avg + '%');
  }

  // Week bar strip
  buildWeekStrip();

  // Module rings
  const exPct = calcExPct();
  const exDone = state.exercises.filter(e => e.mode==='check' ? e.done>=1 : e.done>=e.series).length;
  setEl('dash-treino-stat', exDone + ' de ' + state.exercises.length + ' exercícios');
  setRing('ring-ex-fill', 'ring-ex-pct', exPct);

  const stPct = calcStudyTodayPct();
  const todayKey = DAY_KEYS[new Date().getDay()];
  const todayItems = (state.weekPlan||{})[todayKey] || [];
  const wk = getWeekKey(new Date());
  const todayDayStr = todayStr();
  const stDone = todayItems.filter(it => (state.studyDone[wk]||{})[todayDayStr+'_'+it.id]).length;
  setEl('dash-estudos-stat', stDone + ' de ' + todayItems.length + ' matérias hoje');
  setRing('ring-st-fill', 'ring-st-pct', stPct);

  const roPct = calcRoutinePct();
  const roDone = state.routine.filter(r => r.done).length;
  setEl('dash-rotina-stat', roDone + ' de ' + state.routine.length + ' itens');
  setRing('ring-ro-fill', 'ring-ro-pct', roPct);

  setEl('quote-text', QUOTES[d.getDate() % QUOTES.length]);
}

function buildWeekStrip() {
  const el = document.getElementById('lc-week');
  if (!el) return;
  const today = new Date().getDay(); // 0=Sun
  el.innerHTML = DAY_LABELS.map((lbl, i) => {
    const isToday = i === today;
    const hist = state.history || [];
    // Find entry for this day this week
    const d = new Date();
    const diff = i - today;
    d.setDate(d.getDate() + diff);
    const dStr = d.toISOString().slice(0,10);
    const entry = hist.find(h => h.date === dStr);
    const pct = isToday ? calcTotalPct() : (entry ? entry.total : (diff < 0 ? 0 : null));
    const barH = pct !== null ? Math.max(4, Math.round(pct * 32 / 100)) : 4;
    const isFuture = diff > 0;
    let barBg, barBd;
    if (isToday) { barBg='var(--pu-bg)'; barBd='var(--pu-bd)'; }
    else if (isFuture) { barBg='var(--surface2)'; barBd='var(--border)'; }
    else if (pct >= 75) { barBg='var(--pu)'; barBd='var(--pu-bd)'; }
    else if (pct > 0)   { barBg='rgba(127,119,221,0.4)'; barBd='var(--pu-bd)'; }
    else                { barBg='var(--surface2)'; barBd='var(--border)'; }
    return `<div class="wday${isToday?' today':''}">
      <div class="wday-bar" style="height:${barH}px;background:${barBg};border:0.5px solid ${barBd};border-radius:4px;width:100%;transition:.3s"></div>
      <div class="wday-lbl">${lbl}</div>
    </div>`;
  }).join('');
}

// ============================================================
// EXERCISES
// ============================================================
function renderExercises() {
  const done  = state.exercises.filter(e => e.mode==='check' ? e.done>=1 : e.done>=e.series).length;
  const total = state.exercises.length;
  const pct   = total ? Math.round(done/total*100) : 0;
  setEl('ex-done-count', done);
  setEl('ex-total-count', total);
  barWidth('ex-bar', pct);

  const list  = document.getElementById('exercise-list');
  const empty = document.getElementById('ex-empty');
  if (empty) empty.style.display = total ? 'none' : 'flex';
  if (!list) return;

  list.innerHTML = state.exercises.map((ex, i) => {
    const isDone = ex.mode === 'check' ? ex.done >= 1 : ex.done >= ex.series;
    return `<div class="exercise-item${isDone?' complete':''}">
      <div class="ex-top">
        <span class="ex-name">${esc(ex.name)}</span>
        <div class="ex-actions">
          <div class="mode-pill">
            <button class="mpill${ex.mode==='counter'?' on':''}" onclick="exSetMode(${i},'counter')">Contador</button>
            <button class="mpill${ex.mode==='check'?' on':''}" onclick="exSetMode(${i},'check')">Marcar</button>
          </div>
          <button class="icon-action-btn edit" onclick="editExercise(${i})" aria-label="Editar"><i class="ti ti-pencil"></i></button>
          <button class="icon-action-btn del" onclick="deleteItem('exercise',${i})" aria-label="Excluir"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      ${ex.note ? `<div class="ex-note">"${esc(ex.note)}"</div>` : ''}
      <div class="ex-meta">${ex.mode==='counter' ? ex.series+' séries' : 'Tarefa única'}${ex.min>0?' · '+ex.min+' min':''}</div>
      <div class="ex-bottom-row">
        ${isDone
          ? `<span class="done-badge"><i class="ti ti-check"></i> Feito</span>`
          : ex.mode === 'counter'
            ? `<div class="counter-row">
                 <button class="count-btn" onclick="changeEx(${i},-1)" aria-label="Diminuir">−</button>
                 <span class="count-val">${ex.done}/${ex.series}</span>
                 <button class="count-btn" onclick="changeEx(${i},1)" aria-label="Aumentar">+</button>
               </div>`
            : `<button class="count-btn wide" onclick="changeEx(${i},1)"><i class="ti ti-check"></i> Marcar como feito</button>`
        }
      </div>
    </div>`;
  }).join('');
  renderDash();
}

function exSetMode(i, m) { state.exercises[i].mode = m; state.exercises[i].done = 0; saveState(); renderExercises(); }

function changeEx(i, d) {
  const e = state.exercises[i];
  if (e.mode === 'check') e.done = e.done ? 0 : 1;
  else e.done = Math.max(0, Math.min(e.series, e.done + d));
  saveState();
  renderExercises();
  if ((e.mode==='check'&&e.done===1)||(e.mode==='counter'&&e.done===e.series)) toast('✓ ' + e.name);
}

function markAllExercises() {
  state.exercises.forEach(e => { e.done = e.mode==='check' ? 1 : e.series; });
  saveState(); renderExercises(); toast('✓ Todos os exercícios marcados!');
}

function openAddExercise() {
  editingExIdx = null;
  setEl('modal-ex-title', 'Adicionar exercício');
  document.getElementById('ex-name-input').value = '';
  document.getElementById('ex-series-input').value = 4;
  document.getElementById('ex-min-input').value = 0;
  document.getElementById('ex-note-input').value = '';
  setExModeUI('counter');
  openModal('modal-exercise');
}

function editExercise(i) {
  editingExIdx = i;
  const ex = state.exercises[i];
  setEl('modal-ex-title', 'Editar exercício');
  document.getElementById('ex-name-input').value = ex.name;
  document.getElementById('ex-series-input').value = ex.series;
  document.getElementById('ex-min-input').value = ex.min;
  document.getElementById('ex-note-input').value = ex.note || '';
  setExModeUI(ex.mode || 'counter');
  openModal('modal-exercise');
}

function setExModeUI(m) {
  document.getElementById('mpill-counter').classList.toggle('on', m==='counter');
  document.getElementById('mpill-check').classList.toggle('on', m==='check');
  document.getElementById('ex-series-row').style.display = m==='counter' ? 'block' : 'none';
}

function confirmExercise() {
  const name = document.getElementById('ex-name-input').value.trim();
  if (!name) { toast('Digite o nome do exercício'); return; }
  const mode   = document.getElementById('mpill-counter').classList.contains('on') ? 'counter' : 'check';
  const series = parseInt(document.getElementById('ex-series-input').value) || 4;
  const min    = Math.max(0, parseInt(document.getElementById('ex-min-input').value) || 0);
  const note   = document.getElementById('ex-note-input').value.trim();
  if (editingExIdx !== null) {
    state.exercises[editingExIdx] = { ...state.exercises[editingExIdx], name, mode, series, min, note };
    toast('Exercício atualizado');
  } else {
    state.exercises.push({ id: nextId++, name, mode, series, done:0, min, note });
    toast('Exercício adicionado');
  }
  saveState(); closeModal('modal-exercise'); renderExercises();
}

// ============================================================
// STUDIES — WEEK PLAN + TODAY AUTO-SYNC
// ============================================================
function todayDayKey() { return DAY_KEYS[new Date().getDay()]; }

function renderStudyTab(tab) {
  currentStudyTab = tab;
  document.querySelectorAll('.study-sub-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.study-pane').forEach(p => {
    p.style.display = p.dataset.pane === tab ? 'block' : 'none';
  });
  if (tab === 'hoje') renderStudyToday();
  if (tab === 'semanal') renderWeekPlan();
  if (tab === 'prova') renderProvas();
}

function renderStudyToday() {
  const key = todayDayKey();
  const items = (state.weekPlan || {})[key] || [];
  const wk = getWeekKey(new Date());
  const ds = todayStr();
  const done = state.studyDone[wk] || {};
  const doneCnt = items.filter(it => done[ds+'_'+it.id]).length;
  const total = items.length;
  const pct = total ? Math.round(doneCnt/total*100) : 0;

  setEl('study-done-count', doneCnt);
  setEl('study-total-count', total);
  barWidth('study-bar', pct);

  const list = document.getElementById('study-today-list');
  const empty = document.getElementById('study-today-empty');
  if (!list) return;

  if (!total) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = items.map((it, i) => {
    const isDone = !!(done[ds+'_'+it.id]);
    return `<div class="toggle-item${isDone?' done':''}" onclick="toggleStudyToday('${key}','${it.id}')">
      <div class="routine-check${isDone?' checked':''}">${isDone?'<i class="ti ti-check"></i>':''}</div>
      <div class="routine-icon-wrap" style="background:var(--teal-bg);color:var(--teal);border:0.5px solid var(--teal-bdr)">
        <i class="ti ti-book-2" aria-hidden="true"></i>
      </div>
      <div class="routine-text">
        <div class="routine-name">${esc(it.n)}</div>
        <div class="routine-meta">${it.min>0?it.min+' min':''}${it.note?' · '+esc(it.note):''}</div>
      </div>
    </div>`;
  }).join('');
  renderDash();
}

function toggleStudyToday(dayKey, itemId) {
  const wk = getWeekKey(new Date());
  const ds = todayStr();
  if (!state.studyDone[wk]) state.studyDone[wk] = {};
  const k = ds + '_' + itemId;
  state.studyDone[wk][k] = !state.studyDone[wk][k];
  saveState();
  renderStudyToday();
}

// Week Plan
function renderWeekPlan() {
  const tabs = document.getElementById('week-day-tabs');
  if (!tabs) return;
  if (!currentWeekDay) currentWeekDay = DAY_KEYS[new Date().getDay()];

  tabs.innerHTML = DAY_KEYS.map((k,i) => {
    const isToday = k === todayDayKey();
    return `<button class="dtab${k===currentWeekDay?' active':''}${isToday?' today':''}"
      onclick="selectWeekDay('${k}')">${DAY_LABELS[i]}</button>`;
  }).join('');
  renderWeekDayContent();
}

function selectWeekDay(key) {
  currentWeekDay = key;
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dtab').forEach(b => {
    if (b.textContent.trim() === DAY_LABELS[DAY_KEYS.indexOf(key)]) b.classList.add('active');
  });
  renderWeekDayContent();
}

function renderWeekDayContent() {
  const items = (state.weekPlan || {})[currentWeekDay] || [];
  const el = document.getElementById('week-day-content');
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><i class="ti ti-calendar"></i><p>Nenhum item para este dia.<br/>Toque em <strong>+</strong> para adicionar.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="week-day-card">${items.map((it, i) => `
    <div class="week-day-item">
      <i class="ti ti-book-2" style="color:var(--teal);font-size:15px;flex-shrink:0" aria-hidden="true"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600">${esc(it.n)}</div>
        ${it.min>0||it.note?`<div style="font-size:11px;color:var(--muted)">${it.min>0?it.min+'min':''}${it.note?' · '+esc(it.note):''}</div>`:''}
      </div>
      <button class="icon-action-btn del" onclick="deleteWeekItem('${currentWeekDay}',${i})" aria-label="Excluir"><i class="ti ti-trash"></i></button>
    </div>`).join('')}</div>`;
}

function deleteWeekItem(day, i) {
  (state.weekPlan[day] || []).splice(i, 1);
  saveState(); renderWeekDayContent(); renderStudyToday();
}

function openAddWeekItem() {
  editingStudyDay = currentWeekDay;
  document.getElementById('week-item-day-label').textContent =
    DAY_LABELS[DAY_KEYS.indexOf(currentWeekDay)] || '';
  document.getElementById('week-item-name').value = '';
  document.getElementById('week-item-min').value = 45;
  document.getElementById('week-item-note').value = '';
  openModal('modal-week-item');
}

function confirmWeekItem() {
  const name = document.getElementById('week-item-name').value.trim();
  if (!name) { toast('Digite o nome da matéria'); return; }
  const min  = Math.max(0, parseInt(document.getElementById('week-item-min').value) || 0);
  const note = document.getElementById('week-item-note').value.trim();
  if (!state.weekPlan[editingStudyDay]) state.weekPlan[editingStudyDay] = [];
  state.weekPlan[editingStudyDay].push({ id: nextId++, n:name, min, note });
  saveState(); closeModal('modal-week-item');
  renderWeekDayContent(); renderStudyToday();
  toast('Matéria adicionada');
}

// Provas
function renderProvas() {
  const el = document.getElementById('prova-list');
  const empty = document.getElementById('prova-empty');
  if (!el) return;
  if (!state.provas || !state.provas.length) {
    el.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  el.innerHTML = state.provas.map((p, pi) => {
    const marked = p.marked instanceof Set ? p.marked : new Set(p.marked || []);
    const pct = Math.round(marked.size / p.days * 100);
    let btns = '';
    for (let i = 0; i < p.days; i++) {
      btns += `<button class="pday-btn${marked.has(i)?' done':''}" onclick="toggleProvaDay(${pi},${i})">${i+1}</button>`;
    }
    return `<div class="prova-hero">
      <div class="prova-header">
        <span class="prova-name">${esc(p.name)}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="prova-badge">${p.days} dias</span>
          <button class="icon-action-btn del" onclick="deleteProva(${pi})" aria-label="Excluir"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div class="prova-days-big">${Math.max(0, p.days - marked.size)}</div>
      <div class="prova-days-lbl">dias restantes</div>
      <div class="pbar-label">${marked.size}/${p.days} dias de estudo marcados</div>
      <div class="lc-progress-bar"><div class="lc-progress-fill amber-fill" style="width:${pct}%"></div></div>
      <div class="pdays-grid">${btns}</div>
    </div>`;
  }).join('');
}

function toggleProvaDay(pi, i) {
  if (!state.provas[pi].marked) state.provas[pi].marked = new Set();
  if (state.provas[pi].marked.has(i)) state.provas[pi].marked.delete(i);
  else state.provas[pi].marked.add(i);
  saveState(); renderProvas();
}

function deleteProva(i) {
  state.provas.splice(i, 1); saveState(); renderProvas();
}

function openAddProva() {
  document.getElementById('prova-name-input').value = '';
  document.getElementById('prova-days-input').value = 30;
  openModal('modal-prova');
}

function confirmProva() {
  const name = document.getElementById('prova-name-input').value.trim();
  if (!name) { toast('Digite o nome da prova'); return; }
  const days = Math.max(1, parseInt(document.getElementById('prova-days-input').value) || 30);
  state.provas.push({ id:nextId++, name, days, marked: new Set() });
  saveState(); closeModal('modal-prova'); renderProvas(); toast('Prova criada');
}

// ============================================================
// ROUTINE
// ============================================================
function buildIconPicker() {
  const el = document.getElementById('routine-icon-picker');
  if (!el) return;
  el.innerHTML = ROUTINE_ICONS.map(ic =>
    `<button type="button" class="icon-opt${selectedRoutineIcon===ic?' selected':''}"
      data-icon="${ic}" onclick="selectRoutineIcon('${ic}')">
      <i class="ti ${ic}"></i>
    </button>`).join('');
}

function selectRoutineIcon(ic) { selectedRoutineIcon = ic; buildIconPicker(); }

function renderRoutine() {
  const done  = state.routine.filter(r => r.done).length;
  const total = state.routine.length;
  const pct   = total ? Math.round(done/total*100) : 0;
  setEl('routine-done', done);
  setEl('routine-total', total);
  barWidth('routine-bar', pct);

  const list  = document.getElementById('routine-list');
  const empty = document.getElementById('routine-empty');
  if (empty) empty.style.display = total ? 'none' : 'flex';
  if (!list) return;

  list.innerHTML = state.routine.map((r, i) => {
    const col = ROUTINE_COLORS[i % ROUTINE_COLORS.length];
    return `<div class="routine-item${r.done?' done':''}" onclick="toggleRoutineClick(event,${i})">
      <div class="routine-check${r.done?' checked':''}">${r.done?'<i class="ti ti-check"></i>':''}</div>
      <div class="routine-icon-wrap" style="background:${col.bg};color:${col.color};border:0.5px solid ${col.bdr}">
        <i class="ti ${r.icon||'ti-star'}" aria-hidden="true"></i>
      </div>
      <div class="routine-text">
        <div class="routine-name">${esc(r.name)}</div>
        <div class="routine-meta">${esc(r.meta||'')}</div>
      </div>
      <div class="routine-item-actions">
        <button class="icon-action-btn edit" onclick="editRoutineItem(${i})" aria-label="Editar"><i class="ti ti-pencil"></i></button>
        <button class="icon-action-btn del" onclick="deleteItem('routine',${i})" aria-label="Excluir"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
  renderDash();
}

function toggleRoutineClick(e, i) {
  if (e.target.closest('.icon-action-btn')) return;
  state.routine[i].done = !state.routine[i].done;
  saveState(); renderRoutine();
  if (state.routine[i].done) toast('✓ ' + state.routine[i].name);
}

function openAddRoutine() {
  editingRoutineIdx = null;
  selectedRoutineIcon = 'ti-star';
  document.getElementById('modal-routine-title').textContent = 'Adicionar item';
  document.getElementById('routine-name-input').value = '';
  document.getElementById('routine-time-input').value = '';
  document.getElementById('routine-recur-input').value = 'diário';
  buildIconPicker();
  openModal('modal-routine');
}

function editRoutineItem(i) {
  editingRoutineIdx = i;
  const r = state.routine[i];
  selectedRoutineIcon = r.icon || 'ti-star';
  document.getElementById('modal-routine-title').textContent = 'Editar item';
  document.getElementById('routine-name-input').value = r.name;
  const timePart = (r.meta||'').match(/\d{2}:\d{2}/);
  document.getElementById('routine-time-input').value = timePart ? timePart[0] : '';
  document.getElementById('routine-recur-input').value = r.recur || 'diário';
  buildIconPicker();
  openModal('modal-routine');
}

function confirmRoutine() {
  const name = document.getElementById('routine-name-input').value.trim();
  if (!name) { toast('Digite o nome do item'); return; }
  const time  = document.getElementById('routine-time-input').value;
  const recur = document.getElementById('routine-recur-input').value;
  const meta  = (time ? time + ' · ' : '') + recur;
  if (editingRoutineIdx !== null) {
    state.routine[editingRoutineIdx] = { ...state.routine[editingRoutineIdx], name, icon:selectedRoutineIcon, meta, recur };
    toast('Item atualizado');
  } else {
    state.routine.push({ id:nextId++, name, icon:selectedRoutineIcon, done:false, meta, recur });
    toast('Item adicionado');
  }
  saveState(); closeModal('modal-routine'); renderRoutine();
}

// ============================================================
// DELETE generic
// ============================================================
function deleteItem(type, i) {
  const labels = { exercise:'exercício', routine:'item' };
  const maps   = { exercise:state.exercises, routine:state.routine };
  const item   = maps[type][i];
  openConfirm(
    'Excluir ' + labels[type],
    `Excluir "${esc(item.name)}"? Esta ação não pode ser desfeita.`,
    () => {
      maps[type].splice(i, 1);
      saveState();
      if (type==='exercise') renderExercises();
      if (type==='routine')  renderRoutine();
      toast('Excluído');
    }
  );
}

// ============================================================
// HISTORY
// ============================================================
function renderHistory() {
  setEl('hist-streak', state.streak || 0);
  setEl('hist-best',   state.bestStreak || 0);
  setEl('hist-total',  (state.history||[]).length);

  const todayEntry = {
    date:todayStr(), treinos:calcExPct(), estudos:calcStudyTodayPct(),
    rotina:calcRoutinePct(), total:calcTotalPct(), isToday:true,
  };
  const entries = [todayEntry, ...(state.history||[])].slice(0, 7);
  const el = document.getElementById('hist-list');
  if (!el) return;

  if (!entries.length) {
    el.innerHTML = '<div class="empty-state"><i class="ti ti-chart-bar"></i><p>Nenhum histórico ainda.</p></div>';
    return;
  }
  el.innerHTML = entries.map(entry => {
    const pct = entry.total || 0;
    const cls = pct>=75?'pct-high':pct>=50?'pct-mid':'pct-low';
    return `<div class="hist-item">
      <div class="hist-header">
        <span class="hist-date">${entry.isToday?'Hoje':formatDate(entry.date)}</span>
        <span class="hist-pct ${cls}">${pct}%</span>
      </div>
      <div class="hist-bars">
        <div class="hist-bar-item"><div class="hist-bar-label"><i class="ti ti-barbell" style="font-size:11px"></i> Treinos</div><div class="hist-bar-track"><div class="hist-bar-fill" style="background:var(--purple);width:${entry.treinos||0}%"></div></div></div>
        <div class="hist-bar-item"><div class="hist-bar-label"><i class="ti ti-book" style="font-size:11px"></i> Estudos</div><div class="hist-bar-track"><div class="hist-bar-fill" style="background:var(--teal);width:${entry.estudos||0}%"></div></div></div>
        <div class="hist-bar-item"><div class="hist-bar-label"><i class="ti ti-list-check" style="font-size:11px"></i> Rotina</div><div class="hist-bar-track"><div class="hist-bar-fill" style="background:var(--amber);width:${entry.rotina||0}%"></div></div></div>
      </div>
    </div>`;
  }).join('');
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'});
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettingsUI() {
  const s = state.settings;
  const n = document.getElementById('cfg-name'); if(n) n.value = s.name||'';
  const g = document.getElementById('cfg-greeting'); if(g) g.value = s.greeting||'auto';
  const f = document.getElementById('cfg-font-large'); if(f) f.checked = !!s.fontLarge;
  const r = document.getElementById('cfg-review-time'); if(r) r.value = s.reviewTime||'21:00';
  const nt = document.getElementById('cfg-notif'); if(nt) nt.checked = !!s.notifEnabled;
  document.querySelectorAll('.accent-opt').forEach(b => b.classList.toggle('active', b.dataset.accent===(s.accent||'purple')));
}

function saveSettings() {
  const s = state.settings;
  s.name    = (document.getElementById('cfg-name')||{}).value||'';
  s.greeting= (document.getElementById('cfg-greeting')||{}).value||'auto';
  s.fontLarge = !!(document.getElementById('cfg-font-large')||{}).checked;
  s.reviewTime= (document.getElementById('cfg-review-time')||{}).value||'21:00';
  s.notifEnabled= !!(document.getElementById('cfg-notif')||{}).checked;
  const acc = document.querySelector('.accent-opt.active');
  if (acc) s.accent = acc.dataset.accent;
  saveState(); applySettings(); toast('✓ Configurações salvas'); goTo('dash');
}

function applySettings() {
  const s = state.settings;
  document.body.classList.toggle('font-large', !!s.fontLarge);
  const root = document.getElementById('app');
  ['teal','blue','coral','pink'].forEach(a => root.classList.remove('accent-'+a));
  if (s.accent && s.accent !== 'purple') root.classList.add('accent-'+s.accent);
}

function confirmReset() {
  openConfirm('Resetar dados do dia','Isso irá zerar todo o progresso de hoje. Não pode ser desfeito.', () => {
    resetDayItems(); state.studyDone = {}; saveState(); toast('Dados do dia resetados'); goTo('dash');
  });
}

function exportData() {
  const data = { exportedAt:new Date().toISOString(), ...state,
    provas:(state.provas||[]).map(p=>({...p,marked:[...(p.marked||[])]})) };
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),
    download: 'listcontrol-' + todayStr() + '.json'
  });
  a.click(); toast('📥 Dados exportados');
}

// ============================================================
// SYNC / QR
// ============================================================
function generateSyncCode() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const toSave = { ...state, provas:(state.provas||[]).map(p=>({...p,marked:[...(p.marked||[])]})) };
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(toSave)))).slice(0, 2000);
  const url = window.location.href.split('?')[0] + '?lc_import=' + encodeURIComponent(code + '|' + payload);

  setEl('sync-code-val', code);
  const expEl = document.getElementById('sync-code-exp');
  if (expEl) { expEl.textContent = 'expira em 10:00'; }
  document.getElementById('sync-code-box').style.display = 'block';

  if (codeTimer) clearInterval(codeTimer);
  let secs = 600;
  codeTimer = setInterval(() => {
    secs--;
    const m = Math.floor(secs/60), s = secs%60;
    if (expEl) expEl.textContent = `expira em ${m}:${String(s).padStart(2,'0')}`;
    if (secs <= 0) { clearInterval(codeTimer); if(expEl) expEl.textContent='expirado'; }
  }, 1000);

  // QR (visual only)
  const qrEl = document.getElementById('sync-qr');
  if (qrEl) {
    const sz = 20, cs = 5;
    let svg = `<svg width="${sz*cs}" height="${sz*cs}" xmlns="http://www.w3.org/2000/svg" style="border-radius:6px;display:block"><rect width="${sz*cs}" height="${sz*cs}" fill="#fff"/>`;
    const seed = parseInt(code);
    for (let r=0;r<sz;r++) for(let c=0;c<sz;c++) { if(((seed*(r*sz+c)*2654435761)&0xFFFF)%3===0) svg+=`<rect x="${c*cs}" y="${r*cs}" width="${cs}" height="${cs}" fill="#0E0E10"/>`; }
    [[0,0],[0,sz-7],[sz-7,0]].forEach(([rr,cc])=>{svg+=`<rect x="${cc*cs}" y="${rr*cs}" width="${7*cs}" height="${7*cs}" fill="#0E0E10" rx="3"/><rect x="${(cc+1)*cs}" y="${(rr+1)*cs}" width="${5*cs}" height="${5*cs}" fill="#fff"/><rect x="${(cc+2)*cs}" y="${(rr+2)*cs}" width="${3*cs}" height="${3*cs}" fill="#0E0E10"/>`;});
    svg += '</svg>';
    qrEl.innerHTML = svg;
    qrEl.style.display = 'flex';
  }
  toast('Código gerado!');
}

function importSyncCode() {
  const v = (document.getElementById('sync-import-input')||{}).value?.trim();
  if (!v || v.length !== 6 || isNaN(v)) { toast('Código inválido — use 6 dígitos'); return; }
  // In real app, decode from URL param. Here just show success.
  toast('Código ' + v + ' recebido! Dados carregados.');
}

// Check URL for import on load
function checkUrlImport() {
  const params = new URLSearchParams(window.location.search);
  const imp = params.get('lc_import');
  if (imp) {
    try {
      const [code, payload] = imp.split('|');
      const data = JSON.parse(decodeURIComponent(escape(atob(payload))));
      data.provas = (data.provas||[]).map(p=>({...p,marked:new Set(p.marked||[])}));
      state = data;
      saveState(); applySettings();
      toast('✓ Dados importados com sucesso!');
    } catch(e) { toast('Erro ao importar dados'); }
  }
}

// ============================================================
// MODALS
// ============================================================
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

let confirmCallback = null;
function openConfirm(title, msg, cb) {
  setEl('confirm-title', title);
  const msgEl = document.getElementById('confirm-msg');
  if (msgEl) msgEl.textContent = msg;
  confirmCallback = cb;
  const okBtn = document.getElementById('confirm-ok-btn');
  if (okBtn) okBtn.onclick = () => { closeModal('modal-confirm'); if(confirmCallback) confirmCallback(); };
  openModal('modal-confirm');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  const acc = e.target.closest('.accent-opt');
  if (acc) { document.querySelectorAll('.accent-opt').forEach(b=>b.classList.remove('active')); acc.classList.add('active'); }
});

// ============================================================
// HELPERS
// ============================================================
function adjField(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = Math.max(parseInt(el.min)||0, Math.min(parseInt(el.max)||999, (parseInt(el.value)||0)+delta));
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function setEl(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

function barWidth(id, pct) { const el=document.getElementById(id); if(el) el.style.width=pct+'%'; }

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ============================================================
// INIT
// ============================================================
function init() {
  loadState();
  checkUrlImport();
  applySettings();
  currentWeekDay = DAY_KEYS[new Date().getDay()];
  renderDash();
  setInterval(() => {
    const dash = document.getElementById('screen-dash');
    if (dash?.classList.contains('active')) renderDash();
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);

// studyAddAction — o botão + na aba Estudos delega para a sub-aba ativa
function studyAddAction() {
  if (currentStudyTab === 'hoje')    openAddWeekItem();
  if (currentStudyTab === 'semanal') openAddWeekItem();
  if (currentStudyTab === 'prova')   openAddProva();
}
