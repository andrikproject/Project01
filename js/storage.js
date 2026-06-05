/**
 * LocalStorage Service
 * Handles bookmarks, last read position, and settings
 */

const Storage = (() => {
  const KEYS = {
    BOOKMARKS: 'muslimpedia_bookmarks',
    LAST_READ: 'muslimpedia_lastread',
    SETTINGS: 'muslimpedia_settings',
    TASBIH: 'muslimpedia_tasbih'
  };

  const DEFAULT_SETTINGS = {
    fontSize: 28,
    darkMode: false,
    reciter: '05'
  };

  // ===== Bookmarks =====

  function getBookmarks() {
    try {
      const data = localStorage.getItem(KEYS.BOOKMARKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveBookmarks(bookmarks) {
    try {
      localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Error saving bookmarks:', e);
    }
  }

  function addBookmark(bookmark) {
    const bookmarks = getBookmarks();
    const exists = bookmarks.some(
      b => b.surahNomor === bookmark.surahNomor && b.nomorAyat === bookmark.nomorAyat
    );
    if (!exists) {
      bookmarks.push(bookmark);
      saveBookmarks(bookmarks);
    }
  }

  function removeBookmark(surahNomor, nomorAyat) {
    let bookmarks = getBookmarks();
    bookmarks = bookmarks.filter(
      b => !(b.surahNomor === surahNomor && b.nomorAyat === nomorAyat)
    );
    saveBookmarks(bookmarks);
  }

  function isBookmarked(surahNomor, nomorAyat) {
    const bookmarks = getBookmarks();
    return bookmarks.some(
      b => b.surahNomor === surahNomor && b.nomorAyat === nomorAyat
    );
  }

  // ===== Last Read =====

  function getLastRead() {
    try {
      const data = localStorage.getItem(KEYS.LAST_READ);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function setLastRead(data) {
    try {
      localStorage.setItem(KEYS.LAST_READ, JSON.stringify({
        surahNomor: data.surahNomor,
        surahName: data.surahName,
        nomorAyat: data.nomorAyat
      }));
    } catch (e) {
      console.error('Error saving last read:', e);
    }
  }

  // ===== Settings =====

  function getSettings() {
    try {
      const data = localStorage.getItem(KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  // ===== Tasbih =====

  function getTasbih() {
    try {
      const data = localStorage.getItem(KEYS.TASBIH);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  function saveTasbih(tasbihData) {
    try {
      localStorage.setItem(KEYS.TASBIH, JSON.stringify(tasbihData));
    } catch (e) {
      console.error('Error saving tasbih:', e);
    }
  }

  return {
    getBookmarks,
    saveBookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
    getLastRead,
    setLastRead,
    getSettings,
    saveSettings,
    getTasbih,
    saveTasbih
  };
})();
