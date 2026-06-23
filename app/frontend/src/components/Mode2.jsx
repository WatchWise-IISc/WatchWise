import React, { useState, useEffect } from 'react'
import { fetchGroups, fetchMode2 } from '../api.js'
import GroupPanel from './GroupPanel.jsx'
import SlateTable from './SlateTable.jsx'
import { Sparkles, CheckCircle, RefreshCw, Tv, Info, ToggleLeft, ToggleRight, Filter, Globe, Play } from 'lucide-react'

const REGIONS = [
  {
    code: 'IN',
    label: 'India (IN)',
    desc: 'Netflix, Hotstar, Prime, Zee5, SonyLIV',
    flags: '🇮🇳',
    providers: ['Netflix', 'Disney+ Hotstar', 'Amazon Prime Video', 'Zee5', 'SonyLIV'],
  },
  {
    code: 'US',
    label: 'United States (US)',
    desc: 'Netflix, Disney+, Hulu, Prime, Max',
    flags: '🇺🇸',
    providers: ['Netflix', 'Disney+', 'Hulu', 'Amazon Prime Video', 'Max'],
  },
]

function Mode2Insight({ result }) {
  const slate = result?.watchwise_slate || result?.slate || []
  if (!result || slate.length === 0) return null

  const selectedProviders = result.selected_providers || result.region?.platforms || []
  const genreSet = new Set(slate.flatMap(m => m.genres.split(', ')))

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6 shadow-xl leading-relaxed">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent pointer-events-none rounded-bl-full animate-pulse" />
      
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-emerald-400" />
        <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-widest">Filter Optimization Results</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="bg-slate-900/80 border border-emerald-500/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-emerald-400">{Math.round(result.match_rate * 100)}%</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Constraint Match</div>
        </div>
        <div className="bg-slate-900/80 border border-emerald-500/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-indigo-400">{slate.length}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Movies Emitted</div>
        </div>
        <div className="bg-slate-900/80 border border-emerald-500/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-cyan-400">{selectedProviders.length}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">OTT Services</div>
        </div>
        <div className="bg-slate-900/80 border border-emerald-500/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-amber-400">{genreSet.size}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Genres Covered</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-slate-950/70 border border-white/5 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Guaranteed Legitimate Selection</span>
          </div>
          <p className="text-slate-400 leading-normal">
            Every recommendation is limited to the OTT services selected above, then checked for certification and runtime. The baseline and WatchWise slate now compete inside the same streamable catalog slice.
          </p>
        </div>

        <div className="p-4 bg-slate-950/70 border border-white/5 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Smart Candidate Pruning</span>
          </div>
          <p className="text-slate-400 leading-normal">
            Instead of searching an already heavily compressed subset of popular movies, WatchWise synthesizes 100 specialized vectors from scratch, applies constraints, and picks the most equitable combination. This maintains highly specific indie alternatives in the search space.
          </p>
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
  const [selectedProviders, setSelectedProviders] = useState(REGIONS[0].providers)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showFiltersDeepDive, setShowFiltersDeepDive] = useState(false)
  const currentRegion = REGIONS.find((r) => r.code === region) || REGIONS[0]
  const canRun = Boolean(selectedGid) && selectedProviders.length > 0

  useEffect(() => {
    fetchGroups(kind).then((data) => {
      setGroups(data.groups)
      if (data.groups.length > 0) setSelectedGid(data.groups[0].gid)
    })
  }, [kind])

  useEffect(() => {
    setSelectedProviders(currentRegion.providers)
    setResult(null)
  }, [region])

  const toggleProvider = (provider) => {
    setResult(null)
    setSelectedProviders((prev) => {
      if (prev.includes(provider)) {
        return prev.filter((p) => p !== provider)
      }
      return [...prev, provider]
    })
  }

  const handleRecommend = async () => {
    if (!canRun) return
    setLoading(true)
    setResult(null)
    try {
      const data = await fetchMode2(selectedGid, region, allowTeen, selectedProviders)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const watchwiseSlate = result?.watchwise_slate || result?.slate || []
  const baselineSlate = result?.baseline_slate || []
  const visibleProviders = result?.selected_providers || selectedProviders

  return (
    <div className="space-y-8 font-sans text-slate-100">
      {/* Informative Header Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-slate-900/20 border border-white/5 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1.5">STREAMABILITY ENGINE</span>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Coping with Real-World Constraints</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              In reality, a wonderful movie recommendation is useless if you don't subscribe to the streaming service, or if the film runs 3 hours on a weeknight, or has certifications entirely unsafe for the youngsters in the living room.
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              WatchWise Mode 2 handles these factors head-on by feeding generated candidate spaces through complex real-world filters: <strong className="text-cyan-400 font-medium">localized OTT provider availability</strong>, <strong className="text-cyan-400 font-medium">certification brackets</strong>, and <strong className="text-cyan-400 font-medium">runtime strictness</strong>.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-cyan-950/20 border border-cyan-500/15 p-3 rounded-xl text-[11px] text-cyan-300">
            <Info className="w-4 h-4 shrink-0" />
            <span>Ensures 100% genuine streamability without sacrificing individual fairness metrics.</span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-gradient-to-tr from-slate-900/60 to-slate-900/20 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">PIPELINE ADAPTATION</span>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">Pruning Sequence</h3>
          </div>

          <div className="space-y-3.5 my-4">
            <div className="flex items-center gap-2.5 p-2.5 bg-rose-500/5 rounded-xl border border-rose-500/10 text-xs">
              <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded uppercase font-mono">Filter-First</span>
              <div className="text-slate-400 text-[11px]">Filters down catalog first. Personalization decays into a few generic mainstream items.</div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-xs">
              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase font-mono">WatchWise</span>
              <div className="text-slate-300 text-[11px]">Generates 100 compromise vectors first, then applies constraints. Personalizes deep gems.</div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic block mt-1">
            Leverages TMDB real-time localized caches to map stream paths dynamically.
          </p>
        </div>
      </section>

      {/* TECHNICAL COLLAPSIBLE */}
      <div className="border border-white/5 bg-slate-900/20 rounded-2xl overflow-hidden">
        <button 
          onClick={() => setShowFiltersDeepDive(!showFiltersDeepDive)}
          className="w-full flex items-center justify-between p-5 text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900/30 transition-all select-none"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>CRITERIA PARSING SCHEMA & LOGISTICS</span>
          </div>
          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
            {showFiltersDeepDive ? 'HIDE SCHEMA' : 'EXPAND CRITERIA PARSER'}
          </span>
        </button>

        {showFiltersDeepDive && (
          <div className="p-6 border-t border-white/[0.04] bg-slate-950/60 text-xs text-slate-400 space-y-4 leading-relaxed border-dashed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                <div className="font-bold text-slate-200 uppercase tracking-widest text-[10px] text-cyan-400 pb-1 border-b border-white/[0.04]">Aggressive Constraints Imposed</div>
                <ul className="space-y-1 list-disc list-inside text-slate-300 text-[11px]">
                  <li><strong>Subscribed OTT:</strong> Retains only movies streaming in Region on user services (via TMDb API)</li>
                  <li><strong>Provider intersection:</strong> Keeps movies found on at least one selected OTT subscription</li>
                  <li><strong>Strict limit:</strong> Runtime must remain under max_runtime_min (e.g. 150m)</li>
                  <li><strong>Family Rating:</strong> Must match CBFC (U/UA) or MPAA (G/PG) ratings</li>
                </ul>
              </div>
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                <div className="font-bold text-slate-200 uppercase tracking-widest text-[10px] text-cyan-400 pb-1 border-b border-white/[0.04]">Why this is technically superior</div>
                <p className="text-[11px]">By generating a large 100-dimensional continuous pool adapted to group tastes first, even after filters eliminate 35% of options, we are left with 65 incredibly precise items. Under old methods, filtering first leaves less than 1% of catalog items, meaning users get recommended simple generic blockbusters.</p>
              </div>
            </div>
            <div className="p-3 bg-cyan-950/10 border border-cyan-500/15 rounded-lg text-[11px] text-slate-400">
              <strong>Provider-aware filtering:</strong> The selected subscriptions become hard constraints, so baseline and WatchWise are judged only on movies that can actually stream tonight.
            </div>
          </div>
        )}
      </div>

      {/* FILTER CONTROL CENTER */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none rounded-br-full" />
        
        <div className="mb-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Globe className="text-cyan-400 w-4.5 h-4.5" />
            <span>Interactive Constraint Matrix</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Specify local geography filters together with group properties to run the constrained recommendation pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-stretch">
          {/* Region */}
          <div className="lg:col-span-4 space-y-2">
            <label className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">1. Region Settings & Providers</label>
            <div className="grid grid-cols-1 gap-2">
              {REGIONS.map((r) => {
                const isSelected = region === r.code
                return (
                  <label key={r.code} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                    isSelected 
                      ? 'border-cyan-500/30 bg-cyan-500/5 text-white' 
                      : 'border-white/5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}>
                    <input
                      type="radio"
                      name="region"
                      value={r.code}
                      checked={isSelected}
                      onChange={(e) => setRegion(e.target.value)}
                      className="mt-1 h-3.5 w-3.5 accent-cyan-500"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <span>{r.flags}</span>
                        <span>{r.label}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{r.desc}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            <div className="mt-3 rounded-xl border border-white/5 bg-slate-950/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  OTT subscriptions
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProviders(currentRegion.providers)
                    setResult(null)
                  }}
                  className="text-[9.5px] font-bold uppercase tracking-wider text-cyan-300 hover:text-cyan-200"
                >
                  Select all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentRegion.providers.map((provider) => {
                  const checked = selectedProviders.includes(provider)
                  return (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => toggleProvider(provider)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                        checked
                          ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                          : 'border-white/10 bg-slate-900 text-slate-500 hover:border-white/20 hover:text-slate-300'
                      }`}
                    >
                      <CheckCircle className={`h-3.5 w-3.5 ${checked ? 'text-cyan-300' : 'text-slate-600'}`} />
                      <span>{provider}</span>
                    </button>
                  )
                })}
              </div>
              {selectedProviders.length === 0 && (
                <div className="mt-2 text-[10px] font-medium text-rose-300">
                  Select at least one provider to run constrained inference.
                </div>
              )}
            </div>
          </div>

          {/* Group Diff */}
          <div className="lg:col-span-3 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">2. Group Tension Kind</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="divergent">Divergent (Difficult)</option>
                <option value="similar">Similar (Consistent)</option>
                <option value="random">Random (Mixed)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">3. Choose Group</label>
              <select
                value={selectedGid || ''}
                onChange={(e) => setSelectedGid(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              >
                {groups.map((g) => (
                  <option key={g.gid} value={g.gid}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Teen allow & Button */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
              <div className="space-y-1 min-w-0">
                <span className="block text-xs font-bold text-slate-200">Older-Teen Ratings</span>
                <span className="block text-[10px] text-slate-500">Allow UA/CBFC, PG-13 classifications</span>
              </div>
              <button 
                onClick={() => setAllowTeen(!allowTeen)}
                className="text-cyan-400 focus:outline-none shrink-0"
              >
                {allowTeen ? (
                  <ToggleRight className="w-9 h-9" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-600" />
                )}
              </button>
            </div>

            <button
              onClick={handleRecommend}
              disabled={loading || !canRun}
              className="w-full relative flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-600 to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:from-cyan-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-indigo-500/10"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4 text-white" />
                  <span>Pruning candidates...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>{selectedProviders.length === 0 ? 'Select an OTT provider' : 'Generate Constrained slate'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* RESULT GRID */}
      {result && (
        <div className="space-y-8">
          <GroupPanel group={result.group} />

          <Mode2Insight result={result} />

          {/* Film watch list */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Verified Family Watchlist Tonight
                </h3>
              </div>
              <span className="text-[10px] uppercase font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                {Math.round(result.match_rate * 100)}% absolute constraint match rate
              </span>
            </div>
            
            <p className="text-xs text-slate-400 mb-4 leading-normal">
              Both slates are generated within the selected OTT set: <strong className="text-cyan-300">{visibleProviders.join(', ')}</strong>. The <strong className="text-indigo-400">Caters To</strong> tags show whose taste vectors are most directly served.
            </p>

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
                      Traditional Baseline
                    </h4>
                    <p className="text-[10px] text-slate-500">Average predicted score after identical OTT filtering.</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[9.5px] font-black uppercase tracking-wider text-rose-300">
                    {Math.round((result.baseline_match_rate ?? 0) * 100)}% match
                  </span>
                </div>
                <SlateTable slate={baselineSlate} showFilters={true} pickLabel="Baseline pick under selected OTT" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                      WatchWise Collective
                    </h4>
                    <p className="text-[10px] text-slate-500">Diffusion candidate slate optimized for equitable group fit.</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9.5px] font-black uppercase tracking-wider text-emerald-300">
                    {Math.round(result.match_rate * 100)}% match
                  </span>
                </div>
                <SlateTable
                  slate={watchwiseSlate}
                  showFilters={true}
                  pickLabel="WatchWise pick for the group"
                  pickSummary="collective"
                />
              </div>
            </div>
          </div>

          {/* Reading columns card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/10 border border-white/5 rounded-xl space-y-1">
              <strong className="text-xs text-slate-200 block font-bold">Predictive Rating</strong>
              <p className="text-[11px] text-slate-500 leading-normal">The overall predicted satisfaction. Higher denotes higher average appeal to the entire family cohort.</p>
            </div>
            <div className="p-4 bg-slate-900/10 border border-white/5 rounded-xl space-y-1">
              <strong className="text-xs text-slate-200 block font-bold">Caters To</strong>
              <p className="text-[11px] text-slate-500 leading-normal">Specifies precisely which extreme user taste profiles are directly satisfied by this item.</p>
            </div>
            <div className="p-4 bg-slate-900/10 border border-white/5 rounded-xl space-y-1">
              <strong className="text-xs text-slate-200 block font-bold">Hard Constraints Met</strong>
              <p className="text-[11px] text-slate-500 leading-normal">Confirms selected OTT availability, age rating, and clock-runtime parameters. Ready to play tonight without delay.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
