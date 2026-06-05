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
  let tasbihCount = 0;
  let tasbihTarget = 33;
  let tasbihDzikir = 'Subhanallah';

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
    settings: document.getElementById('settings-page'),
    more: document.getElementById('more-page'),
    doa: document.getElementById('doa-page'),
    sholat: document.getElementById('sholat-page'),
    tasbih: document.getElementById('tasbih-page'),
    asmaulHusna: document.getElementById('asmaul-husna-page'),
    hijriyah: document.getElementById('hijriyah-page'),
    kiblat: document.getElementById('kiblat-page'),
    juzAmma: document.getElementById('juz-amma-page'),
    favorit: document.getElementById('favorit-page'),
    zakat: document.getElementById('zakat-page'),
    hadits: document.getElementById('hadits-page')
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
      case '#more':
        showPage('more');
        loadMore();
        break;
      case '#doa':
        showPage('doa');
        loadDoa();
        break;
      case '#sholat':
        showPage('sholat');
        loadSholat();
        break;
      case '#tasbih':
        showPage('tasbih');
        loadTasbih();
        break;
      case '#asmaul-husna':
        showPage('asmaulHusna');
        loadAsmaulHusna();
        break;
      case '#hijriyah':
        showPage('hijriyah');
        loadHijriyah();
        break;
      case '#kiblat':
        showPage('kiblat');
        loadKiblat();
        break;
      case '#juz-amma':
        showPage('juzAmma');
        loadJuzAmma();
        break;
      case '#favorit':
        showPage('favorit');
        loadFavorit();
        break;
      case '#zakat':
        showPage('zakat');
        loadZakat();
        break;
      case '#hadits':
        showPage('hadits');
        loadHadits();
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

    // Clean up kiblat orientation listener when navigating away
    if (pageName !== 'kiblat') {
      if (kiblatOrientationHandler) {
        window.removeEventListener('deviceorientation', kiblatOrientationHandler);
        kiblatOrientationHandler = null;
      }
      if (kiblatWatchId !== null) {
        navigator.geolocation.clearWatch(kiblatWatchId);
        kiblatWatchId = null;
      }
    }

    // Hide all pages
    Object.values(pages).forEach(page => {
      if (page) page.classList.remove('active');
    });

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
      settings: 'more',
      more: 'more',
      doa: 'more',
      sholat: 'more',
      tasbih: 'more',
      asmaulHusna: 'more',
      hijriyah: 'more',
      kiblat: 'more',
      juzAmma: 'more',
      favorit: 'more',
      zakat: 'more',
      hadits: 'more'
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
        bismillah.innerHTML = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';
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

      const results = [];
      const maxResults = 20;

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

  // ===== More Page =====

  function loadMore() {
    const grid = document.getElementById('more-grid');
    const items = [
      { icon: 'fa-hands-praying', label: 'Doa Harian', hash: '#doa' },
      { icon: 'fa-clock', label: 'Jadwal Sholat', hash: '#sholat' },
      { icon: 'fa-hand-holding-heart', label: 'Tasbih Digital', hash: '#tasbih' },
      { icon: 'fa-star', label: 'Asmaul Husna', hash: '#asmaul-husna' },
      { icon: 'fa-calendar', label: 'Kalender Hijriyah', hash: '#hijriyah' },
      { icon: 'fa-compass', label: 'Arah Kiblat', hash: '#kiblat' },
      { icon: 'fa-book-quran', label: 'Juz Amma', hash: '#juz-amma' },
      { icon: 'fa-heart', label: 'Surah Favorit', hash: '#favorit' },
      { icon: 'fa-calculator', label: 'Kalkulator Zakat', hash: '#zakat' },
      { icon: 'fa-quote-right', label: 'Hadits', hash: '#hadits' },
      { icon: 'fa-gear', label: 'Pengaturan', hash: '#settings' }
    ];

    grid.innerHTML = items.map(item => `
      <div class="more-item" onclick="App.navigate('${item.hash}')">
        <div class="more-item-icon"><i class="fas ${item.icon}"></i></div>
        <span class="more-item-label">${escapeHtml(item.label)}</span>
      </div>
    `).join('');
  }

  // ===== Doa Harian =====

  function loadDoa() {
    const container = document.getElementById('doa-list');
    if (typeof DataDoa === 'undefined') {
      container.innerHTML = renderError('Gagal memuat data doa. Silakan muat ulang halaman.', function() { loadDoa(); });
      return;
    }
    container.innerHTML = DataDoa.map(doa => `
      <div class="doa-card" onclick="App.toggleDoa(this)">
        <div class="doa-card-header">
          <span class="doa-card-title">${escapeHtml(doa.title)}</span>
          <i class="fas fa-chevron-down doa-chevron"></i>
        </div>
        <div class="doa-card-body">
          <p class="doa-arabic">${escapeHtml(doa.arabic)}</p>
          <p class="doa-latin">${escapeHtml(doa.latin)}</p>
          <p class="doa-translation">${escapeHtml(doa.translation)}</p>
        </div>
      </div>
    `).join('');
  }

  function toggleDoa(element) {
    element.classList.toggle('expanded');
  }

  // ===== Jadwal Sholat =====

  async function loadSholat() {
    const timesContainer = document.getElementById('sholat-times');
    const dateEl = document.getElementById('sholat-date');
    const cityInput = document.getElementById('sholat-city');
    const city = cityInput.value.trim() || 'Jakarta';

    // Show current date
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('id-ID', options);

    timesContainer.innerHTML = renderSkeletons(6, 'skeleton-card');

    try {
      const data = await API.getPrayerTimes(city, 'Indonesia');
      const timings = data.timings;

      const prayerList = [
        { name: 'Subuh', key: 'Fajr', icon: 'fa-cloud-sun' },
        { name: 'Syuruq', key: 'Sunrise', icon: 'fa-sun' },
        { name: 'Dzuhur', key: 'Dhuhr', icon: 'fa-sun' },
        { name: 'Ashar', key: 'Asr', icon: 'fa-cloud-sun' },
        { name: 'Maghrib', key: 'Maghrib', icon: 'fa-moon' },
        { name: 'Isya', key: 'Isha', icon: 'fa-moon' }
      ];

      // Determine next prayer
      const currentTime = now.getHours() * 60 + now.getMinutes();
      let nextPrayerKey = null;

      for (const prayer of prayerList) {
        const timeStr = timings[prayer.key];
        if (timeStr) {
          const parts = timeStr.split(':');
          const prayerMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
          if (prayerMinutes > currentTime) {
            nextPrayerKey = prayer.key;
            break;
          }
        }
      }

      timesContainer.innerHTML = prayerList.map(prayer => {
        const time = timings[prayer.key] || '--:--';
        const cleanTime = time.split(' ')[0];
        const isNext = prayer.key === nextPrayerKey;
        return `
          <div class="sholat-time-item${isNext ? ' next' : ''}">
            <div class="sholat-time-left">
              <i class="fas ${prayer.icon}"></i>
              <span class="sholat-time-name">${escapeHtml(prayer.name)}</span>
            </div>
            <span class="sholat-time-value">${escapeHtml(cleanTime)}</span>
            ${isNext ? '<span class="sholat-next-badge">Berikutnya</span>' : ''}
          </div>
        `;
      }).join('');
    } catch (error) {
      timesContainer.innerHTML = renderError('Gagal memuat jadwal sholat', () => loadSholat());
    }
  }

  // ===== Tasbih Digital =====

  function loadTasbih() {
    const presetsContainer = document.getElementById('tasbih-presets');
    const targetRow = document.getElementById('tasbih-target-row');
    const countEl = document.getElementById('tasbih-count');

    const dzikirList = [
      'Subhanallah',
      'Alhamdulillah',
      'Allahu Akbar',
      'Astaghfirullah',
      'La ilaha illallah'
    ];

    const targets = [33, 99, 100, 0]; // 0 = unlimited

    // Load saved data
    const savedData = Storage.getTasbih();
    if (savedData[tasbihDzikir] !== undefined) {
      tasbihCount = savedData[tasbihDzikir];
    } else {
      tasbihCount = 0;
    }
    countEl.textContent = tasbihCount;

    // Render presets
    presetsContainer.innerHTML = dzikirList.map(d => `
      <button class="tasbih-preset-btn${d === tasbihDzikir ? ' active' : ''}" onclick="App.setDzikir('${escapeHtml(d)}')">${escapeHtml(d)}</button>
    `).join('');

    // Render targets
    targetRow.innerHTML = targets.map(t => {
      const label = t === 0 ? '∞' : t;
      const isActive = t === tasbihTarget;
      return `<button class="tasbih-target-btn${isActive ? ' active' : ''}" onclick="App.setTasbihTarget(${t})">${label}</button>`;
    }).join('');
  }

  function incrementTasbih() {
    if (tasbihTarget > 0 && tasbihCount >= tasbihTarget) return;

    tasbihCount++;
    const countEl = document.getElementById('tasbih-count');
    if (countEl) countEl.textContent = tasbihCount;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Save
    const savedData = Storage.getTasbih();
    savedData[tasbihDzikir] = tasbihCount;
    Storage.saveTasbih(savedData);

    // Visual feedback on circle
    const circle = document.getElementById('tasbih-circle');
    if (circle) {
      circle.classList.add('tapped');
      setTimeout(() => circle.classList.remove('tapped'), 150);
    }
  }

  function resetTasbih() {
    tasbihCount = 0;
    const countEl = document.getElementById('tasbih-count');
    if (countEl) countEl.textContent = '0';

    const savedData = Storage.getTasbih();
    savedData[tasbihDzikir] = 0;
    Storage.saveTasbih(savedData);
  }

  function setDzikir(name) {
    tasbihDzikir = name;
    const savedData = Storage.getTasbih();
    tasbihCount = savedData[name] || 0;

    const countEl = document.getElementById('tasbih-count');
    if (countEl) countEl.textContent = tasbihCount;

    // Update active preset button
    document.querySelectorAll('.tasbih-preset-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent === name) btn.classList.add('active');
    });
  }

  function setTasbihTarget(target) {
    tasbihTarget = target;
    document.querySelectorAll('.tasbih-target-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    // Re-render targets to update active state
    const targetRow = document.getElementById('tasbih-target-row');
    const targets = [33, 99, 100, 0];
    targetRow.innerHTML = targets.map(t => {
      const label = t === 0 ? '\u221E' : t;
      const isActive = t === target;
      return `<button class="tasbih-target-btn${isActive ? ' active' : ''}" onclick="App.setTasbihTarget(${t})">${label}</button>`;
    }).join('');
  }

  // ===== Asmaul Husna =====

  function loadAsmaulHusna() {
    const container = document.getElementById('asmaul-husna-list');
    if (typeof DataAsmaulHusna === 'undefined') {
      container.innerHTML = renderError('Gagal memuat data Asmaul Husna. Silakan muat ulang halaman.', function() { loadAsmaulHusna(); });
      return;
    }
    container.innerHTML = DataAsmaulHusna.map(name => `
      <div class="asmaul-card">
        <div class="asmaul-number">${name.number}</div>
        <div class="asmaul-info">
          <div class="asmaul-latin">${escapeHtml(name.latin)}</div>
          <div class="asmaul-meaning">${escapeHtml(name.meaning)}</div>
        </div>
        <div class="asmaul-arabic">${escapeHtml(name.arabic)}</div>
      </div>
    `).join('');
  }

  // ===== Kalender Hijriyah =====

  async function loadHijriyah() {
    const container = document.getElementById('hijriyah-content');
    container.innerHTML = renderSkeletons(1, 'skeleton-card');

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    const dayNames = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = dayNames[now.getDay()];

    const gregorianStr = now.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    try {
      const data = await API.getHijriDate(dateStr);
      const hijri = data.hijri;

      container.innerHTML = `
        <div class="hijriyah-card">
          <div class="hijriyah-icon"><i class="fas fa-moon"></i></div>
          <div class="hijriyah-day">${escapeHtml(hijri.day)}</div>
          <div class="hijriyah-month-ar">${escapeHtml(hijri.month.ar)}</div>
          <div class="hijriyah-month">${escapeHtml(hijri.month.en)}</div>
          <div class="hijriyah-year">${escapeHtml(hijri.year)} H</div>
          <div class="hijriyah-divider"></div>
          <div class="hijriyah-gregorian">
            <i class="fas fa-calendar-day"></i> ${escapeHtml(gregorianStr)}
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = renderError('Gagal memuat kalender Hijriyah', () => loadHijriyah());
    }
  }

  // ===== Arah Kiblat =====

  let kiblatWatchId = null;
  let kiblatOrientationHandler = null;

  function loadKiblat() {
    const container = document.getElementById('kiblat-content');
    container.innerHTML = `
      <div class="kiblat-status" id="kiblat-status">
        <i class="fas fa-spinner fa-spin"></i> Mengambil lokasi...
      </div>
      <div class="kiblat-compass" id="kiblat-compass" style="display:none;">
        <div class="kiblat-compass-ring">
          <div class="kiblat-arrow" id="kiblat-arrow">
            <i class="fas fa-location-arrow"></i>
          </div>
          <div class="kiblat-kaaba-icon">🕋</div>
        </div>
        <div class="kiblat-degree" id="kiblat-degree"></div>
      </div>
      <div class="kiblat-info" id="kiblat-info"></div>
    `;

    // Clean up previous listeners
    if (kiblatWatchId !== null) {
      navigator.geolocation.clearWatch(kiblatWatchId);
      kiblatWatchId = null;
    }
    if (kiblatOrientationHandler) {
      window.removeEventListener('deviceorientation', kiblatOrientationHandler);
      kiblatOrientationHandler = null;
    }

    if (!navigator.geolocation) {
      document.getElementById('kiblat-status').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Geolokasi tidak didukung oleh browser ini.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const qiblaBearing = calculateQiblaBearing(userLat, userLon);

        const statusEl = document.getElementById('kiblat-status');
        const compassEl = document.getElementById('kiblat-compass');
        const degreeEl = document.getElementById('kiblat-degree');
        const infoEl = document.getElementById('kiblat-info');

        statusEl.style.display = 'none';
        compassEl.style.display = 'flex';
        degreeEl.textContent = Math.round(qiblaBearing) + '\u00B0';

        // Attach orientation listener helper
        function attachOrientationListener() {
          kiblatOrientationHandler = function(event) {
            if (event.alpha !== null) {
              const alpha = event.alpha;
              const rotation = qiblaBearing - alpha;
              const arrowEl = document.getElementById('kiblat-arrow');
              if (arrowEl) {
                arrowEl.style.transform = 'rotate(' + rotation + 'deg)';
              }
            }
          };
          window.addEventListener('deviceorientation', kiblatOrientationHandler);
          infoEl.innerHTML = '<p class="kiblat-hint"><i class="fas fa-mobile-alt"></i> Putar perangkat Anda. Panah akan menunjukkan arah Kiblat.</p>';
        }

        // Check if Device Orientation is available
        if (window.DeviceOrientationEvent) {
          // iOS 13+ requires explicit permission request from a user gesture
          if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            infoEl.innerHTML = '<button class="kiblat-permission-btn" id="kiblat-permission-btn"><i class="fas fa-compass"></i> Aktifkan Kompas</button>' +
              '<p class="kiblat-hint">iOS memerlukan izin untuk mengakses sensor orientasi.</p>';
            var permBtn = document.getElementById('kiblat-permission-btn');
            if (permBtn) {
              permBtn.addEventListener('click', function() {
                DeviceOrientationEvent.requestPermission().then(function(state) {
                  if (state === 'granted') {
                    attachOrientationListener();
                  } else {
                    infoEl.innerHTML = '<p class="kiblat-hint kiblat-error"><i class="fas fa-exclamation-triangle"></i> Izin sensor ditolak. Aktifkan melalui pengaturan browser untuk menggunakan kompas.</p>';
                  }
                }).catch(function() {
                  infoEl.innerHTML = '<p class="kiblat-hint kiblat-error"><i class="fas fa-exclamation-triangle"></i> Gagal meminta izin sensor orientasi.</p>';
                });
              });
            }
          } else {
            attachOrientationListener();
          }
        } else {
          // Desktop - show static arrow
          const arrowEl = document.getElementById('kiblat-arrow');
          if (arrowEl) {
            arrowEl.style.transform = 'rotate(' + qiblaBearing + 'deg)';
          }
          infoEl.innerHTML = '<p class="kiblat-hint"><i class="fas fa-desktop"></i> Gunakan perangkat mobile untuk kompas interaktif</p>';
        }
      },
      (error) => {
        const statusEl = document.getElementById('kiblat-status');
        statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan.';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function calculateQiblaBearing(userLat, userLon) {
    const toRad = function(d) { return d * Math.PI / 180; };
    const toDeg = function(r) { return r * 180 / Math.PI; };
    const latUser = toRad(userLat);
    const lonUser = toRad(userLon);
    const latKaaba = toRad(21.4225);
    const lonKaaba = toRad(39.8262);
    const dLon = lonKaaba - lonUser;
    const x = Math.sin(dLon);
    const y = Math.cos(latUser) * Math.tan(latKaaba) - Math.sin(latUser) * Math.cos(dLon);
    let bearing = toDeg(Math.atan2(x, y));
    if (bearing < 0) bearing += 360;
    return bearing;
  }

  // ===== Juz Amma =====

  async function loadJuzAmma() {
    const container = document.getElementById('juz-amma-list');
    container.innerHTML = renderSkeletons(10);

    try {
      const surahs = allSurahsCache || await API.getAllSurahs();
      allSurahsCache = surahs;
      const juzAmmaSurahs = surahs.filter(function(s) { return s.nomor >= 78; });
      renderSurahList(container, juzAmmaSurahs);
    } catch (error) {
      container.innerHTML = renderError('Gagal memuat daftar surah Juz Amma', function() { loadJuzAmma(); });
    }
  }

  // ===== Surah Favorit =====

  async function loadFavorit() {
    const container = document.getElementById('favorit-list');
    container.innerHTML = renderSkeletons(8);

    const favoritNumbers = [1, 18, 19, 20, 36, 55, 56, 67];

    try {
      const surahs = allSurahsCache || await API.getAllSurahs();
      allSurahsCache = surahs;
      const favoritSurahs = favoritNumbers.map(function(num) {
        return surahs.find(function(s) { return s.nomor === num; });
      }).filter(Boolean);
      renderSurahList(container, favoritSurahs);
    } catch (error) {
      container.innerHTML = renderError('Gagal memuat surah favorit', function() { loadFavorit(); });
    }
  }

  // ===== Kalkulator Zakat =====

  function loadZakat() {
    const resultEl = document.getElementById('zakat-result');
    resultEl.innerHTML = '';
  }

  function calculateZakat() {
    const amountInput = document.getElementById('zakat-amount');
    const resultEl = document.getElementById('zakat-result');
    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
      resultEl.innerHTML = '<div class="zakat-result-card zakat-error"><i class="fas fa-exclamation-circle"></i><p>Masukkan jumlah harta yang valid.</p></div>';
      return;
    }

    const nisab = 85000000;
    const formattedAmount = amount.toLocaleString('id-ID');

    if (amount >= nisab) {
      const zakat = amount * 0.025;
      const formattedZakat = zakat.toLocaleString('id-ID');
      resultEl.innerHTML = '<div class="zakat-result-card zakat-success">' +
        '<div class="zakat-result-label">Zakat yang harus dikeluarkan:</div>' +
        '<div class="zakat-result-amount">Rp ' + escapeHtml(formattedZakat) + '</div>' +
        '<p class="zakat-result-note">2,5% dari Rp ' + escapeHtml(formattedAmount) + '</p>' +
        '</div>';
    } else {
      const remaining = nisab - amount;
      const formattedRemaining = remaining.toLocaleString('id-ID');
      resultEl.innerHTML = '<div class="zakat-result-card zakat-warning">' +
        '<i class="fas fa-info-circle"></i>' +
        '<p>Harta Anda belum mencapai nisab.</p>' +
        '<p class="zakat-result-note">Kurang Rp ' + escapeHtml(formattedRemaining) + ' untuk mencapai nisab.</p>' +
        '</div>';
    }
  }

  // ===== Hadits =====

  function loadHadits() {
    const container = document.getElementById('hadits-list');
    if (typeof DataHadits === 'undefined') {
      container.innerHTML = renderError('Gagal memuat data hadits. Silakan muat ulang halaman.', function() { loadHadits(); });
      return;
    }
    container.innerHTML = DataHadits.map(function(hadits) {
      return '<div class="hadits-card" onclick="App.toggleHadits(this)">' +
        '<div class="hadits-card-header">' +
          '<div class="hadits-card-title-wrap">' +
            '<span class="hadits-card-title">' + escapeHtml(hadits.title) + '</span>' +
            '<span class="hadits-card-narrator">' + escapeHtml(hadits.narrator) + '</span>' +
          '</div>' +
          '<i class="fas fa-chevron-down hadits-chevron"></i>' +
        '</div>' +
        '<div class="hadits-card-body">' +
          '<p class="hadits-arabic">' + escapeHtml(hadits.arabic) + '</p>' +
          '<p class="hadits-translation">' + escapeHtml(hadits.translation) + '</p>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function toggleHadits(element) {
    element.classList.toggle('expanded');
  }

  // ===== Utility =====

  function renderSkeletons(count, className = 'skeleton-card') {
    return Array(count).fill(`<div class="skeleton ${className}"></div>`).join('');
  }

  function renderError(message, retryFn) {
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

    // Sholat city search
    document.getElementById('sholat-search-btn').addEventListener('click', () => {
      loadSholat();
    });

    document.getElementById('sholat-city').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loadSholat();
      }
    });

    // Tasbih circle tap
    document.getElementById('tasbih-circle').addEventListener('click', () => {
      incrementTasbih();
    });

    // Tasbih reset
    document.getElementById('tasbih-reset').addEventListener('click', () => {
      resetTasbih();
    });

    // Zakat calculator
    document.getElementById('zakat-calculate-btn').addEventListener('click', () => {
      calculateZakat();
    });

    document.getElementById('zakat-amount').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        calculateZakat();
      }
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
    toggleDoa,
    toggleHadits,
    setDzikir,
    setTasbihTarget,
    _retry: executeRetry
  };
})();

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
