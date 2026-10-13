// ================== 狀態 ==================
const state = {
  questions: [],
  index: 0,
  correctCount: 0,
  answered: false
};

// ================== DOM ==================
const $ = (id) => document.getElementById(id);

const el = {
  loading: $('loading'),
  error: $('error'),
  errorMsg: $('error-msg'),
  btnRetry: $('btn-retry'),

  start: $('start'),
  totalCount: $('total-count'),
  btnStart: $('btn-start'),

  quiz: $('quiz'),
  qIndex: $('q-index'),
  qTotal: $('q-total'),
  qCorrect: $('q-correct'),
  qText: $('q-text'),
  qOptions: $('q-options'),
  qFeedback: $('q-feedback'),
  btnNext: $('btn-next'),

  result: $('result'),
  rCorrect: $('r-correct'),
  rTotal: $('r-total'),
  rAccuracy: $('r-accuracy'),
  btnRestart: $('btn-restart')
};

// ================== 畫面切換 ==================
function show(name) {
  ['loading', 'error', 'start', 'quiz', 'result'].forEach((k) => {
    el[k].classList.toggle('hidden', k !== name);
  });
}

// ================== 題庫格式轉換 ==================
// 原始格式： [{ title, pageNum, qsArr: [{ qsPrefix, qs, ansArr, ans, explanation }] }]
// 目標格式： [{ id, question, options, answer, explanation, source }]

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function stripOptionPrefix(text) {
  // 去掉 "A. "、"B)"、"C、" 之類的前綴
  return text.replace(/^\s*[A-Fa-f][\.\)、\s]+\s*/, '').trim();
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
        source: title,
        qsPrefix: q.qsPrefix || ''
      });
    });
  });

  return flat;
}

// ================== 載入題庫 ==================
async function loadQuestions() {
  show('loading');
  try {
    const res = await fetch('data/2023.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('題庫格式錯誤或為空');
    }

    const flat = normalize(raw);
    if (flat.length === 0) {
      throw new Error('題庫正規化後為 0 題，請檢查 ans 欄位');
    }

    state.questions = flat;
    el.totalCount.textContent = flat.length;
    console.log(`✅ 題庫載入完成：${flat.length} 題，來自 ${raw.length} 個科目`);
    show('start');
  } catch (err) {
    el.errorMsg.textContent =
      '題庫載入失敗：' + err.message +
      '（請確認用 http(s) 開啟，不能直接雙擊 index.html）';
    show('error');
  }
}

// ================== 開始作答 ==================
function startQuiz() {
  state.index = 0;
  state.correctCount = 0;
  state.answered = false;
  el.qTotal.textContent = state.questions.length;
  show('quiz');
  renderQuestion();
}

// ================== 渲染當前題 ==================
function renderQuestion() {
  const q = state.questions[state.index];
  state.answered = false;

  el.qIndex.textContent = state.index + 1;
  el.qCorrect.textContent = state.correctCount;
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

// ================== 選擇答案 ==================
function onSelect(selectedIndex) {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.index];
  const isCorrect = selectedIndex === q.answer;
  if (isCorrect) state.correctCount += 1;
  el.qCorrect.textContent = state.correctCount;

  // 停用所有選項 + 標色
  const buttons = el.qOptions.querySelectorAll('.option');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('is-correct');
    if (i === selectedIndex && !isCorrect) btn.classList.add('is-wrong');
  });

  // 回饋文字
  el.qFeedback.textContent = isCorrect
    ? '✅ 答對了'
    : `❌ 答錯了，正確答案是 ${String.fromCharCode(65 + q.answer)}`;
  el.qFeedback.classList.remove('hidden');
  el.qFeedback.classList.toggle('ok', isCorrect);
  el.qFeedback.classList.toggle('ng', !isCorrect);

  el.btnNext.classList.remove('hidden');
  el.btnNext.textContent =
    state.index === state.questions.length - 1 ? '看結果' : '下一題';
}

// ================== 下一題 / 結束 ==================
function nextQuestion() {
  if (state.index < state.questions.length - 1) {
    state.index += 1;
    renderQuestion();
  } else {
    showResult();
  }
}

// ================== 結果 ==================
function showResult() {
  const total = state.questions.length;
  const correct = state.correctCount;
  const accuracy = total ? (correct / total) * 100 : 0;

  el.rCorrect.textContent = correct;
  el.rTotal.textContent = total;
  el.rAccuracy.textContent = accuracy.toFixed(1) + '%';
  show('result');
}

// ================== 綁定 ==================
el.btnStart.addEventListener('click', startQuiz);
el.btnNext.addEventListener('click', nextQuestion);
el.btnRetry.addEventListener('click', loadQuestions);
el.btnRestart.addEventListener('click', () => show('start'));

// ================== 啟動 ==================
loadQuestions();