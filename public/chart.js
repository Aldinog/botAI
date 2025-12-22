// Debug log function defined FIRST to catch init errors
function logDebug(msg) {
    let debugDiv = document.getElementById('debug-overlay');
    if (!debugDiv) {
        debugDiv = document.createElement('div');
        debugDiv.id = 'debug-overlay';
        debugDiv.style.cssText = 'position:absolute;bottom:50px;left:10px;background:rgba(0,0,0,0.8);color:#0f0;font-size:12px;padding:8px;pointer-events:none;z-index:9999;max-width:90%;word-wrap:break-word;';
        document.body.appendChild(debugDiv);
    }
    // detailed log with timestamp
    const time = new Date().toISOString().split('T')[1].split('.')[0];
    debugDiv.innerHTML += `[${time}] ${msg}<br>`;
    console.log(`[DEBUG] ${msg}`);
}

// Global Variables
let chart, candlestickSeries;

// Get URL Params
const urlParams = new URLSearchParams(window.location.search);
const symbol = urlParams.get('symbol') || 'BBCA';
document.getElementById('chart-title').innerText = symbol;

// Initialization
try {
    logDebug('Initializing Chart...');

    if (typeof LightweightCharts === 'undefined') {
        throw new Error('LightweightCharts Library NOT loaded. CDN blocked?');
    }

    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) throw new Error('Chart Container (#chart-container) not found');

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

    logDebug('Chart Initialized Successfully');

    // Controls Logic
    const btns = document.querySelectorAll('.time-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadData(btn.dataset.interval);
        });
    });

    // Start Data Load
    loadData('1d');

} catch (e) {
    logDebug(`CRITICAL ERROR: ${e.message}`);
    alert(`Chart Error: ${e.message}`);
}


// Load Data Function
async function loadData(interval) {
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = 'flex';
    if (candlestickSeries) {
        candlestickSeries.setData([]);
        candlestickSeries.setMarkers([]);
    }

    const token = localStorage.getItem('aston_session_token');
    logDebug(`Fetching data for ${symbol} (${interval})...`);

    try {
        const response = await fetch('/api/web', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'chart',
                symbol: symbol,
                interval: interval
            })
        });

        logDebug(`Fetch status: ${response.status}`);
        const res = await response.json();
        logDebug(`Response success: ${res.success}`);

        if (res.success && res.data) {
            const { candles, markers } = res.data;

            document.getElementById('chart-title').innerText = `${symbol} (${candles.length})`;
            logDebug(`Candles: ${candles.length}`);

            if (candles.length === 0) {
                spinner.innerHTML = '<span style="color:red">No Data (API Error)</span>';
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
                    const tA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
                    const tB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
                    return tA - tB;
                });
                candlestickSeries.setMarkers(validMarkers);
            }

            if (chart) chart.timeScale().fitContent();
        } else {
            logDebug(`API Error: ${res.error || 'Unknown'}`);
            alert('Failed to load chart data');
        }

    } catch (err) {
        logDebug(`Network Error: ${err.message}`);
        alert('Error loading data');
    } finally {
        spinner.style.display = 'none';
    }
}
