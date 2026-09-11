# 🏆 AUREUS PRO — Institutional XAU/USD Intelligence Dashboard

A production-ready, institutional-grade Gold (XAU/USD) real-time monitoring and intelligence platform. Built for **100% free cloud deployment on Render (Web Service)**, utilizing GitHub for version control and GitHub Actions / external cron jobs for automated scheduled tasks and keep-alive pinging.

---

## ⚡ Key Modules & Features

### 1. Module A: Real-Time Correlated Assets & Macro Drivers Engine
- **Correlated Commodities:**
  - Silver (XAG/USD) + Live Gold/Silver Ratio (GSR)
  - WTI Crude Oil (USOIL)
  - Copper Futures (HG)
  - Platinum Spot (XPT/USD)
- **Macro Drivers & Yields:**
  - US Dollar Index (DXY)
  - US 10-Year Treasury Yield (US10Y) & 2-Year Yield (US02Y)
  - US 10-Year Real Yield (TIPS proxy: Nominal 10Y minus inflation expectation)
  - CBOE Volatility Index (VIX)
- **Rolling Correlation (-1.0 to +1.0):** Real-time Pearson correlation matrix computed against Gold returns.

### 2. Module B: High-Speed News Aggregator & AI Sentiment Classifier
- Multi-source RSS parsing (ForexFactory, FXStreet, Investing.com, Reuters, Bloomberg, Al Jazeera).
- Real-time classification tags: `BULLISH` (green), `BEARISH` (red), `NEUTRAL` (gray).
- Impact Score: 1 to 5 flame indicators.
- Geopolitical risk tags (Middle East, Red Sea, military escalations).
- Central Bank tags (PBOC, BRICS, sovereign bullion purchases).
- Zero duplicate headlines via SHA-256 content hashing.

### 3. Modules C & D: Multi-LLM AI Engine ("The Floor Strategist" Persona)
- **3-Tier Automatic Failover:**
  1. Primary: **Google AI Studio / Gemini API** (`gemini-3.6-flash`).
  2. Fallback: **OpenRouter Free Multi-Model API** (cycling free models e.g. `inclusionai/ling-3.0-flash-vl:free`, `meta-llama`, etc.).
  3. Tier-3 Fallback: **Deterministic Rule-Based Institutional Gold Engine** (evaluates yields, DXY, EMAs, news sentiment, and retail traps).
- **Persona:** Cynical, risk-averse, liquidity-focused 10+ year veteran bullion trader.
  - Outputs: Actionable Bias, Invalidation Level, High-Probability Setup, High-Spread Trap Warning, Session Judas swings, and Macro commentary.

### 4. Module E: Official OANDA TradingView Advanced Chart
- Embedded official TradingView widget for `OANDA:XAUUSD`.
- Multi-timeframe switcher: 15M, 1H, 4H, 1D.
- Pre-configured with Volume, RSI, and MACD indicators in dark institutional theme.

### 5. Module F: Real-Time Economic Calendar & Gold Impact Matrix
- High-tier macro events: CPI, Non-Farm Payrolls, FOMC Decisions, PPI, PCE, Jobless Claims.
- Live countdown timer to the next scheduled release.
- Interactive Gold Impact Logic Matrix explaining how macro surprises dictate Yields, DXY, and Bullion.

### 6. Module G: Order Book Depth & Retail Sentiment Tracker
- Retail Long/Short sentiment ratio tracker.
- Contrarian Warning: Triggered when retail crowd is >75% Long ("Extreme Long Retail Trap").
- Institutional Order Flow / Liquidity Depth Heatmap proxy at round psychological handles ($2,600, $2,650, $2,700, etc.) with bid/ask volume clusters.

### 7. Module H: Real-Time Composite Market Bias & Strength Meter
- Exact mathematical algorithm from -100 (Extreme Bearish) to +100 (Extreme Bullish):
  - Macro Sub-Score (30%)
  - Commodity Cohort Sub-Score (20%)
  - News Sentiment Sub-Score (20%)
  - Retail Contrarian Sub-Score (15%)
  - Technical Structure Sub-Score (15%)
- Dynamic SVG Speedometer needle with `STRONG SELL`, `SELL`, `NEUTRAL`, `BUY`, `STRONG BUY` + confidence %.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and supply GEMINI_API_KEY or OPENROUTER_API_KEY

# 3. Build frontend
npm run build

# 4. Start production server
npm start
```
Visit `http://localhost:10000` in your web browser.

For local frontend development with Hot Module Replacement (HMR):
```bash
npm run dev
```

---

## ☁️ 100% Free Cloud Deployment Blueprint (Render + GitHub)

Aureus Pro is designed as a **single unified Web Service** (Express serves REST APIs, SSE bus, background cron workers, and static React bundle from `dist/`), fitting 100% within the free tier.

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "feat: institutional aureus pro gold terminal"
git branch -M main
git remote add origin https://github.com/YOUR_USER/aureus-pro.git
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Render will automatically detect `render.yaml` or you can configure:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/healthz`
5. Add Environment Variables:
   - `PORT`: `10000`
   - `NODE_ENV`: `production`
   - `GEMINI_API_KEY`: `your_key`
   - `OPENROUTER_API_KEY`: `your_key`
6. Click **Create Web Service**.

### Step 3: Prevent Render Cold Sleep (Keep-Alive)
Render's free tier spins down web services after 15 minutes of inactivity. To keep Aureus Pro warm 24/7 at $0 cost:

#### Option A: GitHub Actions (Built-in)
The repository includes `.github/workflows/keepalive.yml` which automatically pings `/healthz` every 10 minutes.
- In your GitHub repo: **Settings** -> **Secrets and variables** -> **Actions** -> Add secret `RENDER_APP_URL` with your Render URL (e.g. `https://aureus-pro.onrender.com`).

#### Option B: Cron-Job.org (External free service)
1. Sign up at [cron-job.org](https://cron-job.org) (100% free).
2. Create a new cron job:
   - URL: `https://your-app.onrender.com/healthz`
   - Schedule: Every 10 minutes.
