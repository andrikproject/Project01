const App = (() => {
    let currentPage = 'home';
    let currentTransactionType = 'expense';
    let selectedCategory = '';
    let editingTransactionId = null;
    let editTransactionType = 'expense';
    let editSelectedCategory = '';

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

        const validPages = ['home', 'add', 'transactions', 'reports', 'settings', 'edit'];

        if (validPages.includes(page)) {
            showPage(page);
            if (page === 'home') renderDashboard();
            else if (page === 'add') renderAddForm();
            else if (page === 'transactions') renderTransactions();
            else if (page === 'edit' && param) renderEditForm(param);
            else if (page === 'settings') renderSettings();
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

        // For edit page, highlight nothing special in nav
        if (page === 'edit') {
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
    };

    // Dashboard
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

    const createTransactionItem = (t) => {
        const category = DataModule.getCategoryByName(t.category, t.type);
        const icon = category ? category.icon : 'fa-circle';
        const amountClass = t.type === 'income' ? 'income' : 'expense';
        const sign = t.type === 'income' ? '+' : '-';

        return `
            <a href="#edit/${t.id}" class="transaction-item">
                <div class="transaction-icon ${amountClass}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="transaction-details">
                    <span class="transaction-category">${t.category}</span>
                    <span class="transaction-desc">${t.description || ''}</span>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${sign} ${DataModule.formatCurrency(t.amount)}
                </div>
            </a>`;
    };

    // Add Transaction
    const renderAddForm = () => {
        currentTransactionType = 'expense';
        selectedCategory = '';

        // Reset form
        document.getElementById('transaction-form').reset();
        document.querySelectorAll('#transaction-form .type-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#transaction-form .type-btn[data-type="expense"]').classList.add('active');

        // Set today's date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('input-date').value = today;

        // Clear errors
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
                data-category="${c.name}" data-edit="${isEdit}">
                <i class="fa-solid ${c.icon}"></i>
                <span>${c.name}</span>
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
        const amount = parseInt(document.getElementById('input-amount').value);
        const description = document.getElementById('input-description').value.trim();
        const date = document.getElementById('input-date').value;

        // Validate
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

    // Edit Transaction
    const renderEditForm = (id) => {
        editingTransactionId = id;
        const transaction = StorageModule.getTransactionById(id);

        if (!transaction) {
            window.location.hash = '#home';
            return;
        }

        editTransactionType = transaction.type;
        editSelectedCategory = transaction.category;

        // Set type toggle
        document.querySelectorAll('#edit-transaction-form .type-btn').forEach(b => {
            b.classList.remove('active');
            if (b.dataset.type === transaction.type) b.classList.add('active');
        });

        // Set form values
        document.getElementById('edit-amount').value = transaction.amount;
        document.getElementById('edit-description').value = transaction.description || '';
        document.getElementById('edit-date').value = transaction.date;

        // Clear errors
        document.getElementById('edit-error-amount').textContent = '';
        document.getElementById('edit-error-category').textContent = '';

        renderCategoryGrid('edit-category-grid', transaction.type, true);
    };

    const handleEditTransaction = (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('edit-amount').value);
        const description = document.getElementById('edit-description').value.trim();
        const date = document.getElementById('edit-date').value;

        // Validate
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

    // Transaction History
    const renderTransactions = () => {
        populateMonthFilter();
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

    const renderTransactionList = () => {
        const monthFilter = document.getElementById('filter-month').value;
        const typeFilter = document.getElementById('filter-type').value;

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

        // Sort dates descending
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

    // Settings
    const renderSettings = () => {
        const settings = StorageModule.getSettings();
        document.getElementById('toggle-dark-mode').checked = settings.theme === 'dark';
    };

    // Init on DOM ready
    document.addEventListener('DOMContentLoaded', init);

    return { init };
})();
