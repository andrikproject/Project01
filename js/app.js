/**
 * Muslim Pedia - Main Application Controller
 * Hash-based routing, page rendering, audio playback
 */

const App = (() => {
  // State
  let currentAudio = null;
  let currentPlayingAyah = null;
  let currentSurahData = null;
  let searchMode = 'surah';
  let allSurahsCache = null;
  let searchGeneration = 0;
  let retryFnMap = {};
  let retryFnCounter = 0;

  // ===== HTML Escaping Utility =====

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // DOM Elements
  const pages = {
    home: document.getElementById('home-page'),
    surahDetail: document.getElementById('surah-detail-page'),
    search: document.getElementById('search-page'),
    bookmark: document.getElementById('bookmark-page'),
    settings: document.getElementById('settings-page')
  };

  const navItems = document.querySelectorAll('.nav-item');

  // ===== Router =====

  function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function handleRoute() {
    const hash = window.location.hash || '#home';

    if (hash.startsWith('#surah/')) {
      const nomor = parseInt(hash.split('/')[1]);
      if (nomor >= 1 && nomor <= 114) {
        showPage('surahDetail');
        loadSurahDetail(nomor);
        return;
      }
    }

    switch (hash) {
      case '#home':
        showPage('home');
        loadHome();
        break;
      case '#search':
        showPage('search');
        loadSearch();
        break;
      case '#bookmark':
        showPage('bookmark');
        loadBookmarks();
        break;
      case '#settings':
        showPage('settings');
        loadSettings();
        break;
      default:
        showPage('home');
        loadHome();
    }
  }

  function showPage(pageName) {
    // Stop audio when navigating away from surah detail
    if (pageName !== 'surahDetail' && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
      currentPlayingAyah = null;
    }

    // Hide all pages
    Object.values(pages).forEach(page => page.classList.remove('active'));

    // Show target page
    if (pages[pageName]) {
      pages[pageName].classList.add('active');
    }

    // Update nav active state
    const navMap = {
      home: 'home',
      surahDetail: null,
      search: 'search',
      bookmark: 'bookmark',
      settings: 'settings'
    };

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === navMap[pageName]) {
        item.classList.add('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  // ===== Home Page =====

  async function loadHome() {
    const surahList = document.getElementById('surah-list');
    const lastReadContainer = document.getElementById('last-read-container');

    // Show last read
    renderLastRead(lastReadContainer);

    // Show loading skeleton
    if (!allSurahsCache) {
      surahList.innerHTML = renderSkeletons(10);
    }

    try {
      const surahs = await API.getAllSurahs();
      allSurahsCache = surahs;
      renderSurahList(surahList, surahs);
    } catch (error) {
      surahList.innerHTML = renderError('Gagal memuat daftar surah', () => loadHome());
    }
  }

  function renderLastRead(container) {
    const lastRead = Storage.getLastRead();
    if (lastRead) {
      container.innerHTML = `
        <div class="last-read-card" onclick="App.navigate('#surah/${lastRead.surahNomor}')">
          <div class="last-read-label"><i class="fas fa-book-open"></i> Terakhir Dibaca</div>
          <div class="last-read-surah">${escapeHtml(lastRead.surahName)}</div>
          <div class="last-read-ayah">Ayat ${escapeHtml(lastRead.nomorAyat)}</div>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  }

  function renderSurahList(container, surahs) {
    container.innerHTML = surahs.map(surah => `
      <div class="surah-card" onclick="App.navigate('#surah/${surah.nomor}')">
        <div class="surah-number">${surah.nomor}</div>
        <div class="surah-info">
          <div class="surah-latin">${escapeHtml(surah.namaLatin)}</div>
          <div class="surah-meta">${escapeHtml(surah.arti)} &bull; ${surah.jumlahAyat} Ayat &bull; ${escapeHtml(surah.tempatTurun)}</div>
        </div>
        <div class="surah-arabic">${escapeHtml(surah.nama)}</div>
      </div>
    `).join('');
  }

  // ===== Surah Detail =====

  async function loadSurahDetail(nomor) {
    const ayahList = document.getElementById('ayah-list');
    const nameEl = document.getElementById('detail-surah-name');
    const infoEl = document.getElementById('detail-surah-info');
    const arabicEl = document.getElementById('detail-surah-arabic');
    const bismillah = document.getElementById('surah-bismillah');
    const navigation = document.getElementById('surah-navigation');

    // Loading state
    nameEl.textContent = 'Memuat...';
    infoEl.textContent = '';
    arabicEl.textContent = '';
    bismillah.innerHTML = '';
    bismillah.style.display = 'none';
    navigation.innerHTML = '';
    ayahList.innerHTML = renderSkeletons(5, 'skeleton-ayah');

    try {
      const surah = await API.getSurahDetail(nomor);
      currentSurahData = surah;

      // Update header
      nameEl.textContent = surah.namaLatin;
      infoEl.textContent = `${surah.arti} - ${surah.jumlahAyat} Ayat - ${surah.tempatTurun}`;
      arabicEl.textContent = surah.nama;

      // Bismillah (not for At-Taubah / surah 9)
      if (nomor !== 9 && nomor !== 1) {
        bismillah.innerHTML = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
        bismillah.style.display = 'block';
      } else {
        bismillah.style.display = 'none';
      }

      // Save last read
      Storage.setLastRead({
        surahNomor: surah.nomor,
        surahName: surah.namaLatin,
        nomorAyat: 1
      });

      // Render ayahs
      renderAyahList(ayahList, surah);

      // Render navigation
      renderSurahNavigation(navigation, surah);
    } catch (error) {
      ayahList.innerHTML = renderError('Gagal memuat surah', () => loadSurahDetail(nomor));
    }
  }

  function renderAyahList(container, surah) {
    const settings = Storage.getSettings();
    container.innerHTML = surah.ayat.map(ayah => {
      const bookmarked = Storage.isBookmarked(surah.nomor, ayah.nomorAyat);
      return `
        <div class="ayah-card" id="ayah-${ayah.nomorAyat}">
          <div class="ayah-header">
            <div class="ayah-number">${ayah.nomorAyat}</div>
            <div class="ayah-actions">
              <button class="ayah-action-btn" onclick="App.playAudio(${surah.nomor}, ${ayah.nomorAyat})" id="play-btn-${ayah.nomorAyat}" title="Putar Audio">
                <i class="fas fa-play"></i>
              </button>
              <button class="ayah-action-btn ${bookmarked ? 'bookmarked' : ''}" data-surah-nomor="${surah.nomor}" data-surah-name="${escapeHtml(surah.namaLatin)}" data-ayah="${ayah.nomorAyat}" onclick="App.toggleBookmark(this)" id="bookmark-btn-${ayah.nomorAyat}" title="Bookmark">
                <i class="fas fa-bookmark"></i>
              </button>
            </div>
          </div>
          <div class="ayah-arabic" style="font-size: ${settings.fontSize}px">${escapeHtml(ayah.teksArab)}</div>
          <div class="ayah-translation">${escapeHtml(ayah.teksIndonesia)}</div>
        </div>
      `;
    }).join('');
  }

  function renderSurahNavigation(container, surah) {
    let html = '';
    if (surah.suratSebelumnya) {
      html += `
        <button class="surah-nav-btn prev" onclick="App.navigate('#surah/${surah.suratSebelumnya.nomor}')">
          <i class="fas fa-chevron-left"></i>
          <span>${escapeHtml(surah.suratSebelumnya.namaLatin)}</span>
        </button>
      `;
    } else {
      html += '<div></div>';
    }

    if (surah.suratSelanjutnya) {
      html += `
        <button class="surah-nav-btn next" onclick="App.navigate('#surah/${surah.suratSelanjutnya.nomor}')">
          <span>${escapeHtml(surah.suratSelanjutnya.namaLatin)}</span>
          <i class="fas fa-chevron-right"></i>
        </button>
      `;
    } else {
      html += '<div></div>';
    }

    container.innerHTML = html;
  }

  // ===== Audio =====

  function playAudio(surahNomor, nomorAyat) {
    const settings = Storage.getSettings();
    const reciterKey = settings.reciter;

    // If same ayah is playing, pause it
    if (currentPlayingAyah === `${surahNomor}-${nomorAyat}` && currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      updatePlayButton(nomorAyat, false);
      currentPlayingAyah = null;
      return;
    }

    // Stop current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      if (currentPlayingAyah) {
        const prevAyahNum = currentPlayingAyah.split('-')[1];
        updatePlayButton(prevAyahNum, false);
      }
    }

    // Find the ayah audio URL
    if (!currentSurahData || currentSurahData.nomor !== surahNomor) return;

    const ayah = currentSurahData.ayat.find(a => a.nomorAyat === nomorAyat);
    if (!ayah || !ayah.audio || !ayah.audio[reciterKey]) return;

    const audioUrl = ayah.audio[reciterKey];
    currentAudio = new Audio(audioUrl);
    currentPlayingAyah = `${surahNomor}-${nomorAyat}`;

    updatePlayButton(nomorAyat, true);

    currentAudio.addEventListener('ended', () => {
      updatePlayButton(nomorAyat, false);
      currentPlayingAyah = null;

      // Auto-play next ayah
      const nextAyahNum = nomorAyat + 1;
      const nextAyah = currentSurahData.ayat.find(a => a.nomorAyat === nextAyahNum);
      if (nextAyah) {
        playAudio(surahNomor, nextAyahNum);
        // Scroll to next ayah
        const nextEl = document.getElementById(`ayah-${nextAyahNum}`);
        if (nextEl) {
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    currentAudio.addEventListener('error', () => {
      updatePlayButton(nomorAyat, false);
      currentPlayingAyah = null;
    });

    currentAudio.play().catch(() => {
      updatePlayButton(nomorAyat, false);
      currentPlayingAyah = null;
    });

    // Update last read
    Storage.setLastRead({
      surahNomor: surahNomor,
      surahName: currentSurahData.namaLatin,
      nomorAyat: nomorAyat
    });
  }

  function updatePlayButton(nomorAyat, isPlaying) {
    const btn = document.getElementById(`play-btn-${nomorAyat}`);
    if (!btn) return;
    if (isPlaying) {
      btn.classList.add('playing');
      btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      btn.classList.remove('playing');
      btn.innerHTML = '<i class="fas fa-play"></i>';
    }
  }

  // ===== Bookmark =====

  function toggleBookmark(btnElement) {
    const surahNomor = parseInt(btnElement.dataset.surahNomor);
    const surahName = btnElement.dataset.surahName;
    const nomorAyat = parseInt(btnElement.dataset.ayah);
    const btn = btnElement;
    const isCurrentlyBookmarked = Storage.isBookmarked(surahNomor, nomorAyat);

    if (isCurrentlyBookmarked) {
      Storage.removeBookmark(surahNomor, nomorAyat);
      if (btn) btn.classList.remove('bookmarked');
    } else {
      // Get the ayah text
      let teksArab = '';
      let teksIndonesia = '';
      if (currentSurahData && currentSurahData.nomor === surahNomor) {
        const ayah = currentSurahData.ayat.find(a => a.nomorAyat === nomorAyat);
        if (ayah) {
          teksArab = ayah.teksArab;
          teksIndonesia = ayah.teksIndonesia;
        }
      }
      Storage.addBookmark({
        surahNomor,
        surahName,
        nomorAyat,
        teksArab,
        teksIndonesia
      });
      if (btn) btn.classList.add('bookmarked');
    }
  }

  function loadBookmarks() {
    const container = document.getElementById('bookmark-list');
    const bookmarks = Storage.getBookmarks();

    if (bookmarks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bookmark"></i>
          <p>Belum ada bookmark</p>
        </div>
      `;
      return;
    }

    container.innerHTML = bookmarks.map((b, index) => `
      <div class="bookmark-card">
        <div class="bookmark-info" onclick="App.navigate('#surah/${b.surahNomor}')">
          <div class="bookmark-surah">${escapeHtml(b.surahName)}</div>
          <div class="bookmark-ayah-info">Ayat ${escapeHtml(b.nomorAyat)}</div>
        </div>
        <div class="bookmark-arabic">${b.teksArab ? escapeHtml(b.teksArab.substring(0, 30)) : ''}</div>
        <button class="bookmark-delete" onclick="App.deleteBookmark(${b.surahNomor}, ${b.nomorAyat})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');
  }

  function deleteBookmark(surahNomor, nomorAyat) {
    Storage.removeBookmark(surahNomor, nomorAyat);
    loadBookmarks();
  }

  // ===== Search =====

  function loadSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    // Show initial state
    if (!input.value) {
      results.innerHTML = `
        <div class="search-empty">
          <i class="fas fa-magnifying-glass"></i>
          <p>Ketik untuk mencari surah atau ayat</p>
        </div>
      `;
    }
  }

  async function performSearch(query) {
    const results = document.getElementById('search-results');
    const clearBtn = document.getElementById('clear-search');

    if (!query || query.trim().length < 2) {
      clearBtn.style.display = 'none';
      results.innerHTML = `
        <div class="search-empty">
          <i class="fas fa-magnifying-glass"></i>
          <p>Ketik minimal 2 karakter</p>
        </div>
      `;
      return;
    }

    clearBtn.style.display = 'block';
    const q = query.toLowerCase().trim();

    if (searchMode === 'surah') {
      await searchSurahs(q, results);
    } else {
      await searchAyahs(q, results);
    }
  }

  async function searchSurahs(q, container) {
    try {
      const surahs = allSurahsCache || await API.getAllSurahs();
      allSurahsCache = surahs;

      const filtered = surahs.filter(s =>
        s.namaLatin.toLowerCase().includes(q) ||
        s.arti.toLowerCase().includes(q) ||
        s.nomor.toString() === q
      );

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="search-empty">
            <i class="fas fa-face-sad-tear"></i>
            <p>Tidak ditemukan</p>
          </div>
        `;
        return;
      }

      renderSurahList(container, filtered);
    } catch (error) {
      container.innerHTML = renderError('Gagal mencari', () => performSearch(document.getElementById('search-input').value));
    }
  }

  async function searchAyahs(q, container) {
    searchGeneration++;
    const thisGeneration = searchGeneration;

    container.innerHTML = '<div class="search-empty"><i class="fas fa-spinner fa-spin"></i><p>Mencari ayat...</p></div>';

    try {
      const surahs = allSurahsCache || await API.getAllSurahs();
      allSurahsCache = surahs;

      if (thisGeneration !== searchGeneration) return;

      // Search through surahs one by one (limited to show quick results)
      const results = [];
      const maxResults = 20;

      // Simple approach: search in surah names first, then load specific surahs if needed
      for (const surah of surahs) {
        if (results.length >= maxResults) break;
        if (thisGeneration !== searchGeneration) return;

        try {
          const detail = await API.getSurahDetail(surah.nomor);
          if (thisGeneration !== searchGeneration) return;

          for (const ayah of detail.ayat) {
            if (results.length >= maxResults) break;
            if (ayah.teksIndonesia.toLowerCase().includes(q) ||
                ayah.teksLatin.toLowerCase().includes(q)) {
              results.push({
                surahNomor: surah.nomor,
                surahName: surah.namaLatin,
                nomorAyat: ayah.nomorAyat,
                teksIndonesia: ayah.teksIndonesia,
                teksArab: ayah.teksArab
              });
            }
          }
          // Show results as they come in
          if (results.length > 0 && thisGeneration === searchGeneration) {
            renderAyahSearchResults(container, results);
          }
        } catch {
          // Skip failed surah fetches
        }
      }

      if (thisGeneration !== searchGeneration) return;

      if (results.length === 0) {
        container.innerHTML = `
          <div class="search-empty">
            <i class="fas fa-face-sad-tear"></i>
            <p>Tidak ditemukan</p>
          </div>
        `;
      } else {
        renderAyahSearchResults(container, results);
      }
    } catch (error) {
      if (thisGeneration !== searchGeneration) return;
      container.innerHTML = renderError('Gagal mencari', () => performSearch(document.getElementById('search-input').value));
    }
  }

  function renderAyahSearchResults(container, results) {
    container.innerHTML = results.map(r => `
      <div class="search-ayah-result" onclick="App.navigate('#surah/${r.surahNomor}')">
        <div class="search-ayah-surah">${escapeHtml(r.surahName)} : ${r.nomorAyat}</div>
        <div class="search-ayah-text">${escapeHtml(r.teksIndonesia.substring(0, 120))}${r.teksIndonesia.length > 120 ? '...' : ''}</div>
      </div>
    `).join('');
  }

  // ===== Settings =====

  function loadSettings() {
    const settings = Storage.getSettings();

    // Font size
    const slider = document.getElementById('font-size-slider');
    const sizeValue = document.getElementById('font-size-value');
    const preview = document.getElementById('preview-arabic');
    slider.value = settings.fontSize;
    sizeValue.textContent = `${settings.fontSize}px`;
    preview.style.fontSize = `${settings.fontSize}px`;

    // Dark mode
    const darkToggle = document.getElementById('dark-mode-toggle');
    darkToggle.checked = settings.darkMode;

    // Reciter
    const reciterSelect = document.getElementById('reciter-select');
    reciterSelect.value = settings.reciter;
  }

  function applySettings() {
    const settings = Storage.getSettings();

    // Apply dark mode
    if (settings.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Apply font size to all Arabic text
    document.querySelectorAll('.ayah-arabic').forEach(el => {
      el.style.fontSize = `${settings.fontSize}px`;
    });
  }

  // ===== Utility =====

  function renderSkeletons(count, className = 'skeleton-card') {
    return Array(count).fill(`<div class="skeleton ${className}"></div>`).join('');
  }

  function renderError(message, retryFn) {
    // Store retry function in a map with unique ID to avoid collisions
    retryFnCounter++;
    const retryId = retryFnCounter;
    retryFnMap[retryId] = retryFn;
    return `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${escapeHtml(message)}</p>
        <button class="retry-btn" onclick="App._retry(${retryId})">
          <i class="fas fa-rotate-right"></i> Coba Lagi
        </button>
      </div>
    `;
  }

  function executeRetry(retryId) {
    const fn = retryFnMap[retryId];
    if (fn) {
      delete retryFnMap[retryId];
      fn();
    }
  }

  // ===== Event Listeners =====

  function initEventListeners() {
    // Bottom navigation
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        navigate(`#${page}`);
      });
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
      navigate('#home');
    });

    // Search input
    let searchTimeout;
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(e.target.value);
      }, 300);
    });

    // Clear search
    document.getElementById('clear-search').addEventListener('click', () => {
      searchInput.value = '';
      document.getElementById('clear-search').style.display = 'none';
      document.getElementById('search-results').innerHTML = `
        <div class="search-empty">
          <i class="fas fa-magnifying-glass"></i>
          <p>Ketik untuk mencari surah atau ayat</p>
        </div>
      `;
    });

    // Search tabs
    document.querySelectorAll('.search-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        searchMode = tab.dataset.tab;
        const query = searchInput.value;
        if (query.length >= 2) {
          performSearch(query);
        }
      });
    });

    // Settings: Font size
    const slider = document.getElementById('font-size-slider');
    slider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      document.getElementById('font-size-value').textContent = `${size}px`;
      document.getElementById('preview-arabic').style.fontSize = `${size}px`;
      const settings = Storage.getSettings();
      settings.fontSize = size;
      Storage.saveSettings(settings);
      applySettings();
    });

    // Settings: Dark mode
    document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
      const settings = Storage.getSettings();
      settings.darkMode = e.target.checked;
      Storage.saveSettings(settings);
      applySettings();
    });

    // Settings: Reciter
    document.getElementById('reciter-select').addEventListener('change', (e) => {
      const settings = Storage.getSettings();
      settings.reciter = e.target.value;
      Storage.saveSettings(settings);
    });
  }

  // ===== Initialize =====

  function init() {
    applySettings();
    initEventListeners();
    initRouter();
  }

  // Public API
  return {
    init,
    navigate,
    playAudio,
    toggleBookmark,
    deleteBookmark,
    _retry: executeRetry
  };
})();

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
