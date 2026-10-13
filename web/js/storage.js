const KEY = 'leitner-quiz-progress-v1';

export const storage = {
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('儲存失敗', e);
      return false;
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('讀取失敗', e);
      return null;
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  }
};

// ---------- 資料校驗 / 遷移 ----------
export function migrateProgress(p) {
  if (!p || typeof p !== 'object') return null;
  if (!Array.isArray(p.groups) || p.groups.length === 0) return null;
  if (!Array.isArray(p.intervals) || p.intervals.length === 0) return null;
  if (typeof p.plan !== 'number') return null;

  // 補上新增欄位
  if (!Array.isArray(p.activityLog)) p.activityLog = [];
  if (typeof p.totalAnswered !== 'number') p.totalAnswered = 0;
  if (typeof p.totalCorrect !== 'number') p.totalCorrect = 0;

  return p;
}