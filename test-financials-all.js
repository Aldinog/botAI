const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function explore(symbol) {
    const query = symbol.endsWith('.JK') ? symbol : `${symbol}.JK`;
    console.log(`\n=== EXPLORING FOR: ${query} ===\n`);

    const validModules = [
        "assetProfile",
        "summaryProfile",
        "summaryDetail",
        "price",
        "defaultKeyStatistics",
        "financialData",
        "calendarEvents",
        "majorHoldersBreakdown",
        "insiderHolders",
        "insiderTransactions",
        "earnings",
        "earningsHistory"
    ];

    try {
        const result = await yahooFinance.quoteSummary(query, {
            modules: validModules
        });

        console.log("--- Profile Summary ---");
        console.log(JSON.stringify(result.assetProfile || result.summaryProfile, null, 2).slice(0, 500) + "...");

        console.log("\n--- Financial Data (TTM/Latest) ---");
        console.log(JSON.stringify(result.financialData, null, 2));

        console.log("\n--- Major Holders ---");
        console.log(result.majorHoldersBreakdown);

        // Exploration of Fundamentals Time Series (Recommended)
        console.log("\n--- Fundamentals Time Series Exploration ---");
        // Module options: 'all', 'financials', 'balance-sheet', 'cash-flow'
        // Type options: 'annualTotalRevenue', 'quarterlyTotalRevenue', 'annualNetIncome', etc.
        const tsModules = ['financials', 'balance-sheet', 'cash-flow'];
        for (const mod of tsModules) {
            try {
                const tsData = await yahooFinance.fundamentalsTimeSeries(query, {
                    period1: '2023-01-01',
                    module: mod,
                    merge: true
                });
                console.log(`\nTS Module [${mod}] keys:`, tsData.length > 0 ? Object.keys(tsData[0]) : "EMPTY");
                if (tsData.length > 0) console.log("Sample Data Entry:", tsData[tsData.length - 1]);
            } catch (e) {
                console.log(`TS Module [${mod}] error:`, e.message);
            }
        }

    } catch (err) {
        console.error("Error during exploration:", err.message);
    }
}

explore('BBCA');
