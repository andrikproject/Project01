const DataModule = (() => {
    const expenseCategories = [
        { id: 'makanan', name: 'Makanan & Minuman', icon: 'fa-utensils' },
        { id: 'transportasi', name: 'Transportasi', icon: 'fa-car' },
        { id: 'belanja', name: 'Belanja', icon: 'fa-bag-shopping' },
        { id: 'tagihan', name: 'Tagihan & Utilitas', icon: 'fa-file-invoice' },
        { id: 'hiburan', name: 'Hiburan', icon: 'fa-film' },
        { id: 'kesehatan', name: 'Kesehatan', icon: 'fa-heart-pulse' },
        { id: 'pendidikan', name: 'Pendidikan', icon: 'fa-graduation-cap' },
        { id: 'investasi', name: 'Investasi', icon: 'fa-chart-line' },
        { id: 'lainnya', name: 'Lainnya', icon: 'fa-ellipsis' }
    ];

    const incomeCategories = [
        { id: 'gaji', name: 'Gaji', icon: 'fa-briefcase' },
        { id: 'freelance', name: 'Freelance', icon: 'fa-laptop' },
        { id: 'bisnis', name: 'Bisnis', icon: 'fa-store' },
        { id: 'investasi_income', name: 'Investasi', icon: 'fa-chart-line' },
        { id: 'hadiah', name: 'Hadiah', icon: 'fa-gift' },
        { id: 'lainnya_income', name: 'Lainnya', icon: 'fa-ellipsis' }
    ];

    const getCategories = (type) => {
        return type === 'income' ? incomeCategories : expenseCategories;
    };

    const getCategoryByName = (name, type) => {
        const categories = getCategories(type);
        return categories.find(c => c.name === name) || null;
    };

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const formatCurrency = (amount) => {
        const formatted = Math.abs(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `Rp ${formatted}`;
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    };

    const formatDateShort = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const day = date.getDate();
        const month = months[date.getMonth()].substring(0, 3);
        return `${day} ${month}`;
    };

    return {
        expenseCategories,
        incomeCategories,
        getCategories,
        getCategoryByName,
        months,
        formatCurrency,
        formatDate,
        formatDateShort
    };
})();
