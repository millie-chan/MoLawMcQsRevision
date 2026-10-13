// ============================================================
// Leitner System 核心
// ============================================================

export const STUDY_PLANS = {
  15: { groups: 7,  intervals: [1, 2, 4, 8] },
  30: { groups: 14, intervals: [1, 2, 4, 8, 16] },
  60: { groups: 28, intervals: [1, 2, 4, 8, 16, 32] }
};

export const PASS_THRESHOLD = 0.9;

// ---------- 日期工具 ----------
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- 分組 ----------
export function createGroups(totalQuestions, studyDays) {
  const plan = STUDY_PLANS[studyDays];
  if (!plan) throw new Error('不支援的天數: ' + studyDays);

  const { groups: groupCount, intervals } = plan;
  const perGroup = Math.ceil(totalQuestions / groupCount);

  const groups = [];
  for (let i = 0; i < groupCount; i++) {
    const start = i * perGroup;
    const end = Math.min(start + perGroup, totalQuestions);
    if (start >= totalQuestions) break;

    groups.push({
      groupId: i,
      questionIds: Array.from({ length: end - start }, (_, k) => start + k),
      currentStage: 0,
      nextReviewDate: null,
      completed: false,
      lastAccuracy: null,
      history: []
    });
  }

  return { groups, intervals };
}

// ---------- 下次複習日期 ----------
export function calcNextReviewDate(stage, intervals, fromDate = new Date()) {
  if (stage <= 0 || stage > intervals.length) return null;
  return addDays(fromDate, intervals[stage - 1]);
}

// ---------- 套用答題結果 ----------
export function applyAnswerResult(group, intervals, correct, total) {
  const accuracy = total > 0 ? correct / total : 0;
  group.lastAccuracy = accuracy;
  group.history.push({
    date: new Date().toISOString(),
    correct,
    total,
    accuracy
  });

  if (accuracy >= PASS_THRESHOLD) {
    group.currentStage += 1;

    if (group.currentStage > intervals.length) {
      group.completed = true;
      group.nextReviewDate = null;
    } else {
      group.nextReviewDate =
        calcNextReviewDate(group.currentStage, intervals).toISOString();
    }
  } else {
    group.nextReviewDate = addDays(new Date(), 1).toISOString();
  }

  return group;
}

// ---------- 顯示輔助 ----------
export function getStageLabel(group, intervals) {
  if (group.completed) return '✅ 已完成';
  if (group.currentStage === 0) return '🆕 新題';
  return `複習 ${group.currentStage} / ${intervals.length}`;
}

export function getCountdown(group) {
  if (group.completed || !group.nextReviewDate) return '';
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(group.nextReviewDate));
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays < 0) return `逾期 ${-diffDays} 天`;
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays <= 6) return `${diffDays} 天後`;

  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

export function isDueToday(group) {
  if (group.completed) return false;
  if (group.currentStage === 0) return true;
  if (!group.nextReviewDate) return false;
  return startOfDay(new Date(group.nextReviewDate)) <= startOfDay(new Date());
}