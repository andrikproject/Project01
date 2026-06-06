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

    return {
        getTransactions,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        getTransactionById,
        getTransactionsByMonth,
        getBudgets,
        setBudget,
        getSettings,
        saveSettings
    };
})();
