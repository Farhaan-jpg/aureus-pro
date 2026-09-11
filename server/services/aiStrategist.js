import { config } from '../config.js';

// The Floor Strategist System Prompt (5-Minute Daytrading & Scalping Optimized)
const STRATEGIST_SYSTEM_PROMPT = `
You are "The Floor Strategist" — a cynical, risk-averse, 10+ year veteran institutional bullion trader on the COMEX/London OTC gold desk specializing in 5-MINUTE DAYTRADING & INTRADAY SCALPING.
You do NOT trade on retail hype, meme indicators, or lagging oscillators. You care about:
1. 5-Minute Liquidity Sweeps: Stop hunts above equal highs ($5-$10 micro handles) and engineered liquidity runs below equal lows.
2. 5-Minute Execution Setups: Fair Value Gaps (FVG) mitigation, session Judas fakeouts, and 5m displacement candles.
3. Strict Scalper Risk Management: 1:2 or 1:3 RR scalps with exact 5m invalidation stop loss, target 1 (15 pips), and target 2 (30 pips).
4. Capital Preservation: Identifying high-spread traps, slippage zones, and front-running retail stop clusters.

You MUST reply ONLY with a valid JSON object strictly matching this schema:
{
  "actionableBias": "BULLISH" | "BEARISH" | "NEUTRAL_CHOP" | "CASH_IS_KING",
  "confidence": <integer 50-95>,
  "keySupport": "<price string e.g. $2,642.50>",
  "keyResistance": "<price string e.g. $2,695.00>",
  "invalidationLevel": "<exact invalidation price string e.g. $2,638.00>",
  "warningTrapZone": "<risk warning specifying high-spread or chop trap areas>",
  "sessionJudasContext": "<brief note on current 5m session Judas swing fakeouts and liquidity sweeps>",
  "macroYieldSynthesis": "<institutional breakdown of DXY & Real Yields impact right now>",
  "floorCommentary": "<3-4 sentences in your raw, cynical institutional trader voice analyzing the tape>"
}
`;

// Deterministic Rule-Based Institutional Engine (Tier 3 Fallback - Pure Market Intelligence)
export function generateDeterministicAnalysis(marketData, newsItems, biasScore) {
  const goldPrice = marketData?.goldSpot?.price || 4335.00;
  const dxy = marketData?.assets?.DXY?.price || 104.3;
  const realYield = marketData?.realYield10Y || 2.15;
  const session = marketData?.session || 'NY_OVERLAP';

  const roundBase = Math.floor(goldPrice / 10) * 10;
  const keySupport = `$${(goldPrice - 3.5).toFixed(2)}`;
  const keyResistance = `$${(goldPrice + 4.5).toFixed(2)}`;
  const invalidation = biasScore >= 0 ? `$${(goldPrice - 2.2).toFixed(2)}` : `$${(goldPrice + 2.2).toFixed(2)}`;

  let bias = "NEUTRAL_CHOP";
  if (biasScore >= 30) {
    bias = "BULLISH";
  } else if (biasScore <= -30) {
    bias = "BEARISH";
  } else if (Math.abs(biasScore) < 15) {
    bias = "CASH_IS_KING";
  }

  const isDxyElevated = dxy > 104.5;
  const isYieldHigh = realYield > 2.2;

  let macroSynthesis = `Real yields floating at ${realYield}% with DXY near ${dxy}. `;
  if (isYieldHigh && isDxyElevated) {
    macroSynthesis += "Dual macro headwinds capping aggressive upside bids. On the 5m chart, upside spikes are driven by liquidity hunting rather than genuine institutional accumulation.";
  } else if (!isYieldHigh && !isDxyElevated) {
    macroSynthesis += "Macro tailwinds supportive. Bullion demand remains cushioned as lower real yields reduce the opportunity cost of holding non-yielding gold.";
  } else {
    macroSynthesis += "Mixed macro signals: DXY and yields consolidating. Market flow is strictly oscillating between structural supply/demand order blocks.";
  }

  return {
    actionableBias: bias,
    confidence: Math.min(88, Math.max(60, 65 + Math.abs(biasScore) / 4)),
    keySupport,
    keyResistance,
    invalidationLevel: invalidation,
    warningTrapZone: `High-spread chop trap zone between $${(goldPrice - 0.8).toFixed(2)} and $${(goldPrice + 0.8).toFixed(2)}. Wider broker spreads in this pocket erode intraday capital.`,
    sessionJudasContext: `Current Session: ${session}. Watch for 5m Judas swing fakeouts at session opens designed to trap aggressive breakout traders before real institutional volume commits.`,
    macroYieldSynthesis: macroSynthesis,
    floorCommentary: `The retail crowd is clamoring for quick breakouts, but institutional liquidity desks are simply sweeping stops above equal highs and below equal lows. Protect your capital: let the tape confirm absorption before assuming directional continuity.`,
    provider: "Deterministic Institutional Engine (Tier-3 Fallback)",
    generatedAt: new Date().toISOString()
  };
}

// Call Google Gemini API (Primary Provider)
async function callGemini(promptText) {
  if (!config.geminiApiKey) throw new Error("Gemini API key not configured");

  // Use verified gemini-3.6-flash (fallback to gemini-3.5-flash)
  const models = ['gemini-3.6-flash', 'gemini-3.5-flash'];
  let lastErr = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: STRATEGIST_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        })
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errorText.slice(0, 150)}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Empty Gemini response candidate");

      const parsed = JSON.parse(rawText);
      return {
        ...parsed,
        provider: `Google Gemini (${model})`,
        generatedAt: new Date().toISOString()
      };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Gemini models failed");
}

// Call OpenRouter Free API (Secondary Fallback)
async function callOpenRouter(promptText) {
  if (!config.openRouterApiKey) throw new Error("OpenRouter API key not configured");

  const freeModels = [
    'inclusionai/ling-3.0-flash-vl:free',
    'nex-agi/nex-n2.5-mini:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'deepseek/deepseek-r1:free'
  ];

  let lastErr = null;
  for (const model of freeModels) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aureus-pro.render.com',
          'X-Title': 'Aureus Pro Gold Terminal'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: STRATEGIST_SYSTEM_PROMPT },
            { role: 'user', content: promptText + "\nRemember: Output ONLY strict JSON without markdown backticks." }
          ],
          temperature: 0.3
        })
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errJson = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errJson.slice(0, 120)}`);
      }

      const json = await res.json();
      let text = json?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty response from OpenRouter");

      // Strip markdown code fences if present
      if (text.startsWith('```')) {
        text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(text);
      return {
        ...parsed,
        provider: `OpenRouter Free (${model})`,
        generatedAt: new Date().toISOString()
      };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("All OpenRouter models failed");
}

let cachedAnalysis = null;
let geminiCooldownUntil = 0;
let openRouterCooldownUntil = 0;

// Multi-LLM Orchestrator with 3-tier Failover
export async function generateFloorAnalysis(marketData, newsList = [], biasScore = 0) {
  const goldPrice = marketData?.goldSpot?.price || 4335.00;
  const dxy = marketData?.assets?.DXY?.price || 104.3;
  const dxyChange = marketData?.assets?.DXY?.changePercent || 0;
  const silver = marketData?.assets?.SILVER?.price || 31.8;
  const gsr = marketData?.gsr || 84.4;
  const realYield = marketData?.realYield10Y || 2.15;
  const session = marketData?.session || 'LONDON/NY';
  const headlines = newsList.slice(0, 5).map(n => `[${n.sentiment}] ${n.title}`).join('\n');

  const promptText = `
CURRENT INSTITUTIONAL MARKET SNAPSHOT:
- Gold Spot (XAU/USD): $${goldPrice}
- Silver (XAG/USD): $${silver} (Gold/Silver Ratio: ${gsr})
- US Dollar Index (DXY): ${dxy} (${dxyChange > 0 ? '+' : ''}${dxyChange}%)
- US 10-Year Real Yield (TIPS): ${realYield}%
- Active Session: ${session}
- Composite Bias Score (-100 to +100): ${biasScore}
- Recent High-Impact Headlines:
${headlines || "No major breaking macro news in the last 60 minutes."}

Analyze the market tape as the 10+ year veteran floor trader and produce the required JSON analysis.
`;

  const now = Date.now();

  // Tier 1: Gemini (if not in quota cooldown)
  if (now > geminiCooldownUntil) {
    try {
      const analysis = await callGemini(promptText);
      cachedAnalysis = analysis;
      return analysis;
    } catch (geminiError) {
      if (geminiError.message?.includes('429') || geminiError.message?.includes('quota')) {
        geminiCooldownUntil = now + 5 * 60 * 1000; // 5 min cooldown on quota
      }
      console.warn(`[AI Engine] Gemini Primary bypassed: ${geminiError.message}. Initiating Tier 2 Failover...`);
    }
  }

  // Tier 2: OpenRouter Free Models (if not in quota cooldown)
  if (now > openRouterCooldownUntil) {
    try {
      const analysis = await callOpenRouter(promptText);
      cachedAnalysis = analysis;
      return analysis;
    } catch (openRouterError) {
      if (openRouterError.message?.includes('429') || openRouterError.message?.includes('Rate limit')) {
        openRouterCooldownUntil = now + 5 * 60 * 1000;
      }
      console.warn(`[AI Engine] OpenRouter Fallback bypassed: ${openRouterError.message}. Initiating Tier 3 Failover...`);
    }
  }

  // Tier 3: Deterministic Rule-Based Institutional Gold Floor Engine (Zero Latency)
  const analysis = generateDeterministicAnalysis(marketData, newsList, biasScore);
  cachedAnalysis = analysis;
  return analysis;
}

export function getCachedFloorAnalysis() {
  return cachedAnalysis;
}
