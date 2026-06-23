import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Sparkles } from 'lucide-react'

const METHOD_NAMES = {
  avg_baseline: 'Avg Baseline',
  nn_greedy: 'NN + Greedy',
  diffusion_greedy: 'Diff + Greedy',
  nn_rl: 'NN + RL',
  diffusion_rl: 'Diff + RL',
  hybrid_rl: 'Hybrid + RL',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="border border-black bg-[#FAF9F6] p-4 shadow-xl font-mono text-xs">
      <p className="mb-2 border-b border-black/10 pb-1.5 font-extrabold uppercase tracking-wider text-[#1A1A1A]">
        {label}
      </p>
      <div className="space-y-2">
        {payload.map((entry, index) => (
          <p
            key={index}
            className="flex justify-between gap-6 font-bold"
            style={{ color: entry.fill === '#1a1a1a' || entry.fill === '#1A1A1A' ? '#1A1A1A' : entry.fill }}
          >
            <span>{entry.name}:</span>
            <span className="text-sm font-extrabold text-[#1A1A1A]">
              {Number(entry.value).toFixed(3)}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

export default function MetricsChart({ metrics = [], watchwiseMethod = 'diffusion_rl' }) {
  if (!metrics || metrics.length === 0) return null

  const data = metrics.map((m) => {
    const isWatchWise = m.method === watchwiseMethod
    return {
      name: m.label.replace(' candidates', '').replace(' + ', '+\n'),
      shortName: `${METHOD_NAMES[m.method] || m.label}${isWatchWise ? ' (WatchWise)' : ''}`,
      relevance: Number(m.relevance),
      min_member: Number(m.min_member_sat),
    }
  })

  return (
    <div className="swiss-panel-strong p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="swiss-section-title">
            Empirical Comparison
          </span>
          <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight text-[#1A1A1A]">
            Average Relevance vs Worst-Off Member Satisfaction
          </h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#505051]">
            The dark bars show average group relevance (predicted group taste); the orange bars show the protected worst-off member satisfaction (fairness floor).
            WatchWise variants expose the relevance/fairness trade-off across the same cohort.
          </p>
        </div>
      </div>

      <div className="w-full">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26, 26, 26, 0.08)" vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={{ fontSize: 10, fill: '#505051', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
              axisLine={{ stroke: 'rgba(26, 26, 26, 0.15)' }}
              tickLine={{ stroke: 'rgba(26, 26, 26, 0.15)' }}
            />
            <YAxis
              domain={[0, 1.0]}
              tick={{ fontSize: 10, fill: '#505051', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
              axisLine={{ stroke: 'rgba(26, 26, 26, 0.15)' }}
              tickLine={{ stroke: 'rgba(26, 26, 26, 0.15)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 15 }}
              formatter={(value) => (
                <span className="font-mono text-[10px] font-extrabold uppercase tracking-wide text-[#505051]">
                  {value}
                </span>
              )}
            />
            <Bar
              dataKey="relevance"
              name="Mean Relevance (Group Taste)"
              fill="#1A1A1A"
              radius={0}
              opacity={0.9}
            />
            <Bar
              dataKey="min_member"
              name="Worst-Off Satisfaction (Fairness)"
              fill="#EA580C"
              radius={0}
              opacity={0.95}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex flex-col items-start gap-4 border-l-4 border-[#EA580C] bg-white p-4 text-xs md:flex-row md:items-center">
        <Sparkles className="h-4 w-4 shrink-0 text-[#EA580C]" />
        <span className="text-[#505051] leading-relaxed">
          <strong className="text-[#1A1A1A]">The Scientific Breakthrough:</strong> WatchWise compares candidate generation and slate-building strategies under the same cohort, surfacing methods that protect the least-satisfied viewer without collapsing group relevance.
        </span>
      </div>
    </div>
  )
}

