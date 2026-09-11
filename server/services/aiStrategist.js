import { config } from '../config.js';

// The Floor Strategist System Prompt
const STRATEGIST_SYSTEM_PROMPT = `
You are "The Floor Strategist" — a cynical, risk-averse, 10+ year veteran institutional bullion trader on the COMEX/London OTC gold desk.
You do NOT trade on retail hype, meme indicators, or lagging oscillators. You care about:
1. Liquidity sweeps: Stop hunts above equal highs ($20-$50 round handles) and engineered liquidity runs below equal lows.
2. Session transitions: Asian range accumulation / compression, London Open fakeouts (Judas swings), and New York overlap liquidity injections.
3. Macro drivers: US 10-Year Real Yields (the true opportunity cost of zero-yielding bullion), DXY momentum, and Fed dot plot expectations.
4. Capital preservation: Identifying high-spread traps and front-running retail stop clusters.

You MUST reply ONLY with a valid JSON object strictly matching this schema:
{
  "actionableBias": "BULLISH" | "BEARISH" | "NEUTRAL_CHOP" | "CASH_IS_KING",
  "confidence": <integer 50-95>,
  "keySupport": "<price string e.g. $2,642.50>",
  "keyResistance": "<price string e.g. $2,695.00>",
  "invalidationLevel": "<exact invalidation price string e.g. $2,638.00>",
  "highProbabilitySetup": "<2-3 sentence description of the setup, e.g. London Low liquidity grab sweep followed by NY session retest>",
  "warningTrapZone": "<risk warning specifying high-spread or chop trap areas>",
  "sessionJudasContext": "<brief note on current Asian/London/NY session behavior and fakeout risks>",
  "macroYieldSynthesis": "<institutional breakdown of DXY & Real Yields impact right now>",
  "floorCommentary": "<3-4 sentences in your raw, cynical institutional trader voice analyzing the tape>"
}
`;

// Deterministic Rule-Based Institutional Engine (Tier 3 Fallback)
export function generateDeterministicAnalysis(marketData, newsItems, biasScore) {
  const goldPrice = marketData?.goldSpot?.price || 2685.00;
  const dxy = marketData?.assets?.DXY?.price || 104.3;
  const realYield = marketData?.realYield10Y || 2.15;
  const session = marketData?.session || 'NY_OVERLAP';

  const roundBase = Math.floor(goldPrice / 25) * 25;
  const keySupport = `$${(roundBase).toFixed(2)}`;
  const keyResistance = `$${(roundBase + 25).toFixed(2)}`;
  const invalidation = biasScore >= 0 ? `$${(roundBase - 8.5).toFixed(2)}` : `$${(roundBase + 33.5).toFixed(2)}`;

  let bias = "NEUTRAL_CHOP";
  if (biasScore >= 35) bias = "BULLISH";
  else if (biasScore <= -35) bias = "BEARISH";
  else if (Math.abs(biasScore) < 15) bias = "CASH_IS_KING";

  const isDxyElevated = dxy > 104.5;
  const isYieldHigh = realYield > 2.2;

  let macroSynthesis = `Real yields floating at ${realYield}% with DXY near ${dxy}. `;
  if (isYieldHigh && isDxyElevated) {
    macroSynthesis += "Dual macro headwinds capping institutional aggressive bids. Any upside spike represents liquidity hunting rather than real accumulation.";
  } else if (!isYieldHigh && !isDxyElevated) {
    macroSynthesis += "Macro tailwinds supportive as opportunity cost of non-yielding bullion softens with softening nominal yields and consolidating DXY.";
  } else {
    macroSynthesis += "Mixed macro signals: DXY and Treasury curves diverging. Institutional flow is reacting strictly to structural order blocks.";
  }

  return {
    actionableBias: bias,
    confidence: Math.min(88, Math.max(60, 65 + Math.abs(biasScore) / 4)),
    keySupport,
    keyResistance,
    invalidationLevel: invalidation,
    highProbabilitySetup: `Wait for liquidity run into ${bias === 'BULLISH' ? keySupport : keyResistance}. Look for institutional absorption on the 15m footprint chart and enter on the first 5m displacement wick.`,
    warningTrapZone: `No-man's land between $${(goldPrice - 3).toFixed(2)} and $${(goldPrice + 3).toFixed(2)}. Wide retail spreads and algorithmic chop will bleed impatient scalpers before London/NY session high/low tests.`,
    sessionJudasContext: `Current Session: ${session}. Watch for the classic Judas swing. Algorithms will probe stops above recent Asian highs before settling into true directional order flow.`,
    macroYieldSynthesis: macroSynthesis,
    floorCommentary: `The retail crowd is clamoring for a breakout, but real volume is dormant until key macro liquidity pools are taken. Institutional desks are hunting stop orders clustered around psychological levels. Protect your capital: don't buy into the initial breakout impulse without session confirmation.`,
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

// Multi-LLM Orchestrator with 3-tier Failover
export async function generateFloorAnalysis(marketData, newsList = [], biasScore = 0) {
  const goldPrice = marketData?.goldSpot?.price || 2685.00;
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

  // Tier 1: Gemini
  try {
    const analysis = await callGemini(promptText);
    cachedAnalysis = analysis;
    return analysis;
  } catch (geminiError) {
    console.warn(`[AI Engine] Gemini Primary failed: ${geminiError.message}. Initiating Tier 2 Failover (OpenRouter)...`);
  }

  // Tier 2: OpenRouter Free Models
  try {
    const analysis = await callOpenRouter(promptText);
    cachedAnalysis = analysis;
    return analysis;
  } catch (openRouterError) {
    console.warn(`[AI Engine] OpenRouter Fallback failed: ${openRouterError.message}. Initiating Tier 3 Failover (Deterministic Engine)...`);
  }

  // Tier 3: Deterministic Rule-Based Institutional Gold Floor Engine
  const analysis = generateDeterministicAnalysis(marketData, newsList, biasScore);
  cachedAnalysis = analysis;
  return analysis;
}

export function getCachedFloorAnalysis() {
  return cachedAnalysis;
}
