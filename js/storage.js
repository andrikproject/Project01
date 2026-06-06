const StorageModule = (() => {
    const KEYS = {
        transactions: 'catatinaja_transactions',
        budgets: 'catatinaja_budgets',
        settings: 'catatinaja_settings'
    };

    const getItem = (key, defaultValue) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Error reading localStorage:', e);
            return defaultValue;
        }
    };

    const setItem = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Error writing localStorage:', e);
            return false;
        }
    };

    // Transactions
    const getTransactions = () => {
        return getItem(KEYS.transactions, []);
    };

    const setTransactions = (transactions) => {
        setItem(KEYS.transactions, transactions);
    };

    const addTransaction = (transaction) => {
        const transactions = getTransactions();
        const newTransaction = {
            ...transaction,
            id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString()
        };
        transactions.unshift(newTransaction);
        setItem(KEYS.transactions, transactions);
        return newTransaction;
    };

    const updateTransaction = (id, updates) => {
        const transactions = getTransactions();
        const index = transactions.findIndex(t => t.id === id);
        if (index === -1) return null;
        transactions[index] = { ...transactions[index], ...updates };
        setItem(KEYS.transactions, transactions);
        return transactions[index];
    };

    const deleteTransaction = (id) => {
        const transactions = getTransactions();
        const filtered = transactions.filter(t => t.id !== id);
        setItem(KEYS.transactions, filtered);
        return filtered.length < transactions.length;
    };

    const getTransactionById = (id) => {
        const transactions = getTransactions();
        return transactions.find(t => t.id === id) || null;
    };

    const getTransactionsByMonth = (year, month) => {
        const transactions = getTransactions();
        return transactions.filter(t => {
            const date = new Date(t.date + 'T00:00:00');
            return date.getFullYear() === year && date.getMonth() === month;
        });
    };

    const getTransactionsByDateRange = (fromDate, toDate) => {
        const transactions = getTransactions();
        return transactions.filter(t => {
            return t.date >= fromDate && t.date <= toDate;
        });
    };

    // Budgets
    const getBudgets = () => {
        return getItem(KEYS.budgets, []);
    };

    const setBudget = (budget) => {
        const budgets = getBudgets();
        const index = budgets.findIndex(b => b.category === budget.category && b.month === budget.month);
        if (index >= 0) {
            budgets[index] = budget;
        } else {
            budgets.push(budget);
        }
        setItem(KEYS.budgets, budgets);
        return budget;
    };

    const setBudgets = (budgets) => {
        setItem(KEYS.budgets, budgets);
    };

    const getBudgetForCategory = (category, month) => {
        const budgets = getBudgets();
        return budgets.find(b => b.category === category && b.month === month) || null;
    };

    // Settings
    const getSettings = () => {
        return getItem(KEYS.settings, {
            theme: 'light'
        });
    };

    const saveSettings = (settings) => {
        setItem(KEYS.settings, settings);
        return settings;
    };

    // Export all data
    const exportAllData = () => {
        return {
            transactions: getTransactions(),
            budgets: getBudgets(),
            settings: getSettings(),
            exportedAt: new Date().toISOString(),
            appVersion: '1.1.0'
        };
    };

    // Import all data
    const importAllData = (data) => {
        if (data.transactions) setItem(KEYS.transactions, data.transactions);
        if (data.budgets) setItem(KEYS.budgets, data.budgets);
        if (data.settings) setItem(KEYS.settings, data.settings);
    };

    return {
        getTransactions,
        setTransactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        getTransactionById,
        getTransactionsByMonth,
        getTransactionsByDateRange,
        getBudgets,
        setBudget,
        setBudgets,
        getBudgetForCategory,
        getSettings,
        saveSettings,
        exportAllData,
        importAllData
    };
})();
