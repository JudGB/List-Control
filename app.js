/* ============================================================
   LISTCONTROL — app.js
   Persistência via localStorage, totalmente editável e personalizável
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
const DEFAULT_STATE = {
  exercises: [
    { id: 1, name: 'Supino reto', series: 4, done: 3, min: 20, note: '70kg, descanso 90s' },
    { id: 2, name: 'Agachamento', series: 4, done: 4, min: 25, note: '' },
    { id: 3, name: 'Remada curvada', series: 3, done: 3, min: 15, note: '60kg' },
    { id: 4, name: 'Desenvolvimento', series: 3, done: 2, min: 12, note: '' },
    { id: 5, name: 'Rosca direta', series: 3, done: 0, min: 10, note: '' },
  ],
  studies: [
    { id: 1, name: 'Inglês', target: 45, note: 'Duolingo + podcast', done: false },
    { id: 2, name: 'Programação', target: 60, note: 'Projeto pessoal', done: false },
    { id: 3, name: 'Matemática', target: 30, note: '', done: false },
    { id: 4, name: 'Português', target: 30, note: 'Redação', done: false },
  ],
  routine: [
    { id: 1, name: 'Meditação', icon: 'ti-brain', done: true,  meta: '10 min · diário' },
    { id: 2, name: 'Leitura',   icon: 'ti-book-2', done: true, meta: '20 min · diário' },
    { id: 3, name: 'Água 2L',   icon: 'ti-droplet', done: true, meta: 'diário' },
    { id: 4, name: 'Exercício', icon: 'ti-barbell', done: true, meta: 'conforme plano' },
    { id: 5, name: 'Vitaminas', icon: 'ti-pill', done: true,   meta: 'manhã · diário' },
    { id: 6, name: 'Diário',    icon: 'ti-pencil', done: true,  meta: 'noite · diário' },
    { id: 7, name: 'Revisar o dia', icon: 'ti-refresh', done: true, meta: 'noite' },
    { id: 8, name: 'Sem tela 21h', icon: 'ti-device-mobile-off', done: true, meta: 'noite · diário' },
    { id: 9, name: 'Cold shower', icon: 'ti-snowflake', done: false, meta: 'manhã · diário' },
    { id: 10, name: 'Planejar amanhã', icon: 'ti-calendar-event', done: false, meta: 'noite · diário' },
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
  streak: 12,
  bestStreak: 23,
  lastDate: null,
};

const ROUTINE_ICONS = [
  'ti-brain','ti-book-2','ti-droplet','ti-barbell','ti-pill','ti-pencil',
  'ti-refresh','ti-device-mobile-off','ti-snowflake','ti-calendar-event',
  'ti-flame','ti-heart','ti-run','ti-bicycle','ti-music','ti-moon',
  'ti-sun','ti-coffee','ti-apple','ti-bed','ti-shield','ti-star',
  'ti-dumbbell','ti-swim','ti-yoga','ti-salad',
];

const ROUTINE_COLORS = [
  { cls: 'amber-icon', bg: 'rgba(239,159,39,0.13)', color: '#EF9F27', bdr: 'rgba(239,159,39,0.28)' },
  { cls: 'teal-icon', bg: 'rgba(29,158,117,0.13)', color: '#1D9E75', bdr: 'rgba(29,158,117,0.28)' },
  { cls: 'purple-icon', bg: 'rgba(127,119,221,0.13)', color: '#7F77DD', bdr: 'rgba(127,119,221,0.28)' },
  { cls: 'coral-icon', bg: 'rgba(216,90,48,.13)', color: '#D85A30', bdr: 'rgba(216,90,48,.28)' },
];

const QUOTES = [
  'Consistência é a mãe do progresso.',
  'Cada dia marcado é uma vitória acumulada.',
  'Pequenos passos todos os dias fazem grandes resultados.',
  'A disciplina de hoje é a liberdade de amanhã.',
  'Você não precisa ser perfeito, só consistente.',
  'O hábito é segundo natureza.',
  'Progresso, não perfeição.',
  'Faça hoje o que seu eu futuro vai agradecer.',
];

let state = {};
let studyIntervals = {};
let nextId = 100;
let editingExIdx = null;
let editingStudyIdx = null;
let editingRoutineIdx = null;
let selectedRoutineIcon = 'ti-star';

// ============================================================
// PERSISTENCE
// ============================================================
function saveState() {
  try { localStorage.setItem('lc_state', JSON.stringify(state)); } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('lc_state');
    if (raw) {
      state = Object.assign({}, DEFAULT_STATE, JSON.parse(raw));
      state.settings = Object.assign({}, DEFAULT_STATE.settings, state.settings || {});
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } catch(e) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  checkDateReset();
}

function checkDateReset() {
  const today = todayStr();
  if (state.lastDate && state.lastDate !== today) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0,10);
    if (state.lastDate === yStr) {
      state.streak = (state.streak || 0) + 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    } else {
      state.streak = 0;
    }
    archiveDay(state.lastDate);
    resetDayItems();
  }
  state.lastDate = today;
  saveState();
}

function resetDayItems() {
  state.exercises.forEach(e => e.done = 0);
  state.studies.forEach(s => s.done = false);
  state.routine.forEach(r => r.done = false);
}

function archiveDay(dateStr) {
  const exP = calcExPct();
  const stP = calcStudyPct();
  const roP = calcRoutinePct();
  const total = Math.round((exP + stP + roP) / 3);
  state.history = state.history || [];
  state.history.unshift({ date: dateStr, treinos: exP, estudos: stP, rotina: roP, total });
  if (state.history.length > 30) state.history = state.history.slice(0, 30);
}

function todayStr() {
  return new Date().toISOString().slice(0,10);
}

// ============================================================
// NAVIGATION
// ============================================================
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');

  if (id === 'dash') renderDash();
  if (id === 'treinos') renderExercises();
  if (id === 'estudos') renderStudies();
  if (id === 'rotina') renderRoutine();
  if (id === 'historico') renderHistory();
}

function openSettings() { goTo('settings'); loadSettingsUI(); }

// ============================================================
// CALC PERCENTAGES
// ============================================================
function calcExPct() {
  if (!state.exercises.length) return 0;
  const done = state.exercises.filter(e => e.done >= e.series).length;
  return Math.round(done / state.exercises.length * 100);
}
function calcStudyPct() {
  if (!state.studies.length) return 0;
  return Math.round(state.studies.filter(s => s.done).length / state.studies.length * 100);
}
function calcRoutinePct() {
  if (!state.routine.length) return 0;
  return Math.round(state.routine.filter(r => r.done).length / state.routine.length * 100);
}
function calcTotalPct() {
  return Math.round((calcExPct() + calcStudyPct() + calcRoutinePct()) / 3);
}

function setRing(fillId, pctId, pct) {
  const circ = 2 * Math.PI * 14; // r=14 => ~87.96
  const fill = Math.round(circ * pct / 100* 10) / 10;
  const el = document.getElementById(fillId);
  if (el) el.setAttribute('stroke-dasharray', fill + ' ' + circ);
  const pEl = document.getElementById(pctId);
  if (pEl) pEl.textContent = pct + '%';
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDash() {
  // Date
  const d = new Date();
  const dateEl = document.getElementById('lc-date');
  if (dateEl) dateEl.textContent = d.toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'short' });

  // Greeting
  const name = state.settings.name || '';
  let greet;
  if (state.settings.greeting === 'auto') {
    const h = d.getHours();
    greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  } else {
    greet = state.settings.greeting;
  }
  const greetEl = document.getElementById('dash-greeting');
  if (greetEl) greetEl.textContent = greet + (name ? ', ' + name + '! 👋' : '! 👋');

  // Streak
  const s = document.getElementById('dash-streak');
  if (s) s.textContent = state.streak || 0;

  // Overall pct
  const pct = calcTotalPct();
  const pEl = document.getElementById('dash-pct');
  if (pEl) pEl.textContent = pct + '%';

  // Week dots
  const weekEl = document.getElementById('lc-week');
  if (weekEl) {
    const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    weekEl.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
      const date = new Date(); date.setDate(date.getDate() - i);
      const dStr = date.toISOString().slice(0,10);
      const isToday = i === 0;
      const isDone = !isToday && state.history && state.history.find(h => h.date === dStr && h.total >= 60);
      const div = document.createElement('div');
      div.className = 'day-dot' + (isDone ? ' done' : '') + (isToday ? ' today' : '');
      div.innerHTML = `<span>${days[date.getDay()]}</span><div class="dot"></div>`;
      weekEl.appendChild(div);
    }
  }

  // Module stats + rings
  const exDone = state.exercises.filter(e => e.done >= e.series).length;
  const exTotal = state.exercises.length;
  const exPct = calcExPct();
  setEl('dash-treino-stat', exDone + ' de ' + exTotal + ' exercícios');
  setRing('ring-treino-fill', 'ring-treino-pct', exPct);

  const stDone = state.studies.filter(s => s.done).length;
  const stTotal = state.studies.length;
  const stPct = calcStudyPct();
  setEl('dash-estudos-stat', stDone + ' de ' + stTotal + ' matérias');
  setRing('ring-estudo-fill', 'ring-estudo-pct', stPct);

  const roDone = state.routine.filter(r => r.done).length;
  const roTotal = state.routine.length;
  const roPct = calcRoutinePct();
  setEl('dash-rotina-stat', roDone + ' de ' + roTotal + ' itens');
  setRing('ring-rotina-fill', 'ring-rotina-pct', roPct);

  // Quote
  const q = QUOTES[d.getDate() % QUOTES.length];
  setEl('quote-text', q);

  // Avg weekly
  if (state.history && state.history.length) {
    const last7 = state.history.slice(0, 7);
    const avg = Math.round(last7.reduce((a,h) => a + (h.total || 0), 0) / last7.length);
    setEl('dash-avg', avg + '%');
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
// EXERCISES
// ============================================================
function renderExercises() {
  const list = document.getElementById('exercise-list');
  const empty = document.getElementById('ex-empty');
  if (!list) return;

  const done = state.exercises.filter(e => e.done >= e.series).length;
  const total = state.exercises.length;
  const pct = total ? Math.round(done / total * 100) : 0;

  setEl('ex-done', done);
  setEl('ex-total', total);
  const bar = document.getElementById('ex-bar');
  if (bar) bar.style.width = pct + '%';

  if (empty) empty.style.display = total ? 'none' : 'flex';
  list.innerHTML = '';

  state.exercises.forEach((ex, i) => {
    const isDone = ex.done >= ex.series;
    const div = document.createElement('div');
    div.className = 'exercise-item' + (isDone ? ' complete' : '');
    div.innerHTML = `
      <div class="ex-top">
        <span class="ex-name">${esc(ex.name)}</span>
        <div class="ex-actions">
          <button class="edit-icon-btn" onclick="editExercise(${i})" aria-label="Editar"><i class="ti ti-pencil"></i></button>
          <button class="del-icon-btn" onclick="deleteItem('exercise',${i})" aria-label="Excluir"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div class="ex-meta">${ex.series} séries · ${ex.min} min estimado</div>
      ${ex.note ? `<div class="ex-note">"${esc(ex.note)}"</div>` : ''}
      <div class="ex-progress-row">
        ${isDone
          ? `<span class="done-badge"><i class="ti ti-check"></i> Concluído</span>`
          : `<div class="counter-row">
               <button class="count-btn" onclick="changeEx(${i},-1)" aria-label="Diminuir">−</button>
               <span class="count-val">${ex.done}/${ex.series}</span>
               <button class="count-btn" onclick="changeEx(${i},1)" aria-label="Aumentar">+</button>
             </div>`
        }
      </div>`;
    list.appendChild(div);
  });

  renderDash();
}

function changeEx(i, delta) {
  state.exercises[i].done = Math.max(0, Math.min(state.exercises[i].series, state.exercises[i].done + delta));
  saveState();
  renderExercises();
  if (state.exercises[i].done === state.exercises[i].series) toast('✓ ' + state.exercises[i].name + ' concluído!');
}

// Add / Edit exercise
function openAddExercise() {
  editingExIdx = null;
  document.getElementById('modal-ex-title').textContent = 'Adicionar exercício';
  document.getElementById('ex-name-input').value = '';
  document.getElementById('ex-series-input').value = 4;
  document.getElementById('ex-min-input').value = 15;
  document.getElementById('ex-note-input').value = '';
  openModal('modal-exercise');
}

function editExercise(i) {
  editingExIdx = i;
  const ex = state.exercises[i];
  document.getElementById('modal-ex-title').textContent = 'Editar exercício';
  document.getElementById('ex-name-input').value = ex.name;
  document.getElementById('ex-series-input').value = ex.series;
  document.getElementById('ex-min-input').value = ex.min;
  document.getElementById('ex-note-input').value = ex.note || '';
  openModal('modal-exercise');
}

function confirmExercise() {
  const name = document.getElementById('ex-name-input').value.trim();
  if (!name) { toast('Digite o nome do exercício'); return; }
  const series = parseInt(document.getElementById('ex-series-input').value) || 4;
  const min    = parseInt(document.getElementById('ex-min-input').value) || 15;
  const note   = document.getElementById('ex-note-input').value.trim();

  if (editingExIdx !== null) {
    state.exercises[editingExIdx] = { ...state.exercises[editingExIdx], name, series, min, note };
    toast('Exercício atualizado');
  } else {
    state.exercises.push({ id: nextId++, name, series, done: 0, min, note });
    toast('Exercício adicionado');
  }
  saveState();
  closeModal('modal-exercise');
  renderExercises();
}

// ============================================================
// STUDIES
// ============================================================
function calcStudyPct() {
  if (!state.studies.length) return 0;
  return Math.round(state.studies.filter(s => s.done).length / state.studies.length * 100);
}

function renderStudies() {
  const list = document.getElementById('study-list');
  const empty = document.getElementById('study-empty');
  if (!list) return;

  const total = state.studies.length;
  const done  = state.studies.filter(s => s.done).length;
  const pct   = total ? Math.round(done / total * 100) : 0;

  // Summary bar: show total planned time of completed items
  const completedMin = state.studies.filter(s => s.done).reduce((a,s) => a + (s.target || 0), 0);
  const h = Math.floor(completedMin / 60), m = completedMin % 60;
  setEl('study-time', done + '/' + total);
  setEl('study-pct', pct + '%');
  const bar = document.getElementById('study-bar');
  if (bar) bar.style.width = pct + '%';

  if (empty) empty.style.display = total ? 'none' : 'flex';
  list.innerHTML = '';

  state.studies.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'routine-item' + (s.done ? ' done' : '');
    div.onclick = (e) => {
      if (!e.target.closest('.del-icon-btn') && !e.target.closest('.edit-icon-btn')) toggleStudy(i);
    };

    const metaParts = [];
    if (s.target) metaParts.push(s.target >= 60
      ? Math.floor(s.target/60) + 'h' + (s.target%60 ? ' ' + s.target%60 + 'min' : '')
      : s.target + 'min');
    if (s.note) metaParts.push(s.note);

    div.innerHTML = `
      <div class="routine-check${s.done ? ' checked' : ''}">
        ${s.done ? '<i class="ti ti-check"></i>' : ''}
      </div>
      <div class="routine-icon-wrap" style="background:var(--teal-bg);color:var(--teal);border:0.5px solid var(--teal-bdr)">
        <i class="ti ti-book-2"></i>
      </div>
      <div class="routine-text">
        <div class="routine-name">${esc(s.name)}</div>
        ${metaParts.length ? `<div class="routine-meta">${esc(metaParts.join(' · '))}</div>` : ''}
      </div>
      <div class="routine-item-actions">
        <button class="edit-icon-btn" onclick="editStudy(${i})" aria-label="Editar"><i class="ti ti-pencil"></i></button>
        <button class="del-icon-btn" onclick="deleteItem('study',${i})" aria-label="Excluir"><i class="ti ti-trash"></i></button>
      </div>`;
    list.appendChild(div);
  });

  renderDash();
}

function toggleStudy(i) {
  state.studies[i].done = !state.studies[i].done;
  saveState();
  renderStudies();
  if (state.studies[i].done) toast('✓ ' + state.studies[i].name);
}

function openAddStudy() {
  editingStudyIdx = null;
  document.getElementById('modal-study-title').textContent = 'Adicionar matéria';
  document.getElementById('study-name-input').value = '';
  document.getElementById('study-target-input').value = 60;
  document.getElementById('study-note-input').value = '';
  openModal('modal-study');
}

function editStudy(i) {
  editingStudyIdx = i;
  const s = state.studies[i];
  document.getElementById('modal-study-title').textContent = 'Editar matéria';
  document.getElementById('study-name-input').value = s.name;
  document.getElementById('study-target-input').value = s.target || 60;
  document.getElementById('study-note-input').value = s.note || '';
  openModal('modal-study');
}

function confirmStudy() {
  const name = document.getElementById('study-name-input').value.trim();
  if (!name) { toast('Digite o nome da matéria'); return; }
  const target = parseInt(document.getElementById('study-target-input').value) || 60;
  const note   = document.getElementById('study-note-input').value.trim();

  if (editingStudyIdx !== null) {
    state.studies[editingStudyIdx] = { ...state.studies[editingStudyIdx], name, target, note };
    toast('Matéria atualizada');
  } else {
    state.studies.push({ id: nextId++, name, target, note, done: false });
    toast('Matéria adicionada');
  }
  saveState();
  closeModal('modal-study');
  renderStudies();
}

// ============================================================
// ROUTINE
// ============================================================
function buildIconPicker() {
  const picker = document.getElementById('routine-icon-picker');
  if (!picker) return;
  picker.innerHTML = ROUTINE_ICONS.map(ic =>
    `<button type="button" class="icon-opt${selectedRoutineIcon===ic?' selected':''}" data-icon="${ic}" onclick="selectIcon('${ic}')">
       <i class="ti ${ic}"></i>
     </button>`
  ).join('');
}

function selectIcon(ic) {
  selectedRoutineIcon = ic;
  buildIconPicker();
}

function renderRoutine() {
  const list = document.getElementById('routine-list');
  const empty = document.getElementById('routine-empty');
  if (!list) return;

  const done = state.routine.filter(r => r.done).length;
  const total = state.routine.length;
  const pct = total ? Math.round(done / total * 100) : 0;

  setEl('routine-done', done);
  setEl('routine-total', total);
  const bar = document.getElementById('routine-bar');
  if (bar) bar.style.width = pct + '%';

  if (empty) empty.style.display = total ? 'none' : 'flex';
  list.innerHTML = '';

  state.routine.forEach((r, i) => {
    const color = ROUTINE_COLORS[i % ROUTINE_COLORS.length];
    const div = document.createElement('div');
    div.className = 'routine-item' + (r.done ? ' done' : '');
    div.onclick = (e) => {
      if (!e.target.closest('.del-icon-btn') && !e.target.closest('.edit-icon-btn')) toggleRoutine(i);
    };
    div.innerHTML = `
      <div class="routine-check${r.done ? ' checked' : ''}">
        ${r.done ? '<i class="ti ti-check"></i>' : ''}
      </div>
      <div class="routine-icon-wrap" style="background:${color.bg};color:${color.color};border:0.5px solid ${color.bdr}">
        <i class="ti ${r.icon || 'ti-star'}"></i>
      </div>
      <div class="routine-text">
        <div class="routine-name">${esc(r.name)}</div>
        <div class="routine-meta">${esc(r.meta || '')}</div>
      </div>
      <div class="routine-item-actions">
        <button class="edit-icon-btn" onclick="editRoutine(${i})" aria-label="Editar"><i class="ti ti-pencil"></i></button>
        <button class="del-icon-btn" onclick="deleteItem('routine',${i})" aria-label="Excluir"><i class="ti ti-trash"></i></button>
      </div>`;
    list.appendChild(div);
  });

  renderDash();
}

function toggleRoutine(i) {
  state.routine[i].done = !state.routine[i].done;
  saveState();
  renderRoutine();
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

function editRoutine(i) {
  editingRoutineIdx = i;
  const r = state.routine[i];
  selectedRoutineIcon = r.icon || 'ti-star';
  document.getElementById('modal-routine-title').textContent = 'Editar item';
  document.getElementById('routine-name-input').value = r.name;
  const timePart = r.meta ? r.meta.split('·')[0].trim() : '';
  document.getElementById('routine-time-input').value = timePart.match(/\d{2}:\d{2}/) ? timePart : '';
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
    state.routine[editingRoutineIdx] = { ...state.routine[editingRoutineIdx], name, icon: selectedRoutineIcon, meta, recur };
    toast('Item atualizado');
  } else {
    state.routine.push({ id: nextId++, name, icon: selectedRoutineIcon, done: false, meta, recur });
    toast('Item adicionado');
  }
  saveState();
  closeModal('modal-routine');
  renderRoutine();
}

// ============================================================
// DELETE (generic)
// ============================================================
function deleteItem(type, i) {
  const labels = { exercise: 'exercício', study: 'matéria', routine: 'item' };
  const nameMap = { exercise: state.exercises, study: state.studies, routine: state.routine };
  const item = nameMap[type][i];
  const label = item.name || 'este item';

  openConfirm(
    'Excluir ' + labels[type],
    `Tem certeza que quer excluir "${esc(label)}"? Esta ação não pode ser desfeita.`,
    () => {
      if (type === 'exercise') { state.exercises.splice(i, 1); saveState(); renderExercises(); }
      if (type === 'study') {
        if (studyIntervals[i]) { clearInterval(studyIntervals[i]); delete studyIntervals[i]; }
        state.studies.splice(i, 1); saveState(); renderStudies();
      }
      if (type === 'routine') { state.routine.splice(i, 1); saveState(); renderRoutine(); }
      toast('Excluído');
    }
  );
}

// ============================================================
// HISTORY
// ============================================================
function renderHistory() {
  setEl('hist-streak', state.streak || 0);
  setEl('hist-best', state.bestStreak || 0);
  setEl('hist-total-days', (state.history || []).length);

  const list = document.getElementById('hist-list');
  if (!list) return;

  // Build today's entry dynamically
  const todayEntry = {
    date: todayStr(),
    treinos: calcExPct(),
    estudos: calcStudyPct(),
    rotina: calcRoutinePct(),
    total: calcTotalPct(),
    isToday: true,
  };

  const entries = [todayEntry, ...(state.history || [])].slice(0, 7);

  if (!entries.length) {
    list.innerHTML = '<div class="empty-state"><i class="ti ti-chart-bar"></i><p>Nenhum histórico ainda.<br/>Complete o dia para registrar!</p></div>';
    return;
  }

  list.innerHTML = entries.map(entry => {
    const pct = entry.total || 0;
    const pctCls = pct >= 75 ? 'pct-high' : pct >= 50 ? 'pct-mid' : 'pct-low';
    const dateLabel = entry.isToday ? 'Hoje' : formatDate(entry.date);
    return `
      <div class="hist-item">
        <div class="hist-header">
          <span class="hist-date">${dateLabel}</span>
          <span class="hist-pct ${pctCls}">${pct}%</span>
        </div>
        <div class="hist-bars">
          <div class="hist-bar-item">
            <div class="hist-bar-label"><i class="ti ti-barbell" style="font-size:11px"></i> Treinos</div>
            <div class="hist-bar-track"><div class="hist-bar-fill purple-fill" style="width:${entry.treinos||0}%"></div></div>
          </div>
          <div class="hist-bar-item">
            <div class="hist-bar-label"><i class="ti ti-book" style="font-size:11px"></i> Estudos</div>
            <div class="hist-bar-track"><div class="hist-bar-fill teal-fill" style="width:${entry.estudos||0}%"></div></div>
          </div>
          <div class="hist-bar-item">
            <div class="hist-bar-label"><i class="ti ti-list-check" style="font-size:11px"></i> Rotina</div>
            <div class="hist-bar-track"><div class="hist-bar-fill amber-fill" style="width:${entry.rotina||0}%"></div></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'short' });
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettingsUI() {
  const s = state.settings;
  const nameEl = document.getElementById('cfg-name');
  if (nameEl) nameEl.value = s.name || '';
  const greetEl = document.getElementById('cfg-greeting');
  if (greetEl) greetEl.value = s.greeting || 'auto';
  const fontEl = document.getElementById('cfg-font-large');
  if (fontEl) fontEl.checked = !!s.fontLarge;
  const reviewEl = document.getElementById('cfg-review-time');
  if (reviewEl) reviewEl.value = s.reviewTime || '21:00';
  const notifEl = document.getElementById('cfg-notif');
  if (notifEl) notifEl.checked = !!s.notifEnabled;

  document.querySelectorAll('.accent-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.accent === (s.accent || 'purple'));
  });
}

function saveSettings() {
  const s = state.settings;
  s.name = (document.getElementById('cfg-name') || {}).value || '';
  s.greeting = (document.getElementById('cfg-greeting') || {}).value || 'auto';
  s.fontLarge = !!(document.getElementById('cfg-font-large') || {}).checked;
  s.reviewTime = (document.getElementById('cfg-review-time') || {}).value || '21:00';
  s.notifEnabled = !!(document.getElementById('cfg-notif') || {}).checked;

  const activeAccent = document.querySelector('.accent-opt.active');
  if (activeAccent) s.accent = activeAccent.dataset.accent;

  saveState();
  applySettings();
  toast('✓ Configurações salvas');
  goTo('dash');
}

function applySettings() {
  const s = state.settings;
  const root = document.getElementById('app');
  if (!root) return;

  // Font size
  document.body.classList.toggle('font-large', !!s.fontLarge);

  // Accent color
  const accents = ['purple','teal','blue','coral','pink'];
  accents.forEach(a => root.classList.remove('accent-' + a));
  if (s.accent && s.accent !== 'purple') root.classList.add('accent-' + s.accent);
}

// Accent picker click
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.accent-opt');
  if (btn) {
    document.querySelectorAll('.accent-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
});

function confirmReset() {
  openConfirm(
    'Resetar dados do dia',
    'Isso irá zerar todos os progressos de hoje (treinos, estudos, rotina). Não pode ser desfeito.',
    () => {
      resetDayItems();
      saveState();
      toast('Dados do dia resetados');
      goTo('dash');
    }
  );
}

function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    exercises: state.exercises,
    studies: state.studies,
    routine: state.routine,
    history: state.history,
    streak: state.streak,
    bestStreak: state.bestStreak,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'listcontrol-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('📥 Dados exportados');
}

// ============================================================
// MODALS
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

let confirmCallback = null;
function openConfirm(title, msg, cb) {
  setEl('confirm-title', title);
  const msgEl = document.getElementById('confirm-msg');
  if (msgEl) msgEl.textContent = msg;
  confirmCallback = cb;
  const okBtn = document.getElementById('confirm-ok-btn');
  if (okBtn) okBtn.onclick = () => { closeModal('modal-confirm'); if (confirmCallback) confirmCallback(); };
  openModal('modal-confirm');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ============================================================
// HELPERS
// ============================================================
function adjField(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = parseInt(el.value) || 0;
  const min = parseInt(el.min) || 1;
  const max = parseInt(el.max) || 999;
  el.value = Math.max(min, Math.min(max, val + delta));
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ============================================================
// INIT
// ============================================================
function init() {
  loadState();
  applySettings();
  renderDash();

  // Keep dashboard fresh when visible
  setInterval(() => {
    const dash = document.getElementById('screen-dash');
    if (dash && dash.classList.contains('active')) {
      const dateEl = document.getElementById('lc-date');
      if (dateEl) {
        const d = new Date();
        dateEl.textContent = d.toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'short' });
      }
    }
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);
