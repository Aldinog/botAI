const yf = require('yahoo-finance2');
console.log('Keys:', Object.keys(yf));
console.log('Type of default:', typeof yf.default);
console.log('Is YahooFinance constructor?', typeof yf.YahooFinance);
try {
    const instance = new yf.default();
    console.log('new default() worked');
} catch (e) { console.log('new default() failed', e.message); }
