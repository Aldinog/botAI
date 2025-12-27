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
        console.log("\n--- Testing Ownership Modules ---");
        const oResult = await yahooFinance.quoteSummary(query, {
            modules: [
                "majorHoldersBreakdown",
                "insiderHolders",
                "institutionOwnership",
                "fundOwnership"
            ]
        });

        console.log("Major Holders Breakdown:", oResult.majorHoldersBreakdown ? "Found" : "Not Found");
        console.log("Insider Holders:", oResult.insiderHolders ? "Found" : "Not Found");
        console.log("Institution Ownership:", oResult.institutionOwnership ? "Found" : "Not Found");
        console.log("Fund Ownership:", oResult.fundOwnership ? "Found" : "Not Found");

        console.log("\n--- Testing Advanced Modules ---");
        const aResult = await yahooFinance.quoteSummary(query, {
            modules: [
                "recommendationTrend",
                "earningsTrend",
                "calendarEvents",
                "summaryDetail",
                "defaultKeyStatistics"
            ]
        });

        console.log("Recommendation Trend:", aResult.recommendationTrend ? "Found" : "Not Found");
        console.log("Earnings Trend:", aResult.earningsTrend ? "Found" : "Not Found");
        console.log("Calendar Events:", aResult.calendarEvents ? "Found" : "Not Found");
        if (aResult.summaryDetail) {
            console.log(`Dividend Yield: ${aResult.summaryDetail.dividendYield}`);
            console.log(`Ex-Dividend Date: ${aResult.summaryDetail.exDividendDate}`);
        }

        console.log("\n--- Testing News Search ---");
        try {
            const searchResult = await yahooFinance.search(query);
            console.log("News count:", searchResult.news ? searchResult.news.length : 0);
            if (searchResult.news && searchResult.news.length > 0) {
                console.log("Latest Headline:", searchResult.news[0].title);
            }
        } catch (searchErr) {
            console.log("Search API error:", searchErr.message);
        }

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
