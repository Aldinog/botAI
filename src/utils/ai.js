// src/utils/ai.js
require("dotenv").config();
const OpenAI = require("openai");

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.AI_MODEL || "google/gemini-2.0-flash-lite-preview-02-05:free";

if (!apiKey) {
    console.warn("⚠️ OPENROUTER_API_KEY belum diset di .env");
}

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    defaultHeaders: {
        "HTTP-Referer": "https://astonmology.com", // Optional, for OpenRouter rankings
        "X-Title": "Astonmology Bot", // Optional
    }
});

/**
 * Analyze prompt using OpenRouter AI
 * @param {string} prompt 
 * @returns {Promise<string>}
 */
async function analyzeWithAI(prompt) {
    if (!apiKey) throw new Error("OPENROUTER_API_KEY tidak ada.");

    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        const text = response.choices[0]?.message?.content || "⚠️ Tidak ada respon dari AI.";
        return text;

    } catch (err) {
        console.error("OpenRouter AI error:", err.message);
        // Generic error message for user
        throw new Error("AI Overload, Cobalagi beberapa saat");
    }
}

module.exports = { analyzeWithAI };
