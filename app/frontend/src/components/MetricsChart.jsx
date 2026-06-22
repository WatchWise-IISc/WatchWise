import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function MetricsChart({ metrics }) {
  if (!metrics || metrics.length === 0) return null

  const data = metrics.map((m) => ({
    name: m.label.replace(' candidates', '').replace(' + ', '+\n'),
    shortName: m.method === 'avg_baseline' ? 'Avg Baseline' :
               m.method === 'nn_greedy' ? 'NN+Greedy' :
               m.method === 'diffusion_greedy' ? 'Diff+Greedy' :
               m.method === 'nn_rl' ? 'NN+RL' : 'Diff+RL',
    relevance: m.relevance,
    min_member: m.min_member_sat,
    fairness_gap: m.fairness_gap,
  }))

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Relevance vs Worst-Off Member Satisfaction
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="shortName" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Legend />
          <Bar dataKey="relevance" name="Mean Relevance" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="min_member" name="Min-Member (worst-off)" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-3 text-center">
        The baseline has high mean relevance but low min-member satisfaction. WatchWise (Diff+RL) lifts
        the worst-off member with minimal relevance loss — that's the fairness gain.
      </p>
    </div>
  )
}
