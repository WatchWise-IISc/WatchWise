import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Award, ShieldAlert, Sparkles } from 'lucide-react'

// Custom tooltip renderer for a dark-mode premium look
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5 font-mono">
          {payload.map((entry, index) => (
            <p key={index} className="text-xs flex items-center justify-between gap-5 font-semibold" style={{ color: entry.fill }}>
              <span>{entry.name}:</span>
              <span className="text-white text-sm font-bold">{entry.value}</span>
            </p>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function MetricsChart({ metrics }) {
  if (!metrics || metrics.length === 0) return null

  const data = metrics.map((m) => ({
    name: m.label.replace(' candidates', '').replace(' + ', '+\n'),
    shortName: m.method === 'avg_baseline' ? 'Avg Baseline' :
               m.method === 'nn_greedy' ? 'NN + Greedy' :
               m.method === 'diffusion_greedy' ? 'Diff + Greedy' :
               m.method === 'nn_rl' ? 'NN + RL' : 'Diff + RL (WatchWise)',
    relevance: m.relevance,
    min_member: m.min_member_sat,
    fairness_gap: m.fairness_gap,
  }))

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-500/5 to-transparent pointer-events-none rounded-bl-full" />
      
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Empirical Comparison</span>
          <h3 className="text-base font-extrabold text-white">
            Average Relevance vs Worst-Off Member Satisfaction
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            A perfect recommender system lifts the <strong className="text-emerald-400 font-medium">worst-off member satisfaction</strong> (green) to meet the <strong className="text-violet-400 font-medium font-mono">average relevance</strong> (violet). Notice how WatchWise closes this gap dramatically.
          </p>
        </div>
      </div>

      <div className="w-full">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey="shortName" 
              tick={{ fontSize: 10, fill: '#94a3b8' }} 
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis 
              domain={[0, 1.0]} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }} 
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: 15 }}
              formatter={(value) => <span className="text-xs font-bold text-slate-400">{value}</span>}
            />
            <Bar 
              dataKey="relevance" 
              name="Mean Relevance (Group Taste)" 
              fill="#8b5cf6" 
              radius={[6, 6, 0, 0]} 
              opacity={0.9} 
            />
            <Bar 
              dataKey="min_member" 
              name="Worst-Off Satisfaction (Fairness)" 
              fill="#10b981" 
              radius={[6, 6, 0, 0]} 
              opacity={0.9} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 p-4 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
          <span className="text-slate-300">
            <strong>The Scientific Breakthrough:</strong> Traditional models suffer from majority domination. WatchWise (Diff+RL) maximizes the satisfaction of the single unhappiest co-viewer, causing a steep metrics improvement.
          </span>
        </div>
      </div>
    </div>
  )
}
