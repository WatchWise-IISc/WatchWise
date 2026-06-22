import React, { useState, useEffect } from 'react'
import { fetchFamilies, fetchMode3 } from '../api.js'
import SlateTable from './SlateTable.jsx'

export default function Mode3() {
  const [families, setFamilies] = useState([])
  const [selectedFamily, setSelectedFamily] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetchFamilies().then((data) => {
      setFamilies(data.families)
      if (data.families.length > 0) setSelectedFamily(data.families[0].name)
    })
  }, [])

  const handleRecommend = async () => {
    if (!selectedFamily) return
    setLoading(true)
    setResult(null)
    try {
      const data = await fetchMode3(selectedFamily)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const currentFamily = families.find((f) => f.name === selectedFamily)

  return (
    <div className="space-y-6">
      {/* Simple Explanation */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">The Problem We're Solving</h2>
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-900 leading-relaxed">
            <strong>Imagine this:</strong> A new family signs up for a movie recommendation service. They have
            ZERO watch history — no ratings, no clicks, nothing. They just say: "Dad likes action, Mom likes
            romance, Kid likes cartoons." Can the system still find a compromise movie night everyone enjoys?
          </p>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          This is the <strong>cold-start problem</strong> — the hardest challenge in recommender systems.
          Traditional systems fail completely here (they need ratings data to work). WatchWise handles it
          by mapping genre preferences to similar real users and running the same engine.
        </p>
      </div>

      {/* Traditional vs WatchWise */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Traditional vs WatchWise — Cold Start</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-lg p-5 border border-red-200">
            <h3 className="font-semibold text-red-800 text-sm mb-3">Traditional Recommender (Cold Start)</h3>
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>The problem:</strong> Collaborative filtering requires past ratings to find similar users.
                With zero history, there's nothing to compute similarity from.</p>
              <p><strong>Fallback 1:</strong> Show globally popular movies — not personalized at all</p>
              <p><strong>Fallback 2:</strong> Ask users to rate 20+ movies first — terrible onboarding experience</p>
              <p><strong>Result:</strong> Generic recommendations, no group fairness, high churn risk</p>
            </div>
            <div className="mt-3 p-2.5 bg-red-100 rounded text-xs text-red-800">
              <strong>The flaw:</strong> Without data, traditional systems are blind. They can't do group
              recommendation at all — let alone fair group recommendation.
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-5 border border-green-200">
            <h3 className="font-semibold text-green-800 text-sm mb-3">WatchWise (Cold Start)</h3>
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>Step 1:</strong> Each member declares preferred genres (e.g., "Action, Sci-Fi")</p>
              <p><strong>Step 2:</strong> System finds real users whose ratings best match those genre preferences</p>
              <p><strong>Step 3:</strong> These "proxy users" are treated as the group — same diffusion + RL pipeline</p>
              <p><strong>Result:</strong> Personalized, fair group recommendations from just genre preferences</p>
            </div>
            <div className="mt-3 p-2.5 bg-green-100 rounded text-xs text-green-800">
              <strong>The advantage:</strong> By leveraging the existing user base as proxies, we get
              instant personalization. As the family watches and rates, the system gradually transitions
              to their true profile — no "cold start cliff."
            </div>
          </div>
        </div>
      </div>

      {/* Technical Deep-Dive */}
      <details className="bg-white rounded-xl shadow-sm border border-gray-200">
        <summary className="p-6 cursor-pointer text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors">
          Technical Deep-Dive — How Cold-Start Mapping Works (click to expand)
        </summary>
        <div className="px-6 pb-6 space-y-3 text-xs text-gray-600 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Genre Affinity Mapping</h4>
              <p>For each real user in the training set, we compute their average rating within each genre.
                 This creates a "genre preference profile" per user. A new member saying "I like Action, Sci-Fi"
                 is matched to the real user whose mean Action + Sci-Fi ratings are highest.</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Proxy User Selection</h4>
              <p>We select distinct proxy users (no two members map to the same user) by greedy selection
                 sorted by affinity score. The proxy users already have MF embeddings — so the full diffusion +
                 RL pipeline runs unchanged. The system treats this as a normal group recommendation.</p>
            </div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="font-semibold text-yellow-800 mb-2">Honesty Note</h4>
            <p>This mode is <strong>illustrative, NOT measured</strong>. Since there are no real held-out ratings
               for a brand-new family, we cannot compute NDCG@5 or Hit@5. We show it to demonstrate the system
               is usable for cold-start — but the measured scientific claims come from Mode 1 only.
               In a production system, you would A/B test this against a popularity baseline.</p>
          </div>
        </div>
      </details>

      {/* Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-indigo-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Try It — Pick a Family Profile</h3>
        <p className="text-xs text-gray-500 mb-4">
          Each preset represents a realistic family with conflicting genre preferences.
          The system will map each member to a real user and generate a compromise watchlist.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Family Preset</label>
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {families.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRecommend}
              disabled={loading}
              className="w-full px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Mapping and recommending...
                </span>
              ) : 'Recommend for New Family'}
            </button>
          </div>
        </div>

        {/* Family preview */}
        {currentFamily && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">Family members (zero watch history):</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {currentFamily.members.map((m) => (
                <div key={m.name} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                  <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-medium text-xs shrink-0">
                    {m.name[0]}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-gray-500">{m.genres.join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* How it worked */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <h3 className="text-base font-bold text-green-800 mb-3">What Just Happened</h3>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="p-3 bg-white rounded-lg border border-green-100">
                <strong className="text-green-700">In plain English:</strong> Each family member's genre
                preferences were matched to a real MovieLens user who loves those genres. Then the full
                WatchWise engine (diffusion + RL) ran on these proxy users to find a compromise slate.
                The result is personalized immediately — no need for 20 ratings first.
              </div>
              <div className="p-3 bg-white rounded-lg border border-green-100">
                <strong className="text-green-700">Technically:</strong> Genre affinity scores (mean rating
                per genre per user) were computed across the training set. Each family member was matched to
                the highest-affinity user (greedy, distinct). The group recommendation pipeline then ran
                identically to Mode 1 (diffusion candidates, RL reranker, fairness-optimized slate).
              </div>
            </div>
          </div>

          {/* Mapped members */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Genre Preferences — Matched to Real Users
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Each family member was mapped to a real user whose taste best matches their stated genres.
              These proxy users have full rating histories — enabling the recommendation engine to work.
            </p>
            <div className="space-y-2">
              {result.members.map((m) => (
                <div key={m.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm shrink-0">
                    {m.name[0]}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{m.name}</strong>
                      <span className="text-xs text-gray-400">mapped to</span>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        Proxy User #{m.proxy_user}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Wants: {m.genres.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Watchlist */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Compromise Watchlist</h3>
            <p className="text-xs text-gray-500 mb-4">
              Generated by the same Diffusion + RL engine as Mode 1, using the proxy users.
              Check "Best For" — each member should have at least one movie that serves their taste.
            </p>
            <SlateTable slate={result.slate} />
          </div>

          {/* Honesty disclaimer */}
          <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">Important: Illustrative Only</h3>
            <div className="text-sm text-yellow-700 space-y-2">
              <p>
                This result is <strong>NOT measured</strong> (unlike Mode 1). A brand-new family has no
                ratings to hold out, so we cannot compute NDCG@5 or Hit@5. This demonstrates
                <em> usability</em> — the engine produces sensible output even from cold start.
              </p>
              <p>
                <strong>The measured scientific claim</strong> (diffusion+RL beats traditional on fairness)
                comes exclusively from Mode 1's held-out evaluation on real users with real ratings.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
