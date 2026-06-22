import React, { useState, useEffect } from 'react'
import { fetchGroups, fetchMode2 } from '../api.js'
import GroupPanel from './GroupPanel.jsx'
import SlateTable from './SlateTable.jsx'

const REGIONS = [
  { code: 'IN', label: 'India (IN)', desc: 'Netflix, Disney+ Hotstar, Prime Video, Zee5, SonyLIV' },
  { code: 'US', label: 'United States (US)', desc: 'Netflix, Disney+, Hulu, Prime Video, Max' },
]

function Mode2Insight({ result }) {
  if (!result || !result.slate || result.slate.length === 0) return null

  const langSet = new Set(result.slate.map(m => m.language).filter(Boolean))
  const genreSet = new Set(result.slate.flatMap(m => m.genres.split(', ')))
  const membersCovered = new Set(result.slate.flatMap(m => m.best_for))

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
      <h3 className="text-base font-bold text-green-800 mb-3">Outcome Summary</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-green-700">{Math.round(result.match_rate * 100)}%</div>
          <div className="text-[10px] text-gray-600 mt-1">Constraint match rate</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-indigo-700">{result.slate.length}</div>
          <div className="text-[10px] text-gray-600 mt-1">Movies found</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-purple-700">{langSet.size}</div>
          <div className="text-[10px] text-gray-600 mt-1">Languages covered</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm">
          <div className="text-xl font-bold text-amber-700">{genreSet.size}</div>
          <div className="text-[10px] text-gray-600 mt-1">Genres in slate</div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-gray-700">
        <div className="p-3 bg-white rounded-lg border border-green-100">
          <strong className="text-green-700">In plain English:</strong> Every single movie in this list is
          (a) available on your streaming platforms right now, (b) in an acceptable language,
          (c) under your runtime limit, and (d) age-appropriate for the family — while STILL ensuring
          no family member is ignored. Traditional systems can't do both simultaneously.
        </div>
        <div className="p-3 bg-white rounded-lg border border-green-100">
          <strong className="text-green-700">Why this is hard:</strong> When you add platform/language/age
          constraints, the set of eligible movies shrinks dramatically. A traditional recommender that filters
          first might be left with only popular mainstream movies — killing diversity and fairness.
          WatchWise generates smart candidates THEN filters, so it finds hidden gems that satisfy constraints.
        </div>
      </div>
    </div>
  )
}

export default function Mode2() {
  const [region, setRegion] = useState('IN')
  const [kind, setKind] = useState('random')
  const [groups, setGroups] = useState([])
  const [selectedGid, setSelectedGid] = useState(null)
  const [allowTeen, setAllowTeen] = useState(true)
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
      const data = await fetchMode2(selectedGid, region, allowTeen)
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
            <strong>Imagine this:</strong> It's 8 PM on a Friday. Your family wants to watch something together
            — but it has to be (1) on a platform you actually pay for, (2) in a language everyone understands,
            (3) not too long, and (4) appropriate for the kids. Oh, and everyone should still enjoy it.
            Traditional recommenders ignore these constraints or apply them as an afterthought, leaving you with
            a terrible selection after filtering.
          </p>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          WatchWise applies the same fairness-aware engine from Mode 1, but adds <strong>hard real-world filters</strong>:
          platform availability, language, runtime, and age certification. Every pick is genuinely watchable tonight.
        </p>
      </div>

      {/* Traditional vs WatchWise */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Traditional vs WatchWise — With Constraints</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-lg p-5 border border-red-200">
            <h3 className="font-semibold text-red-800 text-sm mb-3">Traditional: Filter, Then Recommend</h3>
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>Step 1:</strong> Filter catalog to only movies on your platforms</p>
              <p><strong>Step 2:</strong> Remove movies not in your language</p>
              <p><strong>Step 3:</strong> Remove movies too long or not age-safe</p>
              <p><strong>Step 4:</strong> From what's left (maybe 200 movies from 10,000), recommend by average rating</p>
            </div>
            <div className="mt-3 p-2.5 bg-red-100 rounded text-xs text-red-800">
              <strong>The flaw:</strong> After aggressive filtering, you're left with only popular mainstream titles.
              No diversity, no personalization, no fairness. The minority-taste member gets even MORE ignored because
              niche movies that might serve them were filtered out.
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-5 border border-green-200">
            <h3 className="font-semibold text-green-800 text-sm mb-3">WatchWise: Recommend, Then Filter Smartly</h3>
            <div className="text-xs text-gray-700 space-y-2">
              <p><strong>Step 1:</strong> Generate 100 compromise candidates via diffusion (aware of group taste)</p>
              <p><strong>Step 2:</strong> Apply hard filters (platform, language, runtime, age)</p>
              <p><strong>Step 3:</strong> From filtered candidates, the fairness reranker picks the best slate</p>
              <p><strong>Step 4:</strong> Result: every movie is watchable AND fair to all members</p>
            </div>
            <div className="mt-3 p-2.5 bg-green-100 rounded text-xs text-green-800">
              <strong>The advantage:</strong> Because we generate a LARGE pool of smart candidates first,
              even after filtering we still have diverse, personalized options that serve every member.
              The pool was designed for this group — not a generic catalog.
            </div>
          </div>
        </div>
      </div>

      {/* Technical Deep-Dive */}
      <details className="bg-white rounded-xl shadow-sm border border-gray-200">
        <summary className="p-6 cursor-pointer text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors">
          Technical Deep-Dive — How Filtering Works (click to expand)
        </summary>
        <div className="px-6 pb-6 space-y-3 text-xs text-gray-600 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Hard Filters Applied</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Platform:</strong> Movie must be on at least one of the user's paid streaming services (via TMDb watch/providers API or offline fallback)</li>
                <li><strong>Language:</strong> original_language must be in the region's accepted list</li>
                <li><strong>Runtime:</strong> Must be at most max_runtime_min (150m for India/US)</li>
                <li><strong>Age cert:</strong> Must have a family-safe certification (U/UA for CBFC, G/PG for MPAA)</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">Why Generate-Then-Filter Wins</h4>
              <p>The diffusion model generates 100 candidates tailored to the group. Even after filtering removes 30-50% that don't match constraints, we still have 50-70 diverse, personalized options. Traditional filter-first approaches start with the entire catalog (generic) and filter down to a small, unrepresentative subset.</p>
              <p className="mt-2">This is particularly important for Indian users: multilingual content (Hindi, Tamil, English) + 5 platforms means the eligible set is large but scattered — generic popularity ranking misses gems.</p>
            </div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <h4 className="font-semibold text-indigo-800 mb-2">Constraint-Match Rate</h4>
            <p>We report the % of final slate movies that pass ALL hard filters. This should always be 100% — if it's not, the candidate pool was too small or constraints too restrictive. The system degrades gracefully: if nothing passes, it relaxes constraints in priority order.</p>
          </div>
        </div>
      </details>

      {/* Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-indigo-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Try It — Pick Region, Group, and Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <div className="space-y-2">
              {REGIONS.map((r) => (
                <label key={r.code} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                  region === r.code ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="region"
                    value={r.code}
                    checked={region === r.code}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-gray-500">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Difficulty</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="divergent">Divergent</option>
              <option value="similar">Similar</option>
              <option value="random">Random</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
            <select
              value={selectedGid || ''}
              onChange={(e) => setSelectedGid(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {groups.map((g) => (
                <option key={g.gid} value={g.gid}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowTeen}
                onChange={(e) => setAllowTeen(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Allow older-teen (UA/PG-13)</span>
            </label>
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
                  Filtering...
                </span>
              ) : 'Recommend (Filtered)'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          <GroupPanel group={result.group} />

          {/* Insight */}
          <Mode2Insight result={result} />

          {/* Watchlist */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              Streamable Family Watchlist
              <span className="text-xs font-normal text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                {Math.round(result.match_rate * 100)}% constraint match
              </span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Every movie below is available on your platforms, in your language, within runtime limit, and age-safe.
              The "Best For" column shows which member(s) each pick primarily serves.
            </p>
            <SlateTable slate={result.slate} showFilters={true} />
          </div>

          {/* What each column means */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Reading the Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong className="text-gray-800">Pred rating:</strong> Group's average predicted rating for this movie (higher = better for the group overall)
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong className="text-gray-800">Best For:</strong> Which member(s) this movie scores highest for — ensures everyone is covered
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <strong className="text-gray-800">Lang / Runtime / Cert:</strong> Proof that the hard filters passed — every movie is watchable tonight
              </div>
            </div>
          </div>

          {/* Region info */}
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">Filter Configuration Applied</h3>
            <div className="text-sm text-gray-700">
              <strong>{result.region.name}</strong> — Platforms: {result.region.platforms.join(', ')} |
              Languages: {result.region.languages.join(', ')} |
              Runtime: max {result.region.max_runtime}m |
              Family-safe certs: {result.region.family_safe_certs.join(', ')}
              {result.allow_teen && ' (+teen)'}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Availability as of {result.snapshot_date}. OTT/language/cert are offline-fallback labels
              (real TMDb data is used automatically when TMDB_API_KEY is set).
            </div>
          </div>
        </>
      )}
    </div>
  )
}
