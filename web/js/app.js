import {
  createGroups, applyAnswerResult,
  getStageLabel, getCountdown, isDueToday,
  startOfDay
} from './leitner.js';
import { storage } from './storage.js';

// ============================================================
// 狀態
// ============================================================
const state = {
  questions: [],   // 扁平題庫
  progress: null,  // { plan, totalQuestions, intervals, groups, createdAt }
  session: null    // { groupId, queue, index, correct, answered }
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

  home: $('home'),
  homeSummary: $('home-summary'),
  groupList: $('group-list'),
  btnReset: $('btn-reset'),

  quiz: $('quiz'),
  qSource: $('q-source'),
  qIndex: $('q-index'),
  qTotal: $('q-total'),
  qCorrect: $('q-correct'),
  qText: $('q-text'),
  qOptions: $('q-options'),
  qFeedback: $('q-feedback'),
  btnNext: $('btn-next'),

  result: $('result'),
  rVerdict: $('r-verdict'),
  rCorrect: $('r-correct'),
  rTotal: $('r-total'),
  rAccuracy: $('r-accuracy'),
  rNext: $('r-next'),
  btnBackHome: $('btn-back-home')
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
  const res = await fetch('data/2023.json', { cache: 'no-store' });
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

  const saved = storage.load();
  if (saved && Array.isArray(saved.groups) && saved.groups.length > 0) {
    state.progress = saved;
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
    createdAt: new Date().toISOString()
  };
  storage.save(state.progress);
  renderHome();
  show('home');
}

// ============================================================
// 首頁
// ============================================================
function renderHome() {
  const p = state.progress;
  const perGroup = Math.ceil(p.totalQuestions / p.groups.length);
  el.homeSummary.textContent =
    `計劃 ${p.plan} 天 · ${p.groups.length} 組 · 每組約 ${perGroup} 題 · 總題數 ${p.totalQuestions}`;

  el.groupList.innerHTML = '';
  p.groups.forEach((g) => {
    const due = isDueToday(g);
    const countdown = getCountdown(g);

    const li = document.createElement('li');
    li.className = 'group-item';
    if (g.completed) li.classList.add('is-done');
    else if (due) li.classList.add('is-due');

    const statusText = g.completed
      ? '✅'
      : due
        ? '▶ 開始'
        : countdown;

    li.innerHTML = `
      <div class="group-info">
        <div class="group-title">第 ${g.groupId + 1} 組</div>
        <div class="group-meta">${g.questionIds.length} 題 · ${getStageLabel(g, p.intervals)}</div>
      </div>
      <div class="group-status">${statusText}</div>
    `;

    if (!g.completed) {
      li.classList.add('clickable');
      li.addEventListener('click', () => startQuiz(g.groupId));
    }

    el.groupList.appendChild(li);
  });
}

// ============================================================
// 開始某組
// ============================================================
function startQuiz(groupId) {
  const g = state.progress.groups.find((x) => x.groupId === groupId);
  if (!g || g.completed) return;

  state.session = {
    groupId,
    queue: [...g.questionIds],
    index: 0,
    correct: 0,
    answered: false
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

  applyAnswerResult(g, state.progress.intervals, correct, total);
  storage.save(state.progress);

  el.rVerdict.textContent = passed ? '🎉 通過！' : '⚠️ 未達 90%';
  el.rVerdict.className = passed ? 'verdict-ok' : 'verdict-ng';
  el.rCorrect.textContent = correct;
  el.rTotal.textContent = total;
  el.rAccuracy.textContent = (accuracy * 100).toFixed(1) + '%';

  if (passed) {
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

  state.session = null;
  show('result');
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
  renderHome();
  show('home');
});
el.btnReset.addEventListener('click', resetProgress);

// 啟動
init();