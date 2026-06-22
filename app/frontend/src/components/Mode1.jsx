import React, { useState, useEffect } from 'react'
import { fetchGroups, fetchMode1 } from '../api.js'
import GroupPanel from './GroupPanel.jsx'
import SlateTable from './SlateTable.jsx'
import MetricsChart from './MetricsChart.jsx'

function InsightCard({ baseline, watchwise, metrics }) {
  if (!metrics || metrics.length === 0) return null
  const base = metrics.find(m => m.method === 'avg_baseline')
  const best = metrics.find(m => m.method === 'diffusion_rl')
  if (!base || !best) return null
  const lift = ((best.min_member_sat - base.min_member_sat) * 100).toFixed(0)
  const gapReduction = base.fairness_gap > 0
    ? ((1 - best.fairness_gap / base.fairness_gap) * 100).toFixed(0)
    : '100'

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
      <h3 className="text-base font-bold text-green-800 mb-3">Key Insight from This Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-700">+{lift}%</div>
          <div className="text-xs text-gray-600 mt-1">Worst-off member lifted</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-700">{gapReduction}%</div>
          <div className="text-xs text-gray-600 mt-1">Fairness gap reduced</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-indigo-700">{best.hit5}</div>
          <div className="text-xs text-gray-600 mt-1">Hit@5 (real held-out)</div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-gray-700">
        <div className="p-3 bg-white rounded-lg border border-green-100">
          <strong className="text-green-700">In plain English:</strong> The traditional approach picked movies that
          most people would enjoy on average — but at least one family member
          got almost nothing they liked (satisfaction: {base.min_member_sat}). WatchWise found movies
          where <em>everyone</em> has something to enjoy (satisfaction: {best.min_member_sat}).
          That's a <strong>+{lift}% improvement</strong> for the person who was being ignored.
        </div>
        <div className="p-3 bg-white rounded-lg border border-green-100">
          <strong className="text-green-700">Why it matters:</strong> In a real family movie night, if one person hates every pick,
          they'll veto or disengage. WatchWise ensures nobody is left out — the "fairness gap" between
          the happiest and unhappiest member dropped by <strong>{gapReduction}%</strong>.
        </div>
      </div>
    </div>
  )
}

export default function Mode1() {
  const [kind, setKind] = useState('divergent')
  const [groups, setGroups] = useState([])
  const [selectedGid, setSelectedGid] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetchGroups(kind).then((data) => {
      setGroups(data.groups)
      if (data.groups.length > 0) setSelectedGid(data.groups[0].gid)
    })
  }, [kind])

  const handleRecommend = async () => {
    if (!selectedGid) return
    setLoading(true)
    setResult(null)
    try {
      const data = await fetchMode1(selectedGid)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Simple Explanation */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">The Problem We're Solving</h2>
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-900 leading-relaxed">
            <strong>Imagine this:</strong> A family of 5 sits down for movie night. Dad loves action thrillers,
            Mom prefers drama, the teenager wants horror, and the kids want animation. A traditional recommender
            (like Netflix's "Top Picks") would average everyone's taste and suggest a popular drama — great
            for Mom, boring for everyone else. <strong>One person always gets ignored.</strong>
          </p>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          WatchWise asks: <em>"Can we find 5 movies where EVERYONE has at least one they'll enjoy?"</em>
          Instead of maximizing the average, we <strong>protect the worst-off member</strong> — the person
          traditional systems would ignore.
        </p>
      </div>

      {/* Traditional vs WatchWise Comparison */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Traditional vs WatchWise — Side by Side</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-lg p-5 border border-red-200">
            <h3 className="font-semibold text-red-800 text-sm mb-3">Traditional Recommender (Netflix, Spotify, etc.)</h3>
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>Step 1:</strong> Average all members' predicted ratings for each movie</p>
              <p><strong>Step 2:</strong> Find movies similar to what the group watched (nearest-neighbour lookup)</p>
              <p><strong>Step 3:</strong> Sort by average predicted rating, pick top 5</p>
              <p><strong>Result:</strong> The majority is happy, but 1-2 people get movies they dislike</p>
            </div>
            <div className="mt-3 p-2.5 bg-red-100 rounded text-xs text-red-800">
              <strong>The flaw:</strong> Optimizing average ignores individual variance.
              A movie rated [5, 5, 5, 1, 1] by 5 members averages 3.4 — same as [3, 3, 4, 3, 4].
              But the first leaves 2 people miserable.
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-5 border border-green-200">
            <h3 className="font-semibold text-green-800 text-sm mb-3">WatchWise (Our Solution)</h3>
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>Step 1:</strong> Learn each member's unique taste via matrix factorization (64-d embeddings)</p>
              <p><strong>Step 2:</strong> A diffusion model <em>generates</em> novel compromise candidates (not just lookups)</p>
              <p><strong>Step 3:</strong> An RL policy picks 5 movies maximizing the <em>minimum</em> member's satisfaction</p>
              <p><strong>Result:</strong> Everyone has at least one movie they'll enjoy. Nobody is stranded.</p>
            </div>
            <div className="mt-3 p-2.5 bg-green-100 rounded text-xs text-green-800">
              <strong>The innovation:</strong> We optimize min(satisfaction) instead of mean(satisfaction).
              The RL agent is literally rewarded for making the <em>unhappiest</em> person happier.
            </div>
          </div>
        </div>
      </div>

      {/* Technical Deep-Dive (collapsible) */}
      <details className="bg-white rounded-xl shadow-sm border border-gray-200">
        <summary className="p-6 cursor-pointer text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors">
          Technical Deep-Dive — Architecture and Training (click to expand)
        </summary>
        <div className="px-6 pb-6 space-y-4 text-xs text-gray-600 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">1. Matrix Factorization (MF)</h4>
              <p>Each user and movie is embedded into a 64-dim latent vector. Trained on real MovieLens ratings (100K–25M). Prediction = dot(user, movie). 20% held out per user BEFORE training — never leaked.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">2. Conditional Diffusion (DDPM)</h4>
              <p>Conditioned on group taste vector (mean of member MF embeddings). Generates 100 candidate movie embeddings by denoising from N(0,I). 50 DDIM steps, cosine beta-schedule, classifier-free guidance (scale=1.5).</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">3. Fairness-Aware Reward</h4>
              <p>R = w1 * mean_satisfaction + <strong>w2 * min_member_satisfaction</strong> + w3 * diversity - w4 * disagreement. The w2 term protects the worst-off member. Satisfaction = per-member percentile rank (not raw rating).</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">4. REINFORCE Slate-Builder</h4>
              <p>Policy: 2-layer MLP (128-dim), inputs = 8 group-relative fairness scalars. Trained on disjoint group splits (70/15/15). Selects K=5 movies sequentially from candidate pool, maximizing fairness reward.</p>
            </div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <h4 className="font-semibold text-indigo-800 mb-2">Non-Circular Evaluation (Why You Can Trust These Numbers)</h4>
            <p>20% of each user's ratings were hidden BEFORE any model training. Group "ground truth" = these held-out movies.
            NDCG@5 and Hit@5 are computed ONLY on held-out ratings the model never saw. This proves the system generalizes to unseen movies — not just memorizing training data.</p>
          </div>
        </div>
      </details>

      {/* Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-indigo-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Try It — Pick a Group and Compare</h3>
        <p className="text-xs text-gray-500 mb-4">
          <strong>Divergent</strong> = members have opposite tastes (hardest fairness challenge — this is where traditional recommenders fail).
          <strong> Similar</strong> = members already agree (everyone does well). <strong>Random</strong> = mixed reality.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Difficulty</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="divergent">Divergent (hardest — biggest fairness challenge)</option>
              <option value="similar">Similar (easiest — members already agree)</option>
              <option value="random">Random (medium difficulty)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
            <select
              value={selectedGid || ''}
              onChange={(e) => setSelectedGid(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {groups.map((g) => (
                <option key={g.gid} value={g.gid}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRecommend}
              disabled={loading}
              className="w-full px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Running 5 methods...
                </span>
              ) : 'Recommend & Compare All Methods'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Group info */}
          <GroupPanel group={result.group} />

          {/* Key Insight Card */}
          <InsightCard
            baseline={result.baseline_slate}
            watchwise={result.watchwise_slate}
            metrics={result.metrics}
          />

          {/* Side by side slates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-red-200">
              <h3 className="text-sm font-semibold text-red-700 mb-2">
                Traditional Baseline (Average)
              </h3>
              <div className="bg-red-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-red-800">
                  <strong>How it picked these:</strong> Predicted each member's rating for every movie,
                  averaged them, and picked the top 5 by mean score. The majority dominates —
                  if 3 out of 5 members like drama, you get 5 dramas.
                </p>
              </div>
              <SlateTable slate={result.baseline_slate} />
              <p className="text-xs text-gray-500 mt-3 italic">
                Check "Best For" — does every member appear? If M1 or M3 is missing, they got nothing they like.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-green-200">
              <h3 className="text-sm font-semibold text-green-700 mb-2">
                WatchWise (Diffusion + RL)
              </h3>
              <div className="bg-green-50 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-800">
                  <strong>How it picked these:</strong> Generated 100 compromise candidates via diffusion,
                  then the RL policy chose 5 that maximize the <em>minimum</em> member's happiness.
                  It literally asks "who is the unhappiest person and can I help them?"
                </p>
              </div>
              <SlateTable slate={result.watchwise_slate} />
              <p className="text-xs text-gray-500 mt-3 italic">
                Notice more diverse genres and broader "Best For" coverage — every member has something.
              </p>
            </div>
          </div>

          {/* All Methods Comparison */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Full Ablation — All 5 Methods Compared
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              We test every combination: [NN vs Diffusion] x [Greedy vs RL] + baseline.
              Only one component changes per row, so you can see exactly what each innovation contributes.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Method</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">
                      <div>Relevance</div>
                      <div className="text-[10px] font-normal text-gray-400">Overall quality</div>
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-red-600">
                      <div>Min-member</div>
                      <div className="text-[10px] font-normal text-red-400">Worst-off person</div>
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">
                      <div>Gap</div>
                      <div className="text-[10px] font-normal text-gray-400">Best - worst</div>
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">
                      <div>NDCG@5</div>
                      <div className="text-[10px] font-normal text-gray-400">Held-out rank</div>
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">
                      <div>Hit@5</div>
                      <div className="text-[10px] font-normal text-gray-400">Found relevant</div>
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">
                      <div>Diversity</div>
                      <div className="text-[10px] font-normal text-gray-400">Genre variety</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.metrics.map((m) => (
                    <tr key={m.method} className={`border-b border-gray-100 ${
                      m.method === 'diffusion_rl' ? 'bg-green-50 font-medium' :
                      m.method === 'avg_baseline' ? 'bg-red-50' : ''
                    }`}>
                      <td className="py-2.5 px-3">
                        <div className="text-xs">{m.label}</div>
                        {m.method === 'avg_baseline' && <div className="text-[10px] text-red-500 font-medium">Traditional approach</div>}
                        {m.method === 'diffusion_rl' && <div className="text-[10px] text-green-600 font-medium">WatchWise (best)</div>}
                      </td>
                      <td className="text-right py-2 px-3">{m.relevance}</td>
                      <td className="text-right py-2 px-3 font-semibold text-red-700">{m.min_member_sat}</td>
                      <td className="text-right py-2 px-3">{m.fairness_gap}</td>
                      <td className="text-right py-2 px-3">{m.ndcg5}</td>
                      <td className="text-right py-2 px-3">{m.hit5}</td>
                      <td className="text-right py-2 px-3">{m.diversity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="p-3 bg-blue-50 rounded-lg">
                <strong>Candidate test:</strong> Same reranker, swap NN to Diffusion. Does the diffusion model produce better compromise candidates?
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <strong>Reranker test:</strong> Same pool, swap Greedy to RL. Does the RL policy make fairer selections?
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <strong>Key metric:</strong> Min-member = worst-off person's satisfaction. The headline fairness number.
              </div>
            </div>
          </div>

          {/* Chart */}
          <MetricsChart metrics={result.metrics} />

          {/* Diffusion teaser */}
          {result.diffusion_teaser && result.diffusion_teaser.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
              <h3 className="text-sm font-semibold text-indigo-700 mb-2">
                Diffusion-Generated Compromise Candidates (sample from pool)
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                {result.diffusion_teaser.join(' / ')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-indigo-100">
                  <strong className="text-indigo-700">Simple explanation:</strong>
                  <span className="text-gray-600"> Instead of searching a database for "movies similar to what you watched" (what Netflix does), the diffusion model <em>imagines</em> new movie profiles that bridge everyone's tastes — like a creative compromise that doesn't exist in any lookup table.</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-indigo-100">
                  <strong className="text-indigo-700">Technical detail:</strong>
                  <span className="text-gray-600"> Conditional DDPM denoises from N(0,I) into movie embedding space, conditioned on group taste vector. 100 candidates, 50 DDIM steps, guidance=1.5. Nearest real movies retrieved via cosine similarity to generated embeddings.</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
