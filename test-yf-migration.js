var { fetchHistorical } = require('./src/utils/yahoofinance.js');

(async () => {
    try {
        const data = await fetchHistorical('BBCA', { limit: 5 });
        console.log("Success! Data for BBCA:", data);
        if (data.length > 0 && data[0].close) {
            console.log("Validation Passed");
        } else {
            console.log("Validation Failed: No data or invalid format");
        }
    } catch (e) {
        console.error("Error:", e);
    }
})();
