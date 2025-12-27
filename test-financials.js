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

        console.log("\n--- Testing Quarterly Modules ---");
        const qResult = await yahooFinance.quoteSummary(query, {
            modules: [
                "incomeStatementHistoryQuarterly",
                "balanceSheetHistoryQuarterly",
                "cashflowStatementHistoryQuarterly",
                "earnings"
            ]
        });

        console.log("Income Statement Quarterly:", qResult.incomeStatementHistoryQuarterly ? "Found" : "Not Found");
        if (qResult.incomeStatementHistoryQuarterly) {
            console.log(JSON.stringify(qResult.incomeStatementHistoryQuarterly.incomeStatementHistory.slice(0, 1), null, 2));
        }

        console.log("Balance Sheet Quarterly:", qResult.balanceSheetHistoryQuarterly ? "Found" : "Not Found");
        console.log("Cashflow Quarterly:", qResult.cashflowStatementHistoryQuarterly ? "Found" : "Not Found");
        console.log("Earnings:", qResult.earnings ? "Found" : "Not Found");
        if (qResult.earnings && qResult.earnings.financialsChart) {
            console.log("Earnings Quarterly Chart Found");
            console.log(JSON.stringify(qResult.earnings.financialsChart.quarterly.slice(0, 2), null, 2));
        }

    } catch (err) {
        console.error("Error:", err.message);
    }
}

test('BBCA');
