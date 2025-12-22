// api/src/utils/gemini.js
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("⚠️ GEMINI_API_KEY belum diset di .env");
}

const ai = new GoogleGenAI({ apiKey });

async function analyzeWithGemini(prompt) {
  if (!apiKey) throw new Error("GEMINI_API_KEY tidak ada.");

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    // FORMAT RESPON GEMINI SESUAI LOG JSON YANG KAMU TAMPILKAN
    const text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ Tidak ada teks dari Gemini.";

    return text;

  } catch (err) {
    console.error("Gemini error:", err?.response?.data || err.message);
    throw new Error("AI Overload, Cobalagi beberapa saat");
  }
}

module.exports = { analyzeWithGemini };
