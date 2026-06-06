const App = (() => {
    let currentPage = 'home';
    let currentTransactionType = 'expense';
    let selectedCategory = '';
    let editingTransactionId = null;
    let editTransactionType = 'expense';
    let editSelectedCategory = '';

    // Report state
    let reportMonth = new Date().getMonth();
    let reportYear = new Date().getFullYear();
    let activeReportTab = 'ringkasan';

    // Chart instances
    let chartInstances = {};

    // Budget edit state
    let editingBudgetCategory = null;

    // HTML escaping utility to prevent XSS
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const init = () => {
        applyTheme();
        setupEventListeners();
        handleRoute();
        window.addEventListener('hashchange', handleRoute);
        registerServiceWorker();
    };

    const registerServiceWorker = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.log('SW registration failed:', err);
            });
        }
    };

    const applyTheme = () => {
        const settings = StorageModule.getSettings();
        if (settings.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            const toggle = document.getElementById('toggle-dark-mode');
            if (toggle) toggle.checked = true;
        }
    };

    const handleRoute = () => {
        const hash = window.location.hash || '#home';
        const parts = hash.substring(1).split('/');
        const page = parts[0];
        const param = parts[1] || null;

        const validPages = ['home', 'add', 'transactions', 'reports', 'settings', 'edit', 'budget'];

        if (validPages.includes(page)) {
            showPage(page);
            if (page === 'home') renderDashboard();
            else if (page === 'add') renderAddForm();
            else if (page === 'transactions') renderTransactions();
            else if (page === 'edit' && param) renderEditForm(param);
            else if (page === 'reports') renderReports();
            else if (page === 'settings') renderSettings();
            else if (page === 'budget') renderBudgetPage();
        } else {
            window.location.hash = '#home';
        }
    };

    const showPage = (page) => {
        currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) targetPage.classList.add('active');

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // For edit/budget page, highlight nothing special in nav
        if (page === 'edit' || page === 'budget') {
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        }
    };

    const setupEventListeners = () => {
        // Type toggle for add form
        document.querySelectorAll('#transaction-form .type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#transaction-form .type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTransactionType = btn.dataset.type;
                selectedCategory = '';
                renderCategoryGrid('category-grid', currentTransactionType, false);
            });
        });

        // Type toggle for edit form
        document.querySelectorAll('#edit-transaction-form .type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#edit-transaction-form .type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                editTransactionType = btn.dataset.type;
                editSelectedCategory = '';
                renderCategoryGrid('edit-category-grid', editTransactionType, true);
            });
        });

        // Add form submit
        document.getElementById('transaction-form').addEventListener('submit', handleAddTransaction);

        // Edit form submit
        document.getElementById('edit-transaction-form').addEventListener('submit', handleEditTransaction);

        // Delete button
        document.getElementById('btn-delete-transaction').addEventListener('click', handleDeleteTransaction);

        // Back button on edit page
        document.getElementById('btn-back-edit').addEventListener('click', () => {
            window.location.hash = '#transactions';
        });

        // Back button on budget page
        document.getElementById('btn-back-budget').addEventListener('click', () => {
            window.location.hash = '#settings';
        });

        // Dark mode toggle
        document.getElementById('toggle-dark-mode').addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            const settings = StorageModule.getSettings();
            settings.theme = theme;
            StorageModule.saveSettings(settings);
        });

        // Filter listeners for transaction history
        document.getElementById('filter-month').addEventListener('change', renderTransactionList);
        document.getElementById('filter-type').addEventListener('change', renderTransactionList);
        document.getElementById('filter-category').addEventListener('change', renderTransactionList);
        document.getElementById('filter-date-from').addEventListener('change', renderTransactionList);
        document.getElementById('filter-date-to').addEventListener('change', renderTransactionList);

        // Search input
        document.getElementById('search-transactions').addEventListener('input', renderTransactionList);

        // Report tabs
        document.querySelectorAll('.report-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeReportTab = tab.dataset.tab;
                renderReportContent();
            });
        });

        // Report month navigation
        document.getElementById('report-month-prev').addEventListener('click', () => {
            reportMonth--;
            if (reportMonth < 0) {
                reportMonth = 11;
                reportYear--;
            }
            updateReportMonthLabel();
            renderReportContent();
        });

        document.getElementById('report-month-next').addEventListener('click', () => {
            reportMonth++;
            if (reportMonth > 11) {
                reportMonth = 0;
                reportYear++;
            }
            updateReportMonthLabel();
            renderReportContent();
        });

        // Export/Import buttons
        document.getElementById('btn-export-csv').addEventListener('click', handleExportCSV);
        document.getElementById('btn-export-json').addEventListener('click', handleExportJSON);
        document.getElementById('btn-import-json').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        document.getElementById('import-file-input').addEventListener('change', handleImportJSON);
    };

    // ==================== DASHBOARD ====================
    const renderDashboard = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        document.getElementById('current-month-label').textContent =
            `${DataModule.months[month]} ${year}`;

        const transactions = StorageModule.getTransactionsByMonth(year, month);

        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;
        });

        const saldo = totalIncome - totalExpense;

        document.getElementById('summary-saldo').textContent = DataModule.formatCurrency(saldo);
        document.getElementById('summary-income').textContent = DataModule.formatCurrency(totalIncome);
        document.getElementById('summary-expense').textContent = DataModule.formatCurrency(totalExpense);

        // Render statistics
        renderDashboardStats(transactions, year, month);

        // Recent transactions (last 5)
        const allTransactions = StorageModule.getTransactions();
        const recent = allTransactions.slice(0, 5);

        const container = document.getElementById('recent-transactions');
        if (recent.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-receipt"></i>
                    <p>Belum ada transaksi</p>
                    <a href="#add" class="btn-primary">Tambah Transaksi</a>
                </div>`;
            return;
        }

        container.innerHTML = recent.map(t => createTransactionItem(t)).join('');
    };

    const renderDashboardStats = (transactions, year, month) => {
        const expenses = transactions.filter(t => t.type === 'expense');

        // Largest expense
        let largestExpense = null;
        expenses.forEach(t => {
            if (!largestExpense || t.amount > largestExpense.amount) {
                largestExpense = t;
            }
        });

        if (largestExpense) {
            document.getElementById('stat-largest-expense').textContent = DataModule.formatCurrency(largestExpense.amount);
            document.getElementById('stat-largest-category').textContent = largestExpense.category;
        } else {
            document.getElementById('stat-largest-expense').textContent = '-';
            document.getElementById('stat-largest-category').textContent = '';
        }

        // Daily average
        const now = new Date();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const currentDay = (year === now.getFullYear() && month === now.getMonth()) ? now.getDate() : daysInMonth;
        const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
        const dailyAvg = currentDay > 0 ? Math.round(totalExpense / currentDay) : 0;
        document.getElementById('stat-daily-avg').textContent = DataModule.formatCurrency(dailyAvg);

        // Transaction count
        document.getElementById('stat-tx-count').textContent = transactions.length;

        // Mini chart - last 7 days spending
        renderMiniChart(year, month);
    };

    const renderMiniChart = (year, month) => {
        const canvas = document.getElementById('mini-chart');
        if (!canvas) return;

        if (chartInstances['mini']) {
            chartInstances['mini'].destroy();
        }

        const now = new Date();
        const labels = [];
        const data = [];

        const transactions = StorageModule.getTransactions();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            labels.push(d.getDate().toString());

            const dayExpense = transactions
                .filter(t => t.date === dateStr && t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);
            data.push(dayExpense);
        }

        chartInstances['mini'] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: 'rgba(79, 70, 229, 0.6)',
                    borderRadius: 3,
                    barThickness: 16
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    };

    const createTransactionItem = (t) => {
        const category = DataModule.getCategoryByName(t.category, t.type);
        const icon = category ? category.icon : 'fa-circle';
        const amountClass = t.type === 'income' ? 'income' : 'expense';
        const sign = t.type === 'income' ? '+' : '-';

        return `
            <a href="#edit/${escapeHtml(t.id)}" class="transaction-item">
                <div class="transaction-icon ${amountClass}">
                    <i class="fa-solid ${escapeHtml(icon)}"></i>
                </div>
                <div class="transaction-details">
                    <span class="transaction-category">${escapeHtml(t.category)}</span>
                    <span class="transaction-desc">${escapeHtml(t.description)}</span>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${sign} ${DataModule.formatCurrency(t.amount)}
                </div>
            </a>`;
    };

    // ==================== ADD TRANSACTION ====================
    const renderAddForm = () => {
        currentTransactionType = 'expense';
        selectedCategory = '';

        document.getElementById('transaction-form').reset();
        document.querySelectorAll('#transaction-form .type-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#transaction-form .type-btn[data-type="expense"]').classList.add('active');

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('input-date').value = today;

        document.getElementById('error-amount').textContent = '';
        document.getElementById('error-category').textContent = '';

        renderCategoryGrid('category-grid', 'expense', false);
    };

    const renderCategoryGrid = (containerId, type, isEdit) => {
        const categories = DataModule.getCategories(type);
        const container = document.getElementById(containerId);
        const selected = isEdit ? editSelectedCategory : selectedCategory;

        container.innerHTML = categories.map(c => `
            <button type="button" class="category-item ${c.name === selected ? 'selected' : ''}"
                data-category="${escapeHtml(c.name)}" data-edit="${isEdit}">
                <i class="fa-solid ${escapeHtml(c.icon)}"></i>
                <span>${escapeHtml(c.name)}</span>
            </button>
        `).join('');

        container.querySelectorAll('.category-item').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.category-item').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                if (isEdit) {
                    editSelectedCategory = btn.dataset.category;
                } else {
                    selectedCategory = btn.dataset.category;
                }
            });
        });
    };

    const handleAddTransaction = (e) => {
        e.preventDefault();
        const amount = Math.round(parseFloat(document.getElementById('input-amount').value));
        const description = document.getElementById('input-description').value.trim();
        const date = document.getElementById('input-date').value;

        let valid = true;

        if (!amount || amount <= 0) {
            document.getElementById('error-amount').textContent = 'Jumlah harus lebih dari 0';
            valid = false;
        } else {
            document.getElementById('error-amount').textContent = '';
        }

        if (!selectedCategory) {
            document.getElementById('error-category').textContent = 'Pilih kategori terlebih dahulu';
            valid = false;
        } else {
            document.getElementById('error-category').textContent = '';
        }

        if (!valid) return;

        StorageModule.addTransaction({
            type: currentTransactionType,
            amount: amount,
            category: selectedCategory,
            description: description,
            date: date
        });

        window.location.hash = '#home';
    };

    // ==================== EDIT TRANSACTION ====================
    const renderEditForm = (id) => {
        editingTransactionId = id;
        const transaction = StorageModule.getTransactionById(id);

        if (!transaction) {
            window.location.hash = '#home';
            return;
        }

        editTransactionType = transaction.type;
        editSelectedCategory = transaction.category;

        document.querySelectorAll('#edit-transaction-form .type-btn').forEach(b => {
            b.classList.remove('active');
            if (b.dataset.type === transaction.type) b.classList.add('active');
        });

        document.getElementById('edit-amount').value = transaction.amount;
        document.getElementById('edit-description').value = transaction.description || '';
        document.getElementById('edit-date').value = transaction.date;

        document.getElementById('edit-error-amount').textContent = '';
        document.getElementById('edit-error-category').textContent = '';

        renderCategoryGrid('edit-category-grid', transaction.type, true);
    };

    const handleEditTransaction = (e) => {
        e.preventDefault();
        const amount = Math.round(parseFloat(document.getElementById('edit-amount').value));
        const description = document.getElementById('edit-description').value.trim();
        const date = document.getElementById('edit-date').value;

        let valid = true;

        if (!amount || amount <= 0) {
            document.getElementById('edit-error-amount').textContent = 'Jumlah harus lebih dari 0';
            valid = false;
        } else {
            document.getElementById('edit-error-amount').textContent = '';
        }

        if (!editSelectedCategory) {
            document.getElementById('edit-error-category').textContent = 'Pilih kategori terlebih dahulu';
            valid = false;
        } else {
            document.getElementById('edit-error-category').textContent = '';
        }

        if (!valid) return;

        StorageModule.updateTransaction(editingTransactionId, {
            type: editTransactionType,
            amount: amount,
            category: editSelectedCategory,
            description: description,
            date: date
        });

        window.location.hash = '#home';
    };

    const handleDeleteTransaction = () => {
        if (!editingTransactionId) return;
        if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
            StorageModule.deleteTransaction(editingTransactionId);
            editingTransactionId = null;
            window.location.hash = '#home';
        }
    };

    // ==================== TRANSACTION HISTORY ====================
    const renderTransactions = () => {
        populateMonthFilter();
        populateCategoryFilter();
        renderTransactionList();
    };

    const populateMonthFilter = () => {
        const select = document.getElementById('filter-month');
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let options = '<option value="all">Semua Bulan</option>';
        for (let i = 0; i < 12; i++) {
            const monthIndex = (currentMonth - i + 12) % 12;
            const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
            const value = `${year}-${monthIndex}`;
            const label = `${DataModule.months[monthIndex]} ${year}`;
            options += `<option value="${value}">${label}</option>`;
        }

        select.innerHTML = options;
    };

    const populateCategoryFilter = () => {
        const select = document.getElementById('filter-category');
        const allCategories = [...DataModule.expenseCategories, ...DataModule.incomeCategories];

        let options = '<option value="all">Semua Kategori</option>';
        allCategories.forEach(c => {
            options += `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`;
        });

        select.innerHTML = options;
    };

    const renderTransactionList = () => {
        const monthFilter = document.getElementById('filter-month').value;
        const typeFilter = document.getElementById('filter-type').value;
        const categoryFilter = document.getElementById('filter-category').value;
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        const searchTerm = document.getElementById('search-transactions').value.trim().toLowerCase();

        let transactions = StorageModule.getTransactions();

        // Apply month filter
        if (monthFilter !== 'all') {
            const [year, month] = monthFilter.split('-').map(Number);
            transactions = transactions.filter(t => {
                const date = new Date(t.date + 'T00:00:00');
                return date.getFullYear() === year && date.getMonth() === month;
            });
        }

        // Apply type filter
        if (typeFilter !== 'all') {
            transactions = transactions.filter(t => t.type === typeFilter);
        }

        // Apply category filter
        if (categoryFilter !== 'all') {
            transactions = transactions.filter(t => t.category === categoryFilter);
        }

        // Apply date range filter
        if (dateFrom) {
            transactions = transactions.filter(t => t.date >= dateFrom);
        }
        if (dateTo) {
            transactions = transactions.filter(t => t.date <= dateTo);
        }

        // Apply search filter
        if (searchTerm) {
            transactions = transactions.filter(t => {
                const desc = (t.description || '').toLowerCase();
                const cat = t.category.toLowerCase();
                return desc.includes(searchTerm) || cat.includes(searchTerm);
            });
        }

        // Show result count
        const resultCount = document.getElementById('result-count');
        resultCount.textContent = `${transactions.length} transaksi ditemukan`;

        const container = document.getElementById('all-transactions');

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-receipt"></i>
                    <p>Tidak ada transaksi</p>
                </div>`;
            return;
        }

        // Group by date
        const grouped = {};
        transactions.forEach(t => {
            if (!grouped[t.date]) grouped[t.date] = [];
            grouped[t.date].push(t);
        });

        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

        let html = '';
        sortedDates.forEach(date => {
            html += `<div class="date-group">
                <div class="date-header">${DataModule.formatDate(date)}</div>
                ${grouped[date].map(t => createTransactionItem(t)).join('')}
            </div>`;
        });

        container.innerHTML = html;
    };

    // ==================== REPORTS ====================
    const renderReports = () => {
        updateReportMonthLabel();
        renderReportContent();
    };

    const updateReportMonthLabel = () => {
        document.getElementById('report-month-label').textContent =
            `${DataModule.months[reportMonth]} ${reportYear}`;
    };

    const renderReportContent = () => {
        const container = document.getElementById('report-content');

        if (activeReportTab === 'ringkasan') {
            renderReportRingkasan(container);
        } else if (activeReportTab === 'kategori') {
            renderReportKategori(container);
        } else if (activeReportTab === 'tren') {
            renderReportTren(container);
        }
    };

    const renderReportRingkasan = (container) => {
        const transactions = StorageModule.getTransactionsByMonth(reportYear, reportMonth);
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;
        });

        const netSavings = totalIncome - totalExpense;

        // Previous month comparison
        let prevMonth = reportMonth - 1;
        let prevYear = reportYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }

        const prevTransactions = StorageModule.getTransactionsByMonth(prevYear, prevMonth);
        let prevIncome = 0;
        let prevExpense = 0;
        prevTransactions.forEach(t => {
            if (t.type === 'income') prevIncome += t.amount;
            else prevExpense += t.amount;
        });

        const incomeChange = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome * 100).toFixed(1) : 0;
        const expenseChange = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense * 100).toFixed(1) : 0;

        const incomeArrow = incomeChange >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const incomeClass = incomeChange >= 0 ? 'positive' : 'negative';
        const expenseArrow = expenseChange >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const expenseClass = expenseChange <= 0 ? 'positive' : 'negative';

        container.innerHTML = `
            <div class="report-summary-grid">
                <div class="report-summary-item">
                    <div class="report-summary-label">Pemasukan</div>
                    <div class="report-summary-value income">${DataModule.formatCurrency(totalIncome)}</div>
                    <div class="report-comparison ${incomeClass}">
                        <i class="fa-solid ${incomeArrow}"></i>
                        <span>${Math.abs(incomeChange)}% dari bulan lalu</span>
                    </div>
                </div>
                <div class="report-summary-item">
                    <div class="report-summary-label">Pengeluaran</div>
                    <div class="report-summary-value expense">${DataModule.formatCurrency(totalExpense)}</div>
                    <div class="report-comparison ${expenseClass}">
                        <i class="fa-solid ${expenseArrow}"></i>
                        <span>${Math.abs(expenseChange)}% dari bulan lalu</span>
                    </div>
                </div>
                <div class="report-summary-item full-width">
                    <div class="report-summary-label">Tabungan Bersih</div>
                    <div class="report-summary-value ${netSavings >= 0 ? 'income' : 'expense'}">${netSavings >= 0 ? '+' : '-'} ${DataModule.formatCurrency(Math.abs(netSavings))}</div>
                </div>
            </div>
            <div class="chart-container">
                <h3>Perbandingan dengan Bulan Lalu</h3>
                <div class="chart-wrapper">
                    <canvas id="chart-comparison"></canvas>
                </div>
            </div>
        `;

        // Render comparison bar chart
        renderComparisonChart(totalIncome, totalExpense, prevIncome, prevExpense);
    };

    const renderComparisonChart = (income, expense, prevIncome, prevExpense) => {
        const canvas = document.getElementById('chart-comparison');
        if (!canvas) return;

        if (chartInstances['comparison']) chartInstances['comparison'].destroy();

        const prevMonthIdx = reportMonth - 1 < 0 ? 11 : reportMonth - 1;

        chartInstances['comparison'] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: [DataModule.months[prevMonthIdx].substring(0, 3), DataModule.months[reportMonth].substring(0, 3)],
                datasets: [
                    {
                        label: 'Pemasukan',
                        data: [prevIncome, income],
                        backgroundColor: '#10B981',
                        borderRadius: 4
                    },
                    {
                        label: 'Pengeluaran',
                        data: [prevExpense, expense],
                        backgroundColor: '#EF4444',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11 } } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => 'Rp ' + (v / 1000) + 'k' }
                    }
                }
            }
        });
    };

    const renderReportKategori = (container) => {
        const transactions = StorageModule.getTransactionsByMonth(reportYear, reportMonth);
        const expenses = transactions.filter(t => t.type === 'expense');
        const incomes = transactions.filter(t => t.type === 'income');

        // Group expenses by category
        const expenseByCategory = {};
        expenses.forEach(t => {
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
        });

        const incomeByCategory = {};
        incomes.forEach(t => {
            incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
        });

        const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
        const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);

        const chartColors = [
            '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#EC4899', '#06B6D4', '#84CC16', '#F97316'
        ];

        // Build expense legend
        const expenseEntries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
        const expenseLegend = expenseEntries.map((entry, i) => {
            const percent = totalExpense > 0 ? ((entry[1] / totalExpense) * 100).toFixed(1) : 0;
            return `<div class="legend-item">
                <div class="legend-color" style="background: ${chartColors[i % chartColors.length]}"></div>
                <span class="legend-name">${escapeHtml(entry[0])}</span>
                <span class="legend-amount">${DataModule.formatCurrency(entry[1])}</span>
                <span class="legend-percent">${percent}%</span>
            </div>`;
        }).join('');

        // Build income legend
        const incomeEntries = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);
        const incomeLegend = incomeEntries.map((entry, i) => {
            const percent = totalIncome > 0 ? ((entry[1] / totalIncome) * 100).toFixed(1) : 0;
            return `<div class="legend-item">
                <div class="legend-color" style="background: ${chartColors[i % chartColors.length]}"></div>
                <span class="legend-name">${escapeHtml(entry[0])}</span>
                <span class="legend-amount">${DataModule.formatCurrency(entry[1])}</span>
                <span class="legend-percent">${percent}%</span>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div class="chart-container">
                <h3>Pengeluaran per Kategori</h3>
                <div class="chart-wrapper">
                    <canvas id="chart-expense-category"></canvas>
                </div>
                <div class="category-legend">${expenseLegend || '<p style="text-align:center;color:var(--text-muted);font-size:0.8rem;">Tidak ada data</p>'}</div>
            </div>
            <div class="chart-container">
                <h3>Pemasukan per Kategori</h3>
                <div class="chart-wrapper">
                    <canvas id="chart-income-category"></canvas>
                </div>
                <div class="category-legend">${incomeLegend || '<p style="text-align:center;color:var(--text-muted);font-size:0.8rem;">Tidak ada data</p>'}</div>
            </div>
        `;

        // Render expense donut
        if (expenseEntries.length > 0) {
            if (chartInstances['expenseCat']) chartInstances['expenseCat'].destroy();
            chartInstances['expenseCat'] = new Chart(document.getElementById('chart-expense-category'), {
                type: 'doughnut',
                data: {
                    labels: expenseEntries.map(e => e[0]),
                    datasets: [{
                        data: expenseEntries.map(e => e[1]),
                        backgroundColor: expenseEntries.map((_, i) => chartColors[i % chartColors.length]),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Render income donut
        if (incomeEntries.length > 0) {
            if (chartInstances['incomeCat']) chartInstances['incomeCat'].destroy();
            chartInstances['incomeCat'] = new Chart(document.getElementById('chart-income-category'), {
                type: 'doughnut',
                data: {
                    labels: incomeEntries.map(e => e[0]),
                    datasets: [{
                        data: incomeEntries.map(e => e[1]),
                        backgroundColor: incomeEntries.map((_, i) => chartColors[i % chartColors.length]),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } }
                }
            });
        }
    };

    const renderReportTren = (container) => {
        container.innerHTML = `
            <div class="chart-container">
                <h3>Pengeluaran Harian</h3>
                <div class="chart-wrapper">
                    <canvas id="chart-daily-trend"></canvas>
                </div>
            </div>
            <div class="chart-container">
                <h3>Perbandingan 6 Bulan Terakhir</h3>
                <div class="chart-wrapper">
                    <canvas id="chart-monthly-trend"></canvas>
                </div>
            </div>
        `;

        renderDailyTrendChart();
        renderMonthlyTrendChart();
    };

    const renderDailyTrendChart = () => {
        const canvas = document.getElementById('chart-daily-trend');
        if (!canvas) return;

        if (chartInstances['dailyTrend']) chartInstances['dailyTrend'].destroy();

        const daysInMonth = new Date(reportYear, reportMonth + 1, 0).getDate();
        const transactions = StorageModule.getTransactionsByMonth(reportYear, reportMonth);
        const expenses = transactions.filter(t => t.type === 'expense');

        const dailyData = new Array(daysInMonth).fill(0);
        expenses.forEach(t => {
            const day = new Date(t.date + 'T00:00:00').getDate();
            dailyData[day - 1] += t.amount;
        });

        const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

        chartInstances['dailyTrend'] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pengeluaran',
                    data: dailyData,
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => 'Rp ' + (v / 1000) + 'k', font: { size: 9 } }
                    }
                }
            }
        });
    };

    const renderMonthlyTrendChart = () => {
        const canvas = document.getElementById('chart-monthly-trend');
        if (!canvas) return;

        if (chartInstances['monthlyTrend']) chartInstances['monthlyTrend'].destroy();

        const labels = [];
        const incomeData = [];
        const expenseData = [];

        for (let i = 5; i >= 0; i--) {
            let m = reportMonth - i;
            let y = reportYear;
            while (m < 0) { m += 12; y--; }

            labels.push(DataModule.months[m].substring(0, 3));
            const txns = StorageModule.getTransactionsByMonth(y, m);
            let inc = 0, exp = 0;
            txns.forEach(t => {
                if (t.type === 'income') inc += t.amount;
                else exp += t.amount;
            });
            incomeData.push(inc);
            expenseData.push(exp);
        }

        chartInstances['monthlyTrend'] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Pemasukan',
                        data: incomeData,
                        backgroundColor: '#10B981',
                        borderRadius: 4
                    },
                    {
                        label: 'Pengeluaran',
                        data: expenseData,
                        backgroundColor: '#EF4444',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 10 } } }
                },
                scales: {
                    x: { ticks: { font: { size: 10 } } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => 'Rp ' + (v / 1000) + 'k', font: { size: 9 } }
                    }
                }
            }
        });
    };

    // ==================== BUDGET MANAGEMENT ====================
    const renderBudgetPage = () => {
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const budgets = StorageModule.getBudgets();
        const categories = DataModule.expenseCategories;
        const transactions = StorageModule.getTransactionsByMonth(now.getFullYear(), now.getMonth());
        const expenses = transactions.filter(t => t.type === 'expense');

        // Calculate spent per category
        const spentByCategory = {};
        expenses.forEach(t => {
            spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount;
        });

        // Total budget and spent
        let totalBudget = 0;
        let totalSpent = 0;

        const categoryBudgets = categories.map(cat => {
            const budget = budgets.find(b => b.category === cat.name && b.month === currentMonthStr);
            const amount = budget ? budget.amount : 0;
            const spent = spentByCategory[cat.name] || 0;
            totalBudget += amount;
            totalSpent += spent;
            return { ...cat, budgetAmount: amount, spent };
        });

        // Render summary
        document.getElementById('budget-total-amount').textContent = DataModule.formatCurrency(totalBudget);
        document.getElementById('budget-total-spent').textContent = DataModule.formatCurrency(totalSpent);

        const totalPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
        const totalProgressEl = document.getElementById('budget-total-progress');
        totalProgressEl.style.width = totalPercent + '%';
        totalProgressEl.className = 'budget-progress-fill' + getProgressColorClass(totalPercent);

        // Render budget cards
        const listContainer = document.getElementById('budget-list');
        listContainer.innerHTML = categoryBudgets.map(cat => {
            const percent = cat.budgetAmount > 0 ? Math.min((cat.spent / cat.budgetAmount) * 100, 100) : 0;
            const percentDisplay = cat.budgetAmount > 0 ? percent.toFixed(0) + '%' : '-';
            const progressClass = getProgressColorClass(percent);
            const isEditing = editingBudgetCategory === cat.name;

            return `
                <div class="budget-card">
                    <div class="budget-card-header">
                        <div class="budget-card-title">
                            <i class="fa-solid ${escapeHtml(cat.icon)}"></i>
                            ${escapeHtml(cat.name)}
                        </div>
                        <button class="budget-card-btn" data-category="${escapeHtml(cat.name)}" onclick="App.toggleBudgetEdit('${escapeHtml(cat.name)}')">
                            ${isEditing ? 'Batal' : 'Edit'}
                        </button>
                    </div>
                    <div class="budget-card-amounts">
                        <span class="spent">${DataModule.formatCurrency(cat.spent)} terpakai</span>
                        <span>dari ${DataModule.formatCurrency(cat.budgetAmount)}</span>
                    </div>
                    <div class="budget-progress-bar">
                        <div class="budget-progress-fill${progressClass}" style="width: ${percent}%"></div>
                    </div>
                    <div class="budget-card-percent" style="color: ${getPercentColor(percent)}">${percentDisplay}</div>
                    ${isEditing ? `
                        <div class="budget-edit-form">
                            <input type="number" id="budget-input-${escapeHtml(cat.id)}" placeholder="Jumlah anggaran" value="${cat.budgetAmount || ''}">
                            <button class="btn-save-budget" onclick="App.saveBudget('${escapeHtml(cat.name)}', '${escapeHtml(cat.id)}')">Simpan</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    };

    const getProgressColorClass = (percent) => {
        if (percent >= 90) return ' danger';
        if (percent >= 75) return ' warning';
        return '';
    };

    const getPercentColor = (percent) => {
        if (percent >= 90) return 'var(--danger)';
        if (percent >= 75) return 'var(--warning)';
        return 'var(--success)';
    };

    const toggleBudgetEdit = (categoryName) => {
        if (editingBudgetCategory === categoryName) {
            editingBudgetCategory = null;
        } else {
            editingBudgetCategory = categoryName;
        }
        renderBudgetPage();
    };

    const saveBudget = (categoryName, categoryId) => {
        const input = document.getElementById(`budget-input-${categoryId}`);
        const amount = Math.round(parseFloat(input.value)) || 0;

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        StorageModule.setBudget({
            category: categoryName,
            month: currentMonthStr,
            amount: amount
        });

        editingBudgetCategory = null;
        renderBudgetPage();
    };

    // ==================== EXPORT / IMPORT ====================
    const handleExportCSV = () => {
        const transactions = StorageModule.getTransactions();
        if (transactions.length === 0) {
            alert('Tidak ada transaksi untuk diekspor.');
            return;
        }

        const header = 'Tanggal,Tipe,Kategori,Deskripsi,Jumlah\n';
        const rows = transactions.map(t => {
            const tipe = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
            const desc = (t.description || '').replace(/,/g, ';').replace(/"/g, '""');
            return `${t.date},${tipe},${t.category},"${desc}",${t.amount}`;
        }).join('\n');

        const csv = header + rows;
        downloadFile(csv, 'catatinaja_transaksi.csv', 'text/csv');
    };

    const handleExportJSON = () => {
        const data = StorageModule.exportAllData();
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, 'catatinaja_backup.json', 'application/json');
    };

    const handleImportJSON = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.transactions && !data.budgets) {
                    alert('Format file tidak valid. Pastikan file yang dipilih adalah backup dari CatatinAja.');
                    return;
                }

                // Validate transactions array shape
                if (data.transactions) {
                    if (!Array.isArray(data.transactions)) {
                        alert('Format file tidak valid. Field "transactions" harus berupa array.');
                        return;
                    }
                    const requiredFields = ['id', 'type', 'amount', 'category', 'date'];
                    for (let i = 0; i < data.transactions.length; i++) {
                        const t = data.transactions[i];
                        if (!t || typeof t !== 'object') {
                            alert(`Format file tidak valid. Transaksi ke-${i + 1} bukan objek yang valid.`);
                            return;
                        }
                        for (const field of requiredFields) {
                            if (!(field in t)) {
                                alert(`Format file tidak valid. Transaksi ke-${i + 1} tidak memiliki field "${field}".`);
                                return;
                            }
                        }
                        if (typeof t.amount !== 'number' || t.amount < 0) {
                            alert(`Format file tidak valid. Transaksi ke-${i + 1} memiliki jumlah yang tidak valid.`);
                            return;
                        }
                        if (t.type !== 'income' && t.type !== 'expense') {
                            alert(`Format file tidak valid. Transaksi ke-${i + 1} memiliki tipe yang tidak valid.`);
                            return;
                        }
                    }
                }

                // Validate budgets array shape
                if (data.budgets) {
                    if (!Array.isArray(data.budgets)) {
                        alert('Format file tidak valid. Field "budgets" harus berupa array.');
                        return;
                    }
                }

                if (confirm('Impor data akan mengganti semua data saat ini. Lanjutkan?')) {
                    StorageModule.importAllData(data);
                    alert('Data berhasil diimpor!');
                    window.location.hash = '#home';
                    renderDashboard();
                }
            } catch (err) {
                alert('Gagal membaca file. Pastikan file berformat JSON yang valid.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const downloadFile = (content, filename, mimeType) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ==================== SETTINGS ====================
    const renderSettings = () => {
        const settings = StorageModule.getSettings();
        document.getElementById('toggle-dark-mode').checked = settings.theme === 'dark';
    };

    // Init on DOM ready
    document.addEventListener('DOMContentLoaded', init);

    return {
        init,
        toggleBudgetEdit,
        saveBudget
    };
})();
