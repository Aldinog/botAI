// Global Variables
let chart, candlestickSeries;
let currentMode = 'analysis'; // 'analysis' or 'clear'
let autoSeries = []; // Store S/R and Trendline series for easy clearing
let lastMarkers = []; // Cache markers for toggling
let manualSeriesRef = [];
let lastResponseData = null;
let crosshairPosition = null;

// Get URL Params
const urlParams = new URLSearchParams(window.location.search);
let currentSymbol = urlParams.get('symbol') || 'BBCA';
const tickerInput = document.getElementById('ticker-switch');
if (tickerInput) tickerInput.value = currentSymbol;

// Initialization
try {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) throw new Error('Chart Container not found');

    chart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { type: 'solid', color: '#0f172a' },
            textColor: '#94a3b8',
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
    });

    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
    });

    // Resize Handler
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                if (chart) {
                    chart.resize(entry.contentRect.width, entry.contentRect.height);
                    chart.timeScale().fitContent();
                }
            }
        }
    });
    resizeObserver.observe(chartContainer);

    // Controls Logic
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadData(btn.dataset.interval);
        });
    });

    // Mode Toggle Logic
    const btnAuto = document.getElementById('btn-auto');
    const btnClear = document.getElementById('btn-clear');

    btnAuto.addEventListener('click', () => {
        currentMode = 'analysis';
        btnAuto.classList.add('active');
        btnClear.classList.remove('active');
        renderAutoFeatures(lastResponseData);
        if (candlestickSeries && lastMarkers) {
            candlestickSeries.setMarkers(lastMarkers);
        }
    });

    btnClear.addEventListener('click', () => {
        currentMode = 'clear';
        btnClear.classList.add('active');
        btnAuto.classList.remove('active');
        clearAutoFeatures();
        // Markers stay visible in Clear mode as requested
    });

    // Start Data Load
    loadData('1d');

    // Ticker Switch Logic
    if (tickerInput) {
        tickerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                switchSymbol(tickerInput.value);
                tickerInput.blur();
            }
        });

        // Auto-select text on click for faster typing
        tickerInput.addEventListener('click', () => {
            tickerInput.select();
        });

        tickerInput.value = currentSymbol;
    }

} catch (e) {
    console.error(e);
}

/**
 * Helper to convert Lightweight Charts time to numerical timestamp
 */
function toTimestamp(time) {
    if (typeof time === 'number') return time;
    if (typeof time === 'string') return new Date(time).getTime() / 1000;
    if (time && time.year) return new Date(time.year, time.month - 1, time.day).getTime() / 1000;
    return 0;
}


// Global so we can re-render on mode switch
// (declared at top)

async function switchSymbol(newSymbol) {
    if (!newSymbol) return;
    const cleanSymbol = newSymbol.toUpperCase().trim();
    if (cleanSymbol === currentSymbol) return;

    console.log(`[SWITCH] Switching from ${currentSymbol} to ${cleanSymbol}`);
    currentSymbol = cleanSymbol;
    const tickerInput = document.getElementById('ticker-switch');
    if (tickerInput) tickerInput.value = currentSymbol;

    // Reset company name to loading
    const companyTitle = document.getElementById('company-title');
    if (companyTitle) companyTitle.innerText = 'Loading...';

    // Clear existing data and features immediately for better UX
    if (candlestickSeries) candlestickSeries.setData([]);
    clearAutoFeatures();

    // Trigger data load
    await loadData('1d');

    // Update URL without refresh (optional, good for bookmarking)
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('symbol', currentSymbol);
    window.history.pushState({}, '', newUrl);
}

// Load Data Function
async function loadData(interval) {
    const spinner = document.getElementById('loading-spinner');
    const spinnerText = spinner.querySelector('span');
    if (spinnerText) spinnerText.innerText = 'Fetching Market Data...';

    spinner.style.display = 'flex';
    spinner.style.opacity = '1';

    if (candlestickSeries) {
        // Don't clear data/markers yet for blurred background effect
        // candlestickSeries.setData([]); 
        // candlestickSeries.setMarkers([]);
    }
    clearAutoFeatures();

    const token = localStorage.getItem('aston_session_token');

    try {
        const response = await fetch('/api/web', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'chart',
                symbol: currentSymbol,
                interval: interval
            })
        });

        const res = await response.json();

        if (res.success && res.data) {
            lastResponseData = res.data;
            if (spinnerText) spinnerText.innerText = 'Generating Signals...';
            const { candles, markers, levels, trendlines, companyName } = res.data;

            const tickerInput = document.getElementById('ticker-switch');
            if (tickerInput) tickerInput.value = currentSymbol;

            const companyTitle = document.getElementById('company-title');
            if (companyTitle) companyTitle.innerText = companyName || currentSymbol;

            if (candles.length === 0) {
                if (spinnerText) spinnerText.innerText = 'No Data Found';
                return;
            }

            // Validating Data
            const uniqueCandles = [];
            const times = new Set();

            const sorted = candles.sort((a, b) => {
                const tA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
                const tB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
                return tA - tB;
            });

            sorted.forEach(c => {
                if (!times.has(c.time)) {
                    times.add(c.time);
                    uniqueCandles.push(c);
                }
            });

            if (candlestickSeries) {
                candlestickSeries.setData(uniqueCandles);

                const validMarkers = (markers || []).filter(m => times.has(m.time)).sort((a, b) => {
                    const tA = toTimestamp(a.time);
                    const tB = toTimestamp(b.time);
                    return tA - tB;
                });
                lastMarkers = validMarkers;

                if (candlestickSeries) {
                    candlestickSeries.setMarkers(validMarkers);
                }
            }

            if (currentMode === 'analysis') {
                renderAutoFeatures(res.data);
            } else {
                clearAutoFeatures();
            }

            if (chart) chart.timeScale().fitContent();
        } else {
            if (spinnerText) spinnerText.innerText = 'API Error';
            console.error(res.error);
        }

    } catch (err) {
        if (spinnerText) spinnerText.innerText = 'Network Error';
        console.error(err);
    } finally {
        spinner.style.opacity = '0';
        setTimeout(() => {
            spinner.style.display = 'none';
        }, 300);
    }
}

/**
 * AUTO MODE RENDERING
 */
function renderAutoFeatures(data) {
    if (!data) return;
    clearAutoFeatures();

    const { levels, trendlines } = data;

    // Render S/R Levels
    if (levels) {
        levels.forEach(level => {
            const priceLine = candlestickSeries.createPriceLine({
                price: level.price,
                color: level.type === 'support' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: level.type.toUpperCase(),
            });
            autoSeries.push({ type: 'priceLine', ref: priceLine });
        });
    }

    // Render Trendlines
    if (trendlines) {
        trendlines.forEach(line => {
            const series = chart.addLineSeries({
                color: line.type === 'support' ? '#22c55e' : '#ef4444',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            series.setData([
                { time: line.p1.time, value: line.p1.price },
                { time: line.p2.time, value: line.p2.price }
            ]);
            autoSeries.push({ type: 'series', ref: series });
        });
    }
}

function clearAutoFeatures() {
    autoSeries.forEach(item => {
        if (item.type === 'priceLine') {
            candlestickSeries.removePriceLine(item.ref);
        } else if (item.type === 'series') {
            chart.removeSeries(item.ref);
        }
    });
    autoSeries = [];
}

function clearManualFromChart() {
    manualSeriesRef.forEach(item => {
        if (item.type === 'priceLine') {
            candlestickSeries.removePriceLine(item.ref);
        } else if (item.type === 'series') {
            chart.removeSeries(item.ref);
        }
    });
    manualSeriesRef = [];
}
