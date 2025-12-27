/**
 * Fundamental Page Logic
 */

const tg = window.Telegram?.WebApp;
const API_URL = '/api/web';

// DOM Elements
const symbolSearch = document.getElementById('symbol-search');
const displaySymbol = document.getElementById('display-symbol');
const displayName = document.getElementById('display-name');
const displayPrice = document.getElementById('display-price');
const displayCurrency = document.getElementById('display-currency');

// Tab Logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Update Buttons
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update Content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) content.classList.add('active');
        });

        if (tg) tg.HapticFeedback.impactOccurred('light');
    });
});

/**
 * Fetch Fundamental Data
 */
async function loadFundamentalData(symbol) {
    if (!symbol) return;

    // Set Loading State
    displayName.innerText = "Mengambil data...";
    displaySymbol.innerText = symbol.toUpperCase();

    try {
        const token = localStorage.getItem('aston_session_token');
        if (!token) {
            alert("Sesi berakhir, silakan buka ulang aplikasi.");
            return;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'fundamental', symbol })
        });

        const result = await response.json();
        if (result.success && result.data) {
            renderData(result.data);

            // Sync theme if provided
            if (result.active_theme && window.themeEngine) {
                window.themeEngine.applyTheme(result.active_theme);
            }
        } else {
            displayName.innerText = "Data tidak ditemukan.";
            if (tg) tg.HapticFeedback.notificationOccurred('error');
        }
    } catch (error) {
        console.error("Load Error:", error);
        displayName.innerText = "Gagal memuat data.";
    }
}

/**
 * Format & Render Data to UI
 */
function renderData(data) {
    const fmtNum = (num) => num != null ? num.toLocaleString('id-ID') : '-';
    const fmtPct = (num) => num != null ? (num * 100).toFixed(2) + '%' : '-';
    const fmtCap = (val) => {
        if (val == null) return '-';
        if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
        if (val >= 1e9) return (val / 1e9).toFixed(2) + ' M';
        return val.toLocaleString();
    };

    // Header
    displaySymbol.innerText = data.symbol.replace('.JK', '');
    displayName.innerText = data.name;
    displayPrice.innerText = fmtNum(data.price);
    displayCurrency.innerText = data.currency || 'IDR';

    // Profile Tab
    document.getElementById('info-sector').innerText = data.profile.sector || '-';
    document.getElementById('info-industry').innerText = data.profile.industry || '-';
    document.getElementById('info-employees').innerText = data.profile.employees ? data.profile.employees.toLocaleString() : '-';
    document.getElementById('info-website').innerText = data.profile.website || '-';
    document.getElementById('info-summary').innerText = data.profile.summary || 'N/A';

    // Valuation Tab
    document.getElementById('val-mkt-cap').innerText = fmtCap(data.valuation.marketCap);
    document.getElementById('val-pe').innerText = data.valuation.peRatio ? data.valuation.peRatio.toFixed(2) + 'x' : '-';
    document.getElementById('val-fpe').innerText = data.valuation.forwardPE ? data.valuation.forwardPE.toFixed(2) + 'x' : '-';
    document.getElementById('val-peg').innerText = data.valuation.pegRatio ? data.valuation.pegRatio.toFixed(2) : '-';
    document.getElementById('val-pbv').innerText = data.valuation.pbRatio ? data.valuation.pbRatio.toFixed(2) + 'x' : '-';
    document.getElementById('val-ev').innerText = fmtCap(data.valuation.enterpriceValue);

    // Growth & Profitability
    document.getElementById('gro-rev').innerHTML = colorizeGrowth(data.growth.revenueGrowth);
    document.getElementById('gro-ear').innerHTML = colorizeGrowth(data.growth.earningsGrowth);

    document.getElementById('pro-roe').innerText = fmtPct(data.profitability.roe);
    document.getElementById('pro-roa').innerText = fmtPct(data.profitability.roa);
    document.getElementById('pro-gross').innerText = fmtPct(data.profitability.grossMargin);
    document.getElementById('pro-op').innerText = fmtPct(data.profitability.operatingMargin);
    document.getElementById('pro-net').innerText = fmtPct(data.profitability.profitMargin);

    // CashFlow
    document.getElementById('cf-op').innerText = fmtCap(data.cashflow.operatingCashflow);
    document.getElementById('cf-free').innerText = fmtCap(data.cashflow.freeCashflow);
    document.getElementById('cf-cash').innerText = fmtCap(data.cashflow.totalCash);
    document.getElementById('cf-debt').innerText = fmtCap(data.cashflow.totalDebt);
    document.getElementById('cf-quick').innerText = data.cashflow.quickRatio ? data.cashflow.quickRatio.toFixed(2) : '-';
    document.getElementById('cf-current').innerText = data.cashflow.currentRatio ? data.cashflow.currentRatio.toFixed(2) : '-';

    // Ownership
    document.getElementById('own-insider').innerText = fmtPct(data.holders.insiderHoldersPercent);
    document.getElementById('own-inst').innerText = fmtPct(data.holders.institutionsHoldersPercent);
}

function colorizeGrowth(val) {
    if (val == null) return '-';
    const num = (val * 100).toFixed(2);
    const colorClass = val >= 0 ? 'tag-positive' : 'tag-negative';
    const icon = val >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    return `<span class="tag ${colorClass}"><i class="fa-solid ${icon}"></i> ${num}%</span>`;
}

// Search Handler
symbolSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const sym = symbolSearch.value.trim();
        if (sym) {
            loadFundamentalData(sym);
            symbolSearch.blur();
            if (tg) tg.HapticFeedback.impactOccurred('medium');
        }
    }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'BBCA';
    loadFundamentalData(symbol);

    if (tg) {
        tg.expand();
        tg.ready();
    }
});
