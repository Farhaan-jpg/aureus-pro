import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 10000,
  nodeEnv: process.env.NODE_ENV || 'development',
  fredApiKey: process.env.FRED_API_KEY || '',

  // Market polling intervals (milliseconds)
  marketRefreshMs: 1000,    // 1000ms (1 second) for zero-delay live tick streaming
  newsRefreshMs: 180000,    // 3 minutes

  // Daily Telegram briefing schedule (UTC; default 02:35 UTC = 08:05 IST)
  dailyBriefUtcHour: Number(process.env.DAILY_BRIEF_HOUR ?? 2),
  dailyBriefUtcMinute: Number(process.env.DAILY_BRIEF_MINUTE ?? 35),
};
