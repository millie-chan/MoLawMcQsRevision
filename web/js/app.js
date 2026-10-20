import {
  createGroups, applyAnswerResult,
  getStageLabel, getCountdown, isDueToday,
  startOfDay, formatDate, computeStreak
} from './leitner.js';
import { storage, migrateProgress } from './storage.js';

// ============================================================
// 狀態
// ============================================================
const state = {
  questions: [],
  progress: null,
  session: null
};

// ============================================================
// DOM
// ============================================================
const $ = (id) => document.getElementById(id);
const el = {
  loading: $('loading'),
  error: $('error'),
  errorMsg: $('error-msg'),
  btnRetry: $('btn-retry'),

  planSelect: $('plan-select'),
  planButtons: document.querySelectorAll('[data-plan]'),
  btnImportEmpty: $('btn-import-empty'),
  btnInstallEmpty: $('btn-install-empty'),

  home: $('home'),
  homeSummary: $('home-summary'),
  groupList: $('group-list'),
  btnReset: $('btn-reset'),
  btnExport: $('btn-export'),
  btnImport: $('btn-import'),
  btnInstall: $('btn-install'),
  dashPercent: $('dash-percent'),
  dashMeta: $('dash-meta'),
  dashBar: $('dash-bar'),

  statStreak: $('stat-streak'),
  statTotal: $('stat-total'),
  statAccuracy: $('stat-accuracy'),

  searchInput: $('search-input'),
  searchResults: $('search-results'),

  quiz: $('quiz'),
  qSource: $('q-source'),
  qIndex: $('q-index'),
  qTotal: $('q-total'),
  qCorrect: $('q-correct'),
  qText: $('q-text'),
  qOptions: $('q-options'),
  qFeedback: $('q-feedback'),
  qExplanation: $('q-explanation'),
  btnNext: $('btn-next'),

  result: $('result'),
  rVerdict: $('r-verdict'),
  rCorrect: $('r-correct'),
  rTotal: $('r-total'),
  rAccuracy: $('r-accuracy'),
  rNext: $('r-next'),
  wrongSection: $('wrong-section'),
  wrongCount: $('wrong-count'),
  wrongList: $('wrong-list'),
  btnRedoWrong: $('btn-redo-wrong'),
  btnBackHome: $('btn-back-home'),

  modal: $('q-detail-modal'),
  modalBackdrop: $('modal-backdrop'),
  modalClose: $('modal-close'),
  modalSource: $('modal-source'),
  modalQuestion: $('modal-question'),
  modalOptions: $('modal-options'),
  modalExplanation: $('modal-explanation'),

  fileInput: $('file-input')
};

const SCREENS = ['loading', 'error', 'planSelect', 'home', 'quiz', 'result'];
function show(name) {
  SCREENS.forEach((k) => el[k].classList.toggle('hidden', k !== name));
}

// ============================================================
// 題庫載入
// ============================================================
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function stripOptionPrefix(text) {
  return String(text).replace(/^\s*[A-Fa-f][\.\)、\s]+\s*/, '').trim();
}

function normalize(raw) {
  const flat = [];
  let counter = 0;

  raw.forEach((subject) => {
    const title = subject.title || '未命名科目';
    (subject.qsArr || []).forEach((q) => {
      const options = (q.ansArr || []).map(stripOptionPrefix);
      const answerIndex = LETTERS.indexOf((q.ans || '').toUpperCase().trim());
      if (answerIndex < 0 || answerIndex >= options.length) {
        console.warn('跳過無效題目：', q.qs);
        return;
      }
      flat.push({
        id: counter++,
        question: q.qs,
        options,
        answer: answerIndex,
        explanation: q.explanation || '',
        source: title
      });
    });
  });

  return flat;
}

async function loadQuestions() {
  const res = await fetch('data/2026.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('題庫格式錯誤或為空');
  const flat = normalize(raw);
  if (flat.length === 0) throw new Error('題庫正規化後為 0 題');
  state.questions = flat;
  console.log(`✅ 題庫載入完成：${flat.length} 題，來自 ${raw.length} 個科目`);
}

// ============================================================
// 啟動
// ============================================================
async function init() {
  show('loading');
  try {
    await loadQuestions();
  } catch (err) {
    el.errorMsg.textContent =
      '題庫載入失敗：' + err.message +
      '（請確認用 http(s) 開啟，不能直接雙擊 index.html）';
    show('error');
    return;
  }

  const saved = migrateProgress(storage.load());
  if (saved) {
    state.progress = saved;
    storage.save(state.progress);
    renderHome();
    show('home');
  } else {
    show('planSelect');
  }
}

// ============================================================
// 選擇計劃
// ============================================================
function choosePlan(days) {
  if (state.progress) {
    if (!confirm('已存在學習進度，重新選擇會清除目前進度。確定嗎？')) return;
    storage.clear();
  }

  const { groups, intervals } = createGroups(state.questions.length, days);
  state.progress = {
    plan: days,
    totalQuestions: state.questions.length,
    intervals,
    groups,
    createdAt: new Date().toISOString(),
    activityLog: [],
    totalAnswered: 0,
    totalCorrect: 0
  };
  storage.save(state.progress);
  renderHome();
  show('home');
}

// ============================================================
// 統計
// ============================================================
function computeStats(progress) {
  const today = startOfDay(new Date());
  let dueToday = 0;
  let overdue = 0;
  let completed = 0;
  let waiting = 0;

  const totalStages = progress.groups.length * progress.intervals.length;
  let doneStages = 0;

  progress.groups.forEach((g) => {
    if (g.completed) {
      completed++;
      doneStages += progress.intervals.length;
      return;
    }
    doneStages += g.currentStage;

    if (isDueToday(g)) {
      dueToday++;
      if (g.currentStage > 0 && g.nextReviewDate) {
        const target = startOfDay(new Date(g.nextReviewDate));
        if (target < today) overdue++;
      }
    } else {
      waiting++;
    }
  });

  const progressPercent =
    totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

  return { dueToday, overdue, completed, waiting, progressPercent };
}

// ============================================================
// 首頁
// ============================================================
function renderHome() {
  const p = state.progress;
  const stats = computeStats(p);
  const perGroup = Math.ceil(p.totalQuestions / p.groups.length);

  el.homeSummary.textContent =
    `計劃 ${p.plan} 天 · ${p.groups.length} 組 · 每組約 ${perGroup} 題 · 總題數 ${p.totalQuestions}`;

  el.dashPercent.textContent = stats.progressPercent + '%';
  el.dashBar.style.width = stats.progressPercent + '%';
  const overdueText = stats.overdue > 0 ? ` · 逾期 ${stats.overdue} 組` : '';
  el.dashMeta.textContent =
    `已完成 ${stats.completed} / ${p.groups.length} 組 · 今日待複習 ${stats.dueToday} 組${overdueText}`;

  el.statStreak.textContent = computeStreak(p.activityLog);
  el.statTotal.textContent = p.totalAnswered;
  el.statAccuracy.textContent =
    p.totalAnswered > 0
      ? Math.round((p.totalCorrect / p.totalAnswered) * 100) + '%'
      : '—';

  el.groupList.innerHTML = '';

  const due = [];
  const waiting = [];
  const done = [];

  p.groups.forEach((g) => {
    if (g.completed) done.push(g);
    else if (isDueToday(g)) due.push(g);
    else waiting.push(g);
  });

  waiting.sort(
    (a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate)
  );

  renderSection('📌 今日待複習', due, 'due');
  renderSection('⏳ 排程中', waiting, 'waiting');
  renderSection('✅ 已完成', done, 'done');

  // 若搜尋框有內容，重新執行搜尋以保持視圖一致
  if (el.searchInput.value.trim()) {
    performSearch(el.searchInput.value);
  } else {
    el.groupList.classList.remove('hidden');
    el.searchResults.classList.add('hidden');
  }
}

function renderSection(title, groups, kind) {
  if (groups.length === 0) return;

  const wrap = document.createElement('div');
  wrap.className = 'group-section';

  const h = document.createElement('h3');
  h.className = 'section-title';
  h.textContent = `${title} (${groups.length})`;
  wrap.appendChild(h);

  const ul = document.createElement('ul');
  ul.className = 'group-list';
  groups.forEach((g) => ul.appendChild(buildGroupItem(g, kind)));
  wrap.appendChild(ul);

  el.groupList.appendChild(wrap);
}

function buildGroupItem(g, kind) {
  const p = state.progress;
  const li = document.createElement('li');
  li.className = `group-item is-${kind}`;

  const stagesDone = g.completed ? p.intervals.length : g.currentStage;
  const stagesTotal = p.intervals.length;
  const pct = stagesTotal > 0 ? (stagesDone / stagesTotal) * 100 : 0;

  let statusHTML;
  if (g.completed) {
    statusHTML = '<span class="status-done">✅ 完成</span>';
  } else if (kind === 'due') {
    statusHTML = '<span class="status-due">▶ 開始</span>';
  } else {
    statusHTML = `<span class="status-wait">${getCountdown(g)}</span>`;
  }

  li.innerHTML = `
    <div class="group-info">
      <div class="group-title">第 ${g.groupId + 1} 組</div>
      <div class="group-meta">${g.questionIds.length} 題 · ${getStageLabel(g, p.intervals)}</div>
      <div class="group-progress">
        <div class="group-progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="group-status">${statusHTML}</div>
  `;

  if (!g.completed) {
    li.classList.add('clickable');
    li.addEventListener('click', () => startQuiz(g.groupId));
  }
  return li;
}

// ============================================================
// 搜尋
// ============================================================
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function highlightHTML(text, keyword) {
  if (!keyword) return escapeHTML(text);
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase();
  const idx = lower.indexOf(k);
  if (idx < 0) return escapeHTML(text);
  return (
    escapeHTML(text.slice(0, idx)) +
    '<mark>' +
    escapeHTML(text.slice(idx, idx + k.length)) +
    '</mark>' +
    escapeHTML(text.slice(idx + k.length))
  );
}

function performSearch(rawKeyword) {
  const keyword = rawKeyword.trim();
  if (!keyword) {
    el.searchResults.classList.add('hidden');
    el.searchResults.innerHTML = '';
    el.groupList.classList.remove('hidden');
    return;
  }

  const k = keyword.toLowerCase();
  const results = state.questions.filter(
    (q) =>
      q.question.toLowerCase().includes(k) ||
      q.source.toLowerCase().includes(k)
  );

  el.groupList.classList.add('hidden');
  el.searchResults.classList.remove('hidden');
  el.searchResults.innerHTML = '';

  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = `沒有找到包含「${keyword}」的題目。`;
    el.searchResults.appendChild(empty);
    return;
  }

  const count = document.createElement('p');
  count.className = 'search-count';
  count.textContent = `找到 ${results.length} 題`;
  el.searchResults.appendChild(count);

  const LIMIT = 100;
  results.slice(0, LIMIT).forEach((q) => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.innerHTML = `
      <div class="search-item-source">${escapeHTML(q.source)}</div>
      <div class="search-item-question">${highlightHTML(q.question, keyword)}</div>
    `;
    item.addEventListener('click', () => showQuestionDetail(q));
    el.searchResults.appendChild(item);
  });

  if (results.length > LIMIT) {
    const more = document.createElement('p');
    more.className = 'search-count';
    more.textContent = `還有 ${results.length - LIMIT} 題未顯示，請輸入更精確的關鍵字。`;
    el.searchResults.appendChild(more);
  }
}

// ============================================================
// 題目詳情 Modal
// ============================================================
function showQuestionDetail(q) {
  el.modalSource.textContent = q.source;
  el.modalQuestion.textContent = q.question;
  el.modalOptions.innerHTML = '';

  q.options.forEach((text, i) => {
    const li = document.createElement('li');
    li.className = 'modal-option';
    if (i === q.answer) li.classList.add('is-answer');
    const letter = document.createElement('span');
    letter.className = 'opt-letter';
    letter.textContent = String.fromCharCode(65 + i) + '.';
    const txt = document.createElement('span');
    txt.className = 'opt-text';
    txt.textContent = text;
    li.appendChild(letter);
    li.appendChild(txt);
    el.modalOptions.appendChild(li);
  });

  if (q.explanation) {
    el.modalExplanation.textContent = '📖 ' + q.explanation;
    el.modalExplanation.classList.remove('hidden');
  } else {
    el.modalExplanation.classList.add('hidden');
  }

  el.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeQuestionDetail() {
  el.modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ============================================================
// 開始某組
// ============================================================
function startQuiz(groupId, questionIds = null, mode = 'normal') {
  const g = state.progress.groups.find((x) => x.groupId === groupId);
  if (!g || g.completed) return;

  state.session = {
    groupId,
    mode,
    queue: questionIds ? [...questionIds] : [...g.questionIds],
    index: 0,
    correct: 0,
    answered: false,
    records: []
  };

  el.qTotal.textContent = state.session.queue.length;
  show('quiz');
  renderQuestion();
}

// ============================================================
// 答題
// ============================================================
function renderQuestion() {
  const s = state.session;
  const q = state.questions[s.queue[s.index]];
  s.answered = false;

  el.qIndex.textContent = s.index + 1;
  el.qCorrect.textContent = s.correct;
  el.qSource.textContent = q.source;
  el.qText.textContent = q.question;

  el.qFeedback.classList.add('hidden');
  el.qFeedback.textContent = '';
  el.qExplanation.classList.add('hidden');
  el.qExplanation.textContent = '';
  el.btnNext.classList.add('hidden');

  el.qOptions.innerHTML = '';
  q.options.forEach((text, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = `${String.fromCharCode(65 + i)}. ${text}`;
    btn.addEventListener('click', () => onSelect(i));
    li.appendChild(btn);
    el.qOptions.appendChild(li);
  });
}

function onSelect(selectedIndex) {
  const s = state.session;
  if (s.answered) return;
  s.answered = true;

  const q = state.questions[s.queue[s.index]];
  const isCorrect = selectedIndex === q.answer;
  if (isCorrect) s.correct += 1;
  el.qCorrect.textContent = s.correct;

  s.records.push({
    questionId: q.id,
    selected: selectedIndex,
    correct: isCorrect
  });

  const buttons = el.qOptions.querySelectorAll('.option');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('is-correct');
    if (i === selectedIndex && !isCorrect) btn.classList.add('is-wrong');
  });

  el.qFeedback.textContent = isCorrect
    ? '✅ 答對了'
    : `❌ 答錯了，正確答案是 ${String.fromCharCode(65 + q.answer)}`;
  el.qFeedback.classList.remove('hidden');
  el.qFeedback.classList.toggle('ok', isCorrect);
  el.qFeedback.classList.toggle('ng', !isCorrect);

  if (!isCorrect && q.explanation) {
    el.qExplanation.textContent = '📖 ' + q.explanation;
    el.qExplanation.classList.remove('hidden');
  }

  el.btnNext.classList.remove('hidden');
  el.btnNext.textContent =
    s.index === s.queue.length - 1 ? '完成本組' : '下一題';
}

function nextQuestion() {
  const s = state.session;
  if (s.index < s.queue.length - 1) {
    s.index += 1;
    renderQuestion();
  } else {
    finishGroup();
  }
}

// ============================================================
// 本組結果
// ============================================================
function finishGroup() {
  const s = state.session;
  const g = state.progress.groups.find((x) => x.groupId === s.groupId);
  const total = s.queue.length;
  const correct = s.correct;
  const accuracy = total > 0 ? correct / total : 0;
  const passed = accuracy >= 0.9;
  const isReview = s.mode === 'review';

  state.progress.totalAnswered += total;
  state.progress.totalCorrect += correct;

  const today = formatDate(new Date());
  if (!state.progress.activityLog.includes(today)) {
    state.progress.activityLog.push(today);
  }

  if (!isReview) {
    applyAnswerResult(g, state.progress.intervals, correct, total);
  }

  storage.save(state.progress);

  el.rVerdict.textContent = isReview
    ? (passed ? '✅ 複習完成' : '⚠️ 仍有錯題')
    : (passed ? '🎉 通過！' : '⚠️ 未達 90%');
  el.rVerdict.className = passed ? 'verdict-ok' : 'verdict-ng';

  el.rCorrect.textContent = correct;
  el.rTotal.textContent = total;
  el.rAccuracy.textContent = (accuracy * 100).toFixed(1) + '%';

  if (isReview) {
    el.rNext.textContent = '（複習模式不影響進度）';
  } else if (passed) {
    if (g.completed) {
      el.rNext.textContent = '本組所有複習已完成 ✅';
    } else {
      const next = new Date(g.nextReviewDate);
      const diff = Math.round(
        (startOfDay(next) - startOfDay(new Date())) / 86400000
      );
      el.rNext.textContent = `已晉級到複習 ${g.currentStage} / ${state.progress.intervals.length}，${diff} 天後再複習。`;
    }
  } else {
    el.rNext.textContent = '未達 90%，本組狀態未變更。明天可以再試一次。';
  }

  renderWrongList(s);
  show('result');
}

// ============================================================
// 錯題回顧
// ============================================================
function renderWrongList(session) {
  const wrongRecords = session.records.filter((r) => !r.correct);

  if (wrongRecords.length === 0) {
    el.wrongSection.classList.add('hidden');
    el.btnRedoWrong.classList.add('hidden');
    return;
  }

  el.wrongSection.classList.remove('hidden');
  el.wrongCount.textContent = wrongRecords.length;
  el.wrongList.innerHTML = '';

  wrongRecords.forEach((rec) => {
    const q = state.questions[rec.questionId];
    const item = document.createElement('div');
    item.className = 'wrong-item';

    const correctLetter = String.fromCharCode(65 + q.answer);
    const selectedLetter =
      rec.selected >= 0 ? String.fromCharCode(65 + rec.selected) : '—';

    item.innerHTML = `
      <div class="wrong-question">${q.source} · ${q.question}</div>
      <div class="wrong-answer">
        <span class="wrong-yours">你的答案：${selectedLetter}</span>
        <span class="wrong-correct">正確答案：${correctLetter}. ${q.options[q.answer]}</span>
      </div>
      ${q.explanation ? `<div class="wrong-explanation">📖 ${q.explanation}</div>` : ''}
    `;
    el.wrongList.appendChild(item);
  });

  if (session.mode === 'normal') {
    el.btnRedoWrong.classList.remove('hidden');
    el.btnRedoWrong.dataset.groupId = session.groupId;
    el.btnRedoWrong.dataset.ids = JSON.stringify(
      wrongRecords.map((r) => r.questionId)
    );
  } else {
    el.btnRedoWrong.classList.add('hidden');
  }
}

function redoWrong() {
  const groupId = parseInt(el.btnRedoWrong.dataset.groupId, 10);
  const ids = JSON.parse(el.btnRedoWrong.dataset.ids || '[]');
  if (ids.length === 0) return;
  startQuiz(groupId, ids, 'review');
}

// ============================================================
// 匯出 / 匯入
// ============================================================
function exportProgress() {
  if (!state.progress) return;

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: state.progress
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `430law-progress-${formatDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerImport() {
  el.fileInput.value = '';
  el.fileInput.click();
}

async function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const raw = parsed.progress || parsed;
    const migrated = migrateProgress(raw);
    if (!migrated) {
      alert('匯入失敗：檔案格式不正確。');
      return;
    }

    if (state.progress) {
      if (!confirm('匯入會覆蓋目前進度，確定嗎？')) return;
    }

    state.progress = migrated;
    storage.save(state.progress);
    renderHome();
    show('home');
    alert('✅ 進度已匯入。');
  } catch (err) {
    console.error(err);
    alert('匯入失敗：' + err.message);
  }
}

// ============================================================
// 重置
// ============================================================
function resetProgress() {
  if (!confirm('確定要清除所有學習進度嗎？此操作無法復原。')) return;
  storage.clear();
  state.progress = null;
  state.session = null;
  show('planSelect');
}

// ============================================================
// PWA 安裝
// ============================================================
let deferredInstallPrompt = null;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function showInstallButtons() {
  el.btnInstall.classList.remove('hidden');
  el.btnInstallEmpty.classList.remove('hidden');
}

function hideInstallButtons() {
  el.btnInstall.classList.add('hidden');
  el.btnInstallEmpty.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!isStandalone()) showInstallButtons();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallButtons();
  console.log('✅ PWA installed');
});

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('Install outcome:', outcome);
    if (outcome === 'accepted') hideInstallButtons();
    deferredInstallPrompt = null;
    return;
  }
  if (isIOS()) {
    alert(
      '在 Safari 中點擊底部「分享」按鈕 → 選擇「加入主畫面」。'
    );
    return;
  }
  alert(
    '請使用瀏覽器地址欄右側的「安裝」圖標，或從瀏覽器菜單中選擇「安裝 430法律刷題」。'
  );
}

// iOS 不支援 beforeinstallprompt，手動顯示
if (isIOS() && !isStandalone()) {
  showInstallButtons();
}
if (isStandalone()) {
  hideInstallButtons();
}

// ============================================================
// Service Worker 註冊
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        console.log('✅ SW registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  });
}

// ============================================================
// 綁定事件
// ============================================================
el.planButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    choosePlan(parseInt(btn.dataset.plan, 10));
  });
});
el.btnRetry.addEventListener('click', init);
el.btnNext.addEventListener('click', nextQuestion);
el.btnBackHome.addEventListener('click', () => {
  el.searchInput.value = '';
  renderHome();
  show('home');
});
el.btnReset.addEventListener('click', resetProgress);
el.btnRedoWrong.addEventListener('click', redoWrong);
el.btnExport.addEventListener('click', exportProgress);
el.btnImport.addEventListener('click', triggerImport);
el.btnImportEmpty.addEventListener('click', triggerImport);
el.fileInput.addEventListener('change', handleImportFile);

el.btnInstall.addEventListener('click', handleInstallClick);
el.btnInstallEmpty.addEventListener('click', handleInstallClick);

// 搜尋：防抖
let searchTimer = null;
el.searchInput.addEventListener('input', (e) => {
  const v = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => performSearch(v), 120);
});

// Modal 關閉
el.modalClose.addEventListener('click', closeQuestionDetail);
el.modalBackdrop.addEventListener('click', closeQuestionDetail);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.modal.classList.contains('hidden')) {
    closeQuestionDetail();
  }
});

// 啟動
init();