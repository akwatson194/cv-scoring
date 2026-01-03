require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.warn("⚠️ Missing OPENAI_API_KEY – scoring will fail!");
}

const client = new OpenAI({ apiKey: OPENAI_KEY });

const app = express();
app.use(bodyParser.json());
app.use(express.static("public")); // serves the HTML UI

const SCORE_MAP = { FULL: 1, PARTIAL: 0.5, NO: 0 };

// AI scoring function
async function callAI(skill, cv) {
  const prompt = `
Required skill: ${skill}
CV:
${cv}
Reply with ONLY one word: FULL / PARTIAL / NO
  `;
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 5
  });
  return res.choices[0].message.content.trim().toUpperCase();
}

// Calculate overall score
function calculateScore(results) {
  const total = results.reduce((sum, r) => sum + SCORE_MAP[r], 0);
  return Math.round((total / results.length) * 100);
}

// API endpoint
app.post("/score", async (req, res) => {
  const { skills, cv } = req.body;
  if (!skills || !cv) return res.status(400).json({ error: "Missing skills or CV" });

  const results = [];
  for (const skill of skills) {
    const verdict = await callAI(skill, cv);
    results.push(verdict);
  }

  const score = calculateScore(results);
  const breakdown = skills.map((s, i) => ({ skill: s, result: results[i] }));

  res.json({
    overall_score: score,
    breakdown,
    summary: {
      strengths: breakdown.filter(b => b.result === "FULL").map(b => b.skill),
      gaps: breakdown.filter(b => b.result !== "FULL").map(b => b.skill)
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Live scoring at http://localhost:${PORT}`));
