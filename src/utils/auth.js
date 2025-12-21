const crypto = require('crypto');
require('dotenv').config();

/**
 * Validates the data received from the Telegram Mini App.
 * @param {string} initData - The raw initData string from Telegram WebApp.
 * @returns {object|null} - The parsed user data if valid, null otherwise.
 */
function validateTelegramInitData(initData) {
    if (!initData) return null;

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    // Sort parameters alphabetically
    const params = Array.from(urlParams.entries());
    params.sort(([a], [b]) => a.localeCompare(b));

    const dataCheckString = params.map(([key, value]) => `${key}=${value}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(process.env.TELEGRAM_TOKEN)
        .digest();

    const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    if (calculatedHash === hash) {
        const userStr = urlParams.get('user');
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    }
    return null;
}

module.exports = { validateTelegramInitData };
