const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test(symbol) {
    const query = symbol.endsWith('.JK') ? symbol : `${symbol}.JK`;
    console.log(`Testing financials for: ${query}`);

    try {
        const result = await yahooFinance.quoteSummary(query, {
            modules: [
                "summaryDetail",
                "defaultKeyStatistics",
                "financialData",
                "price"
            ]
        });

        console.log("\n--- Financial Data Details ---");
        const fin = result.financialData || {};
        console.log(`Total Cash: ${fin.totalCash}`);
        console.log(`Total Debt: ${fin.totalDebt}`);
        console.log(`Operating Cashflow: ${fin.operatingCashflow}`);
        console.log(`Revenue Growth: ${fin.revenueGrowth}`);
        console.log(`Earnings Growth: ${fin.earningsGrowth}`);
        console.log(`Gross Profits: ${fin.grossProfits}`);

        console.log("\n--- Fundamentals Time Series (Annual Cash Flow) ---");
        try {
            const tsResult = await yahooFinance.fundamentalsTimeSeries(query, {
                period1: '2023-01-01',
                type: 'annualCashFlow',
                module: 'all', // Or specific module like 'financials'
                merge: true
            });
            console.log(JSON.stringify(tsResult, null, 2));
        } catch (tsErr) {
            console.log("fundamentalsTimeSeries error:", tsErr.message);
        }

    } catch (err) {
        console.error("Error:", err.message);
    }
}

test('BBCA');
