import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 10000,
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  finnhubApiKey: process.env.FINNHUB_API_KEY || '',
  alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
  
  // Market polling intervals (milliseconds)
  marketRefreshMs: 1000,    // 1000ms (1 second) for zero-delay live tick streaming
  newsRefreshMs: 180000,    // 3 minutes
  aiRefreshMs: 600000,      // 10 minutes
};
