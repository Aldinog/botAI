// Global Variables
let chart, candlestickSeries;

// Get URL Params
const urlParams = new URLSearchParams(window.location.search);
const symbol = urlParams.get('symbol') || 'BBCA';
document.getElementById('chart-title').innerText = symbol;

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
    console.error(e);
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

        const res = await response.json();

        if (res.success && res.data) {
            const { candles, markers } = res.data;

            document.getElementById('chart-title').innerText = `${symbol}`;

            if (candles.length === 0) {
                spinner.innerHTML = '<span style="color:red">No Data</span>';
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
            console.error(res.error);
        }

    } catch (err) {
        console.error(err);
    } finally {
        spinner.style.display = 'none';
        // Clear error text if it was there and simple spinner hide
        if (spinner.innerHTML.includes('No Data')) {
            // keep it
        } else {
            spinner.innerHTML = '<div class="spinner-icon"></div>'; // Reset spinner HTML if needed or just hide
        }
    }
}
