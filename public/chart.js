// Get URL Params
const urlParams = new URLSearchParams(window.location.search);
const symbol = urlParams.get('symbol') || 'BBCA';
document.getElementById('chart-title').innerText = symbol + ' Chart';

// Initialize Chart
const chartContainer = document.getElementById('chart-container');
const chart = LightweightCharts.createChart(chartContainer, {
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

const candlestickSeries = chart.addCandlestickSeries({
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderVisible: false,
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
});

// Resize Handler
window.addEventListener('resize', () => {
    chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
});

// Load Data Function
async function loadData(interval) {
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = 'flex';
    candlestickSeries.setData([]); // Clear prev data
    candlestickSeries.setMarkers([]);

    // Get Token (Shared with main app via LocalStorage)
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

            // Validate and Sort unique (Lightweight charts strict requirement)
            const uniqueCandles = [];
            const times = new Set();

            // Backend sends oldest -> newest usually, but we ensure sort
            // Note: time can be string YYYY-MM-DD or number (seconds)
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

            candlestickSeries.setData(uniqueCandles);

            // Filter markers: Only valid if time exists in candles
            const validMarkers = (markers || []).filter(m => times.has(m.time)).sort((a, b) => {
                const tA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
                const tB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
                return tA - tB;
            });
            candlestickSeries.setMarkers(validMarkers);

            // Adjust timeframe visibility based on interval
            chart.timeScale().fitContent();
        } else {
            alert('Failed to load chart data');
        }

    } catch (err) {
        console.error(err);
        alert('Error loading data');
    } finally {
        spinner.style.display = 'none';
    }
}

// Controls Logic
const btns = document.querySelectorAll('.time-btn');
btns.forEach(btn => {
    btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadData(btn.dataset.interval);
    });
});

// Initial Load
loadData('1d');
