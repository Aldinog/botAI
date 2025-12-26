/**
 * Shared utility for Telegram message formatting
 */

let marked;
async function loadMarked() {
    if (!marked) marked = (await import("marked")).marked;
    return marked;
}

function sanitizeTelegramHTML(html) {
    let safe = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const allow = {
        "&lt;b&gt;": "<b>",
        "&lt;/b&gt;": "</b>",
        "&lt;i&gt;": "<i>",
        "&lt;/i&gt;": "</i>",
        "&lt;code&gt;": "<code>",
        "&lt;/code&gt;": "</code>",
        "&lt;pre&gt;": "<pre>",
        "&lt;/pre&gt;": "</pre>"
    };

    for (const [from, to] of Object.entries(allow)) {
        safe = safe.replace(new RegExp(from, "g"), to);
    }

    return safe;
}

async function markdownToTelegramHTML(md) {
    const markedFn = await loadMarked();
    let html = markedFn(md);

    // Remove unsupported tags before sanitization to avoid leaking tags
    html = html.replace(/<\/?(div|span|blockquote|a|img|h[1-6]|table|tr|td|th)[^>]*>/g, "");

    html = html
        .replace(/<strong>/g, "<b>")
        .replace(/<\/strong>/g, "</b>")
        .replace(/<em>/g, "<i>")
        .replace(/<\/em>/g, "</i>")
        .replace(/<p>/g, "")
        .replace(/<\/p>/g, "\n\n")
        .replace(/<ul>/g, "")
        .replace(/<\/ul>/g, "")
        .replace(/<ol>/g, "")
        .replace(/<\/ol>/g, "")
        .replace(/<li>/g, "• ")
        .replace(/<\/li>/g, "\n")
        .replace(/<hr\s*\/?>/g, "────────────\n")
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return sanitizeTelegramHTML(html);
}

function splitMessageSafe(text, maxLength = 4000) {
    const parts = [];
    let currentPart = "";
    const openTags = [];

    const closeTags = (tags) => tags.slice().reverse().map(t => `</${t}>`).join("");
    const reopenTags = (tags) => tags.map(t => `<${t}>`).join("");

    const regex = /(<\/?(?:b|i|code|pre)>)|([^<]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const token = match[0];
        const isTag = !!match[1];
        const closingOverhead = closeTags(openTags).length;

        if (currentPart.length + token.length + closingOverhead > maxLength) {
            parts.push(currentPart + closeTags(openTags));
            currentPart = reopenTags(openTags);
        }

        currentPart += token;

        if (isTag) {
            if (token.startsWith("</")) {
                const tagName = token.replace(/<\/?|>/g, "");
                if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
                    openTags.pop();
                }
            } else {
                const tagName = token.replace(/<|>/g, "");
                openTags.push(tagName);
            }
        }
    }

    if (currentPart.trim()) {
        parts.push(currentPart + closeTags(openTags));
    }

    return parts;
}

module.exports = {
    markdownToTelegramHTML,
    sanitizeTelegramHTML,
    splitMessageSafe,
    loadMarked
};
