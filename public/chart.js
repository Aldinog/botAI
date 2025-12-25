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
const symbol = urlParams.get('symbol') || 'BBCA';
document.getElementById('chart-title').innerText = symbol;

// --- Christmas Theme Logic ---
const activeTheme = localStorage.getItem('active_theme');
if (activeTheme === 'christmas') {
    document.body.classList.add('theme-christmas');
    const tree = document.getElementById('christmas-tree');
    if (tree) tree.classList.remove('hidden');
    const text = document.getElementById('christmas-text');
    if (text) text.classList.remove('hidden');
} else if (activeTheme === 'newyear') {
    document.body.classList.add('theme-newyear');
    // We can reuse initFireworks from script.js if it's imported, 
    // BUT usually chart.js is separate. We need to duplicate or expose initFireworks.
    // Given the structure, likely need to copy logic or make it global. 
    // For now, let's assume we copy the logic or keep it simple if script.js isn't loaded here.
    // Based on file list, chart.html loads chart.js. Does it load script.js? 
    // Reviewing chart.html in previous steps: only chart.js is loaded at the bottom.
    // So we MUST duplicate initFireworks here or create a shared 'theme.js'.
    // Decision: Duplicate for now to keep it isolated and quick.
    initFireworks();
    const text = document.getElementById('newyear-text');
    if (text) text.classList.remove('hidden');
}

let fireworksInterval;
let animationFrameId;

function initFireworks() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    let particles = [];
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f', '#fff', '#FFA500'];

    function createParticle(x, y) {
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: x,
                y: y,
                color: colors[Math.floor(Math.random() * colors.length)],
                radius: Math.random() * 3 + 1,
                velocity: {
                    x: (Math.random() - 0.5) * 6,
                    y: (Math.random() - 0.5) * 6
                },
                alpha: 1,
                decay: Math.random() * 0.015 + 0.01
            });
        }
    }

    function loop() {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        particles.forEach((p, index) => {
            if (p.alpha <= 0) {
                particles.splice(index, 1);
            } else {
                p.velocity.y += 0.05;
                p.x += p.velocity.x;
                p.y += p.velocity.y;
                p.alpha -= p.decay;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
            }
        });
        animationFrameId = requestAnimationFrame(loop);
    }

    loop();

    fireworksInterval = setInterval(() => {
        createParticle(Math.random() * canvas.width, Math.random() * canvas.height / 2);
    }, 800);
}

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
                symbol: symbol,
                interval: interval
            })
        });

        const res = await response.json();

        if (res.success && res.data) {
            lastResponseData = res.data;
            if (spinnerText) spinnerText.innerText = 'Generating Signals...';
            const { candles, markers, levels, trendlines } = res.data;

            document.getElementById('chart-title').innerText = `${symbol}`;

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
