// Global Variables
let chart, candlestickSeries;
let currentMode = 'auto'; // 'auto' or 'manual'
let autoSeries = []; // Store S/R and Trendline series for easy clearing
let manualDrawings = JSON.parse(localStorage.getItem('manual_drawings') || '[]');
let activeTool = null;
let selectedDrawingIndex = null;
let drawingPoints = [];
let tempSeries = null; // Preview series while drawing
let crosshairPosition = null;

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
    const btnManual = document.getElementById('btn-manual');
    const drawingToolbar = document.getElementById('manual-toolbar');

    btnAuto.addEventListener('click', () => {
        currentMode = 'auto';
        btnAuto.classList.add('active');
        btnManual.classList.remove('active');
        drawingToolbar.style.display = 'none';
        clearManualFromChart();
        renderAutoFeatures(lastResponseData);
    });

    btnManual.addEventListener('click', () => {
        currentMode = 'manual';
        btnManual.classList.add('active');
        btnAuto.classList.remove('active');
        drawingToolbar.style.display = 'flex';
        clearAutoFeatures();
        renderManualDrawings();
    });

    // Drawing Tool Handlers
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.id === 'tool-eraser') {
                if (selectedDrawingIndex !== null) {
                    manualDrawings.splice(selectedDrawingIndex, 1);
                    selectedDrawingIndex = null;
                } else if (confirm('Delete all drawings?')) {
                    manualDrawings = [];
                }
                saveManualDrawings();
                renderManualDrawings();
                return;
            }

            toolBtns.forEach(b => b.classList.remove('active'));
            selectedDrawingIndex = null;
            renderManualDrawings();

            if (activeTool === btn.id.replace('tool-', '')) {
                activeTool = null;
                document.getElementById('touch-controls').style.display = 'none';
            } else {
                activeTool = btn.id.replace('tool-', '');
                btn.classList.add('active');
                document.getElementById('touch-controls').style.display = 'flex';
                drawingPoints = [];
            }
        });
    });

    // Confirmation logic for drawing
    document.getElementById('draw-confirm').addEventListener('click', () => {
        if (!activeTool || !crosshairPosition) return;

        drawingPoints.push({ ...crosshairPosition });

        handleDrawingStep();
    });

    document.getElementById('draw-cancel').addEventListener('click', () => {
        cancelDrawing();
    });

    /**
     * Helper to convert Lightweight Charts time to numerical timestamp
     */
    function toTimestamp(time) {
        if (typeof time === 'number') return time;
        if (typeof time === 'string') return new Date(time).getTime() / 1000;
        if (time && time.year) return new Date(time.year, time.month - 1, time.day).getTime() / 1000;
        return 0;
    }

    // Crosshair Tracker
    chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.time) return;

        const price = candlestickSeries.coordinateToPrice(param.point.y);
        crosshairPosition = { time: param.time, price: price };

        if (activeTool && drawingPoints.length > 0) {
            updateDrawingPreview();
        }
    });

    // Selection Logic on Click
    chart.subscribeClick((param) => {
        if (activeTool) return;

        if (!param.point || !param.time) {
            selectedDrawingIndex = null;
            renderManualDrawings();
            return;
        }

        const price = candlestickSeries.coordinateToPrice(param.point.y);
        const clickTime = toTimestamp(param.time);

        // Find nearest drawing
        let foundIndex = null;
        manualDrawings.forEach((draw, index) => {
            const tolerance = price * 0.05; // 5% tolerance for touch

            if (draw.type === 'horizontal') {
                const diff = Math.abs(draw.price - price);
                if (diff < tolerance) foundIndex = index;
            } else if (draw.type === 'trendline') {
                const t1 = toTimestamp(draw.p1.time);
                const t2 = toTimestamp(draw.p2.time);

                // Use a wider time buffer for selection
                const margin = 3600 * 24; // 1 day buffer
                if (clickTime >= Math.min(t1, t2) - margin && clickTime <= Math.max(t1, t2) + margin) {
                    const ratio = (clickTime - t1) / (t2 - t1 || 1);
                    const linePrice = draw.p1.price + (draw.p2.price - draw.p1.price) * ratio;
                    if (Math.abs(linePrice - price) < tolerance) foundIndex = index;
                }
            } else if (draw.type === 'rectangle') {
                const t1 = toTimestamp(draw.p1.time);
                const t2 = toTimestamp(draw.p2.time);

                const inPrice = price >= Math.min(draw.p1.price, draw.p2.price) - tolerance &&
                    price <= Math.max(draw.p1.price, draw.p2.price) + tolerance;
                const inTime = clickTime >= Math.min(t1, t2) && clickTime <= Math.max(t1, t2);

                if (inPrice && inTime) foundIndex = index;
            }
        });

        selectedDrawingIndex = foundIndex;
        renderManualDrawings();
    });

    // Start Data Load
    loadData('1d');

} catch (e) {
    console.error(e);
}


// Global so we can re-render on mode switch
let lastResponseData = null;

// Load Data Function
async function loadData(interval) {
    const spinner = document.getElementById('loading-spinner');
    const spinnerText = spinner.querySelector('span');
    if (spinnerText) spinnerText.innerText = 'Fetching Market Data...';

    spinner.style.display = 'flex';
    spinner.style.opacity = '1';

    if (candlestickSeries) {
        candlestickSeries.setData([]);
        candlestickSeries.setMarkers([]);
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
                    const tA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
                    const tB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
                    return tA - tB;
                });
                candlestickSeries.setMarkers(validMarkers);
            }

            if (currentMode === 'auto') {
                renderAutoFeatures(res.data);
            } else {
                renderManualDrawings();
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

/**
 * MANUAL MODE LOGIC
 */
let manualSeriesRef = [];

function renderManualDrawings() {
    clearManualFromChart();

    manualDrawings.forEach((draw, index) => {
        const isSelected = index === selectedDrawingIndex;
        const color = isSelected ? '#ef4444' : '#6366f1';
        const width = isSelected ? 3 : 2;

        if (draw.type === 'horizontal') {
            const line = candlestickSeries.createPriceLine({
                price: draw.price,
                color: color,
                lineWidth: width,
                lineStyle: LightweightCharts.LineStyle.Solid,
                axisLabelVisible: true,
                title: isSelected ? 'SELECTED' : 'MANUAL',
            });
            manualSeriesRef.push({ type: 'priceLine', ref: line });
        } else if (draw.type === 'trendline') {
            const series = chart.addLineSeries({
                color: color,
                lineWidth: width,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            series.setData([
                { time: draw.p1.time, value: draw.p1.price },
                { time: draw.p2.time, value: draw.p2.price }
            ]);
            manualSeriesRef.push({ type: 'series', ref: series });
        } else if (draw.type === 'rectangle') {
            const series = chart.addLineSeries({
                color: color,
                lineWidth: width,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            series.setData([
                { time: draw.p1.time, value: draw.p1.price },
                { time: draw.p2.time, value: draw.p1.price },
                { time: draw.p2.time, value: draw.p2.price },
                { time: draw.p1.time, value: draw.p2.price },
                { time: draw.p1.time, value: draw.p1.price }
            ]);
            manualSeriesRef.push({ type: 'series', ref: series });
        }
    });
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

function saveManualDrawings() {
    localStorage.setItem('manual_drawings', JSON.stringify(manualDrawings));
}

function cancelDrawing() {
    activeTool = null;
    drawingPoints = [];
    if (tempSeries) {
        chart.removeSeries(tempSeries);
        tempSeries = null;
    }
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('touch-controls').style.display = 'none';
}

function handleDrawingStep() {
    if (activeTool === 'horizontal') {
        manualDrawings.push({
            type: 'horizontal',
            price: drawingPoints[0].price
        });
        finishDrawing();
    } else if (activeTool === 'trendline' || activeTool === 'rectangle') {
        if (drawingPoints.length === 2) {
            manualDrawings.push({
                type: activeTool,
                p1: drawingPoints[0],
                p2: drawingPoints[1]
            });
            finishDrawing();
        }
    }
}

function updateDrawingPreview() {
    if (!activeTool || drawingPoints.length === 0 || !crosshairPosition) return;

    if (tempSeries) {
        chart.removeSeries(tempSeries);
        tempSeries = null;
    }

    tempSeries = chart.addLineSeries({
        color: 'rgba(99, 102, 241, 0.5)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        lastValueVisible: false,
        priceLineVisible: false,
    });

    if (activeTool === 'trendline') {
        tempSeries.setData([
            { time: drawingPoints[0].time, value: drawingPoints[0].price },
            { time: crosshairPosition.time, value: crosshairPosition.price }
        ]);
    } else if (activeTool === 'rectangle') {
        tempSeries.setData([
            { time: drawingPoints[0].time, value: drawingPoints[0].price },
            { time: crosshairPosition.time, value: drawingPoints[0].price },
            { time: crosshairPosition.time, value: crosshairPosition.price },
            { time: drawingPoints[0].time, value: crosshairPosition.price },
            { time: drawingPoints[0].time, value: drawingPoints[0].price }
        ]);
    }
}

function finishDrawing() {
    saveManualDrawings();
    renderManualDrawings();
    cancelDrawing();
}
