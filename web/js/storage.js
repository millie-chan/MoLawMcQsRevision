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