// A versioned preview must not write over the original app's local records.
(() => {
  const store = window.localStorage;
  const prefix = 'streakfit-visual-v034:';
  const initialKeys = new Set(['streakfit-v1','streakfit-theme','streakfit-view-mode','streakfit-theme-profile','streakfit-language']);
  globalThis.STREAKFIT_STORAGE = {
    getItem(key) {
      if (store.getItem(prefix+'removed:'+key)) return null;
      const value = store.getItem(prefix+key);
      return value ?? (initialKeys.has(key) ? store.getItem(key) : null);
    },
    setItem(key, value) {
      store.setItem(prefix+key, value);
      store.removeItem(prefix+'removed:'+key);
    },
    removeItem(key) {
      store.setItem(prefix+'removed:'+key, '1');
      store.removeItem(prefix+key);
    }
  };
})();
