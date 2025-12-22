const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

(async () => {
    const symbol = 'BBCA.JK';
    console.log(`Testing features for ${symbol}...`);

    try {
        // 1. News
        console.log('\n--- NEWS ---');
        const news = await yahooFinance.search(symbol, { newsCount: 3 });
        if (news.news && news.news.length) {
            news.news.forEach(n => console.log(`- ${n.title} (${n.publisher})`));
        } else {
            console.log('No news found via search.');
        }

        // 2. Profile (Business Summary)
        console.log('\n--- PROFILE ---');
        const profile = await yahooFinance.quoteSummary(symbol, { modules: ['summaryProfile'] });
        const p = profile.summaryProfile;
        if (p) {
            console.log(`Sector: ${p.sector}`);
            console.log(`Industry: ${p.industry}`);
            console.log(`Website: ${p.website}`);
            console.log(`Desc: ${p.longBusinessSummary ? p.longBusinessSummary.substring(0, 100) + '...' : 'N/A'}`);
        } else {
            console.log('No profile data.');
        }

    } catch (e) {
        console.error(e);
    }
})();
