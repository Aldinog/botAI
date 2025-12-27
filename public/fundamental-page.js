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

    // Format Summary: Split into paragraphs for better readability
    const summary = data.profile.summary || 'N/A';
    const formattedSummary = summary.split('. ').map(s => s.trim()).reduce((acc, sent, idx) => {
        const lastPara = acc[acc.length - 1];
        if (!lastPara || lastPara.length > 300) {
            acc.push(sent + '.');
        } else {
            acc[acc.length - 1] += ' ' + sent + '.';
        }
        return acc;
    }, []).join('\n\n');

    document.getElementById('info-summary').innerText = formattedSummary;

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
    document.getElementById('own-count').innerText = fmtNum(data.holders.institutionsCount);

    // Quarterly Rendering
    renderQuarterly(data);

    // Advanced Data
    renderInsights(data);
    renderDividends(data);
}

/**
 * Render Quarterly Table & Mini Charts
 */
function renderQuarterly(data) {
    const fmtCap = (val) => {
        if (val == null) return '-';
        if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
        if (val >= 1e9) return (val / 1e9).toFixed(2) + ' M';
        return val.toLocaleString();
    };

    const qBody = document.getElementById('quarterly-body');
    if (!qBody) return;

    qBody.innerHTML = '';
    if (data.quarterly && data.quarterly.length > 0) {
        // Find max revenue for scaling bars
        const maxRev = Math.max(...data.quarterly.map(q => q.revenue || 0));

        data.quarterly.forEach(q => {
            const tr = document.createElement('tr');
            const revPct = maxRev > 0 ? (q.revenue / maxRev * 100) : 0;

            tr.innerHTML = `
                <td class="label-col">
                    <div style="color: var(--accent-primary); font-weight: 700;">${q.date || q.fiscalQuarter}</div>
                    <div class="bar-container" style="height: 6px; margin-top: 4px; background: rgba(255,255,255,0.05);">
                        <div class="bar-fill" style="width: ${revPct}%;"></div>
                    </div>
                </td>
                <td class="value-col">${fmtCap(q.revenue)}</td>
                <td class="value-col" style="color: ${q.earnings >= 0 ? 'var(--positive)' : 'var(--negative)'}">${fmtCap(q.earnings)}</td>
            `;
            qBody.appendChild(tr);
        });
    } else {
        qBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; opacity: 0.5;">Data kuartalan tidak tersedia.</td></tr>';
    }
}

/**
 * Render INSIGHTS Tab
 */
function renderInsights(data) {
    const fmtCap = (val) => {
        if (val == null) return '-';
        if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
        if (val >= 1e9) return (val / 1e9).toFixed(2) + ' M';
        return val.toLocaleString();
    };

    // Health Radar Badges
    const radar = document.getElementById('health-radar');
    if (radar) {
        radar.innerHTML = '';
        const badges = [];

        // Logic for badges
        if (data.valuation.pbRatio < 1) badges.push({ text: 'Undervalued', icon: 'fa-gem', type: 'positive' });
        if (data.growth.earningsGrowth > 0.15) badges.push({ text: 'High Growth', icon: 'fa-rocket', type: 'positive' });
        if (data.profitability.roe > 0.15) badges.push({ text: 'Efficient', icon: 'fa-bolt', type: 'positive' });
        if (data.cashflow.totalCash > data.cashflow.totalDebt) badges.push({ text: 'Cash Rich', icon: 'fa-piggy-bank', type: 'positive' });
        if (data.valuation.peRatio > 25) badges.push({ text: 'Expensive', icon: 'fa-tag', type: 'warning' });
        if (data.cashflow.currentRatio < 1) badges.push({ text: 'Low Liquidity', icon: 'fa-droplet-slash', type: 'danger' });

        badges.forEach(b => {
            const el = document.createElement('div');
            el.className = `badge badge-${b.type}`;
            el.innerHTML = `<i class="fa-solid ${b.icon}"></i> ${b.text}`;
            radar.appendChild(el);
        });

        if (badges.length === 0) radar.innerHTML = '<span style="opacity: 0.5; font-size: 0.8rem;">No significant health signals.</span>';
    }

    // Analyst Data
    document.getElementById('ins-rec').innerText = (data.target.rec || '-').toUpperCase();
    document.getElementById('ins-target').innerText = data.target.mean ? data.currency + ' ' + data.target.mean.toLocaleString('id-ID') : '-';

    const consensus = data.target.consensus;
    document.getElementById('ins-consensus').innerText = consensus ?
        `Buy: ${consensus.buy}, Hold: ${consensus.hold}, Sell: ${consensus.sell}` : '-';

    // News
    const newsCont = document.getElementById('news-container');
    if (newsCont) {
        newsCont.innerHTML = '';
        if (data.news && data.news.length > 0) {
            data.news.forEach(n => {
                const item = document.createElement('a');
                item.href = n.link;
                item.target = '_blank';
                item.className = 'news-item';
                const date = new Date(n.providerPublishTime * 1000).toLocaleDateString('id-ID');

                item.innerHTML = `
                    <div class="news-title">${n.title}</div>
                    <div class="news-meta">
                        <span><i class="fa-solid fa-building"></i> ${n.publisher}</span>
                        <span><i class="fa-solid fa-calendar"></i> ${date}</span>
                    </div>
                `;
                newsCont.appendChild(item);
            });
        } else {
            newsCont.innerHTML = '<div style="opacity: 0.5; font-size: 0.8rem;">Tidak ada berita terbaru ditemukan.</div>';
        }
    }
}

/**
 * Render Dividends
 */
function renderDividends(data) {
    const fmtPct = (num) => num != null ? (num * 100).toFixed(2) + '%' : '-';

    if (data.dividends) {
        document.getElementById('div-yield').innerText = fmtPct(data.dividends.yield);
        document.getElementById('div-rate').innerText = data.dividends.rate ? data.currency + ' ' + data.dividends.rate : '-';
        document.getElementById('div-payout').innerText = fmtPct(data.dividends.payoutRatio);

        if (data.dividends.exDate) {
            const date = new Date(data.dividends.exDate * 1000).toLocaleDateString('id-ID');
            document.getElementById('div-exdate').innerText = date;
        } else {
            document.getElementById('div-exdate').innerText = '-';
        }
    }
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
