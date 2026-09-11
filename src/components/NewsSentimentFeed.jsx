import React, { useState } from 'react';
import { Newspaper, Flame, ShieldAlert, Landmark, ExternalLink, Filter, Search } from 'lucide-react';

export default function NewsSentimentFeed({ news = [] }) {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNews = news.filter(item => {
    // Filter by category/tag
    if (activeFilter === 'BULLISH' && item.sentiment !== 'BULLISH') return false;
    if (activeFilter === 'BEARISH' && item.sentiment !== 'BEARISH') return false;
    if (activeFilter === 'HIGH_IMPACT' && (item.impact || 1) < 4) return false;
    if (activeFilter === 'GEOPOLITICAL' && !item.isGeopolitical) return false;
    if (activeFilter === 'CENTRAL_BANK' && !item.isCentralBank) return false;

    // Search query
    if (searchQuery.trim() !== '') {
      return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             item.source.toLowerCase().includes(searchQuery.toLowerCase());
    }

    return true;
  });

  const filterTabs = [
    { id: 'ALL', label: 'All News' },
    { id: 'BULLISH', label: 'Bullish Gold' },
    { id: 'BEARISH', label: 'Bearish Gold' },
    { id: 'HIGH_IMPACT', label: 'High Impact (4-5)' },
    { id: 'GEOPOLITICAL', label: 'Geopolitics' },
    { id: 'CENTRAL_BANK', label: 'Central Banks' },
  ];

  return (
    <div className="hud-panel p-4 flex flex-col h-[520px]">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-2 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-gold-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
            Module B: High-Speed News Aggregator & Sentiment Classifier
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
            {news.length} Parsed
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter headlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-44 bg-black/40 border border-white/10 text-xs rounded pl-7 pr-2 py-1 text-slate-200 focus:outline-none focus:border-gold-500 font-mono placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2 border-b border-white/5 text-xs font-mono">
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-2.5 py-1 rounded whitespace-nowrap transition ${
              activeFilter === tab.id
                ? 'bg-gold-500 text-black font-bold'
                : 'text-slate-400 hover:text-white bg-slate-900/50 border border-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Headlines List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredNews.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-xs">
            No headlines match the active filter criteria.
          </div>
        ) : (
          filteredNews.map((item, idx) => {
            const isBullish = item.sentiment === 'BULLISH';
            const isBearish = item.sentiment === 'BEARISH';
            const impact = item.impact || 2;

            return (
              <div
                key={item.id || idx}
                className="bg-[#0b0e15] border border-white/5 hover:border-white/15 p-2.5 rounded transition flex flex-col justify-between group"
              >
                <div>
                  {/* Top Metadata Row */}
                  <div className="flex items-center justify-between gap-2 mb-1 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Sentiment Tag */}
                      <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                        isBullish
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                          : isBearish
                          ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {item.sentiment}
                      </span>

                      {/* Source */}
                      <span className="text-slate-400 font-semibold">{item.source}</span>

                      {/* Geopolitical Badge */}
                      {item.isGeopolitical && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 text-[9px]">
                          <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />
                          <span>GEOPOLITICAL</span>
                        </span>
                      )}

                      {/* Central Bank Badge */}
                      {item.isCentralBank && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-gold-950/60 text-gold-300 border border-gold-800/40 text-[9px]">
                          <Landmark className="w-2.5 h-2.5 text-gold-400" />
                          <span>CENTRAL BANK</span>
                        </span>
                      )}
                    </div>

                    {/* Impact Rating Flames */}
                    <div className="flex items-center gap-0.5 text-gold-400" title={`Impact Score: ${impact}/5`}>
                      {[...Array(5)].map((_, i) => (
                        <Flame
                          key={i}
                          className={`w-3 h-3 ${i < impact ? 'fill-gold-400 text-gold-400' : 'text-slate-700'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Headline Title */}
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-sans text-slate-200 group-hover:text-gold-300 transition leading-snug line-clamp-2 block"
                  >
                    {item.title}
                  </a>
                </div>

                {/* Bottom Timestamp & Link */}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5 text-[9px] font-mono text-slate-500">
                  <span>{new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:text-slate-300 transition"
                  >
                    <span>Source</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
