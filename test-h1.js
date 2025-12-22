const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

(async () => {
    console.log('Testing H1 fetch via CHART endpoint with period1...');
    try {
        const period1 = new Date();
        period1.setDate(period1.getDate() - 30); // 30 days ago

        // period1 is required by schema for ChartOptions
        const result = await yahooFinance.chart('BBCA.JK', {
            period1: period1,
            interval: '60m' // trying 60m just in case, but 1h is in enum too
        });

        console.log(`Success! Fetched ${result.quotes ? result.quotes.length : 0} candles.`);
        if (result.quotes && result.quotes.length > 0) {
            console.log('Sample:', result.quotes[0]);
        }
    } catch (err) {
        console.error('H1 Fetch Error:', err);
        // Print full error JSON if possible
        if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
    }
})();
