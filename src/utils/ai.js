// src/utils/ai.js
const axios = require("axios");
require("dotenv").config();

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.AI_MODEL || "google/gemini-2.0-flash-exp:free";

if (!apiKey) {
    console.warn("⚠️ OPENROUTER_API_KEY belum diset di environment variables");
}

/**
 * Analyze prompt using OpenRouter AI via Axios (Diharuskan menggunakan axios karena versi SDK OpenAI yang ada tidak kompatibel)
 * @param {string} prompt 
 * @returns {Promise<string>}
 */
async function analyzeWithAI(prompt) {
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY tidak ditemukan. Pastikan sudah diset di Vercel Dashboard atau .env");
    }

    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: model,
                messages: [{ role: "user", content: prompt }],
            },
            {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://astonmology.com",
                    "X-Title": "Astonmology Bot",
                    "Content-Type": "application/json",
                },
                timeout: 30000,
            }
        );

        const text = response.data?.choices?.[0]?.message?.content;
        if (!text) {
            throw new Error("Respon AI kosong dari OpenRouter API.");
        }

        return text;

    } catch (err) {
        const errorMsg = err.response?.data?.error?.message || err.message;
        console.error("OpenRouter AI error details:", errorMsg);

        // Memberikan pesan error yang lebih jelas agar user tahu apa yang salah (misal: API key salah)
        throw new Error(`AI Error: ${errorMsg}`);
    }
}

module.exports = { analyzeWithAI };
