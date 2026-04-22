import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";

import type { MarketAsset } from "./market-assets";

export function MarketCard({ asset, expanded }: { asset: MarketAsset; expanded: boolean }) {
  const positive = asset.trend === "up";
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  return (
    <div className={`overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-3 text-white transition-all duration-300 ${expanded ? "min-h-[220px]" : "min-h-[112px]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{asset.symbol}</p>
          <p className={`mt-1 font-heading font-semibold ${expanded ? "text-2xl" : "text-lg"}`}>{asset.price}</p>
        </div>
        <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {asset.percent}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <div>
          <p className="text-slate-500">24h delta</p>
          <p className={`mt-1 font-semibold ${positive ? "text-emerald-300" : "text-rose-300"}`}>{asset.delta}</p>
        </div>
        <div className={`rounded-full bg-gradient-to-r ${asset.glow} px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300`}>
          Market Feed
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={asset.history} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${asset.symbol.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={asset.accent} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={asset.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="time" interval={0} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 9 }} />
              <YAxis hide domain={["dataMin - 0.05", "dataMax + 0.05"]} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid rgba(148,163,184,0.18)",
                  borderRadius: "16px",
                  color: "#f8fafc"
                }}
                labelStyle={{ color: "#cbd5e1" }}
              />
              <Area type="monotone" dataKey="value" stroke={asset.accent} strokeWidth={2} fill={`url(#gradient-${asset.symbol.replace(/\W/g, "")})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>{asset.name}</span>
        <span>24h</span>
      </div>
    </div>
  );
}
