import React, { useState, useEffect } from 'react'
import { fetchFamilies, fetchMode3 } from '../api.js'
import SlateTable from './SlateTable.jsx'
import { Sparkles, HelpCircle, RefreshCw, Star, Info, Cpu, Users, UserCheck, ArrowRight, Film, HelpCircle as HelpIcon } from 'lucide-react'

// Custom initial indicator helper
const getInitial = name => name ? name.trim().charAt(0).toUpperCase() : 'U'

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
    <div className="space-y-8 font-sans text-slate-100">
      {/* Information Header Block */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-slate-900/20 border border-white/5 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1.5 font-mono">ONBOARDING STRATEGY</span>
            <h2 className="text-xl font-extrabold text-white tracking-tight">The Cold-Start Onboarding Problem</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              When a brand new family registers on a streaming app, the collaborative filtering matrix is completely blind. They have logged zero ratings, zero likes, and zero viewing durations. 
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Most platforms suffer from <strong className="text-amber-400 font-medium">the cold start cliff</strong> — forcing users to rate 30 tedious movies or recommending basic globally popular blockbusters that treat all human beings identically.
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              WatchWise resolves this by allowing co-viewers to declare a few simple genre affinities. We immediately map these declared genres to the closest matching real users in the system, setting up a <strong className="text-amber-400 font-medium">cohort of proxies</strong> to generate immediate personal compromises.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-950/20 border border-amber-500/15 p-3 rounded-xl text-[11px] text-amber-300">
            <Info className="w-4 h-4 shrink-0" />
            <span>Avoids cold starts without tedious onboarding checklists.</span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-gradient-to-tr from-slate-900/60 to-slate-900/20 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">TECHNICAL CONTRAST</span>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">Cold-Start Solutions</h3>
          </div>

          <div className="space-y-3.5 my-4">
            <div className="flex items-start gap-2 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10 text-xs">
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 p-1 rounded font-mono">TRADITIONAL</span>
              <div className="text-slate-400 text-[11px] leading-normal">Requires extensive histories. Fails completely on day 1 or shows generic charts.</div>
            </div>
            <div className="flex items-start gap-2 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10 text-xs">
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 p-1 rounded font-mono">WATCHWISE</span>
              <div className="text-slate-300 text-[11px] leading-normal">Bypasses empty profiles via greedy mapping of members to active proxy vectors.</div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic">
            Integrates the latent rating behaviors of long-term power-users.
          </p>
        </div>
      </section>

      {/* DETAILED WORKING PROCESS OF COLD MAPPING */}
      <div className="border border-white/5 bg-slate-900/20 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.04] bg-slate-950/40 flex items-center gap-2">
          <Cpu className="w-4.5 h-4.5 text-amber-400 shrink-0" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Proxy User Affinity Mechanics</h4>
        </div>

        <div className="p-6 text-xs text-slate-400 space-y-4 leading-relaxed bg-slate-950/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="font-bold text-slate-200 block text-[11px]">1. Declared Genre Interests</span>
              <p className="text-[11px]">New users simply select 2-3 genres with zero numerical ratings. We vectorize this interest into a simple preference profile representing their nominal taste weights.</p>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-slate-200 block text-[11px]">2. Latent Database Querying</span>
              <p className="text-[11px]">We calculate average genre scores for thousands of real historical logs. We match new profile interests with real users whose rating averages inside preferred genres are consistently high.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-white/[0.03]">
            <div className="space-y-2">
              <span className="font-bold text-slate-200 block text-[11px]">3. Greedy ID Isolation</span>
              <p className="text-[11px]">To protect against redundancy, we implement greedy allocation. No two co-viewers are mapped to the identical database account, ensuring a colorful, healthy friction inside the recommendations.</p>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-slate-200 block text-[11px]">4. Generation & REINFORCE Slate Selection</span>
              <p className="text-[11px]">Once surrogate MF latent embeddings are retrieved, we run the DDPM generative pipeline to output compromise movies, filtered in real-time, exactly as in Mode 1.</p>
            </div>
          </div>
        </div>
      </div>

      {/* PRESET CHOOSE BOX */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none rounded-br-full" />
        
        <div className="mb-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Users className="text-amber-400 w-4.5 h-4.5" />
            <span>Select Hypothetical Family Presets</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Choose a mock profile representing typical living-room taste conflicts below to trace cold-start resolution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">1. Family Onboarding Scenario</label>
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              {families.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={handleRecommend}
              disabled={loading}
              className="w-full shrink-0 relative flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4 text-white" />
                  <span>Iterating proxy models...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 fill-white/15" />
                  <span>Synthesize Day 1 Recommendations</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current Family members preview */}
        {currentFamily && (
          <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-white/5 space-y-3">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nominal Genre Focus (Empty History profile)</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {currentFamily.members.map((m, i) => {
                const colors = [
                  'bg-violet-500/10 border-violet-500/20 text-violet-400',
                  'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
                  'bg-amber-500/10 border-amber-500/20 text-amber-400',
                ]
                const color = colors[i % colors.length]

                return (
                  <div key={m.name} className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${color}`}>
                      {getInitial(m.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100">{m.name}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{m.genres.join(', ')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* RESULTS DISPLAY CANVAS */}
      {result && (
        <div className="space-y-8">
          {/* Transition Mapping Explanation */}
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6 shadow-xl leading-relaxed">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent pointer-events-none rounded-bl-full animate-pulse" />
            
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-widest">Active Surrogate Assignments</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs z-10 relative">
              <div className="p-4 bg-slate-950/70 border border-white/5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Bootstrapping Cold Profiles</span>
                </div>
                <p className="text-slate-400 leading-normal">
                  Each newly introduced member is successfully paired with an active, genuine database user who exhibits heavy rating counts under target preferences. This maps their initial taste curves to complete records instantly.
                </p>
              </div>

              <div className="p-4 bg-slate-950/70 border border-white/5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Decaying Proxy Weight</span>
                </div>
                <p className="text-slate-400 leading-normal">
                  As the members explore, click, rate, and skip titles, self-recorded rating behaviors gradually gain priority — allowing the recommendation vectors to slide organically towards their genuine tastes.
                </p>
              </div>
            </div>
          </div>

          {/* ACTIVE ASSIGNMENTS TICKETS */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
              Day 1 Proxy User Ticket Assignments
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-normal">
              These fully-active profiles allow the generative DDPM model to construct a consensus space without waiting for tedious cold-start checklists.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.members.map((m, i) => {
                const ringColors = [
                  'border-violet-500/30 text-violet-400 bg-violet-500/10',
                  'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
                  'border-amber-500/30 text-amber-400 bg-amber-500/10',
                ]
                const color = ringColors[i % ringColors.length]

                return (
                  <div key={m.name} className="flex items-start gap-4 p-4 rounded-xl bg-slate-950 border border-white/5 relative overflow-hidden group hover:border-white/15 transition-all">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none rounded-bl-full" />
                    
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 border ${color}`}>
                      {getInitial(m.name)}
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <div className="text-xs font-bold text-slate-200">{m.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Proxy: User ID #{m.proxy_user}</div>
                      </div>
                      <div className="pt-2 border-t border-white/[0.04]">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Stated Desires</span>
                        <span className="text-[11px] text-slate-300 font-medium truncate block" title={m.genres.join(', ')}>
                          {m.genres.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* REC TABLE RESULTS */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Film className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Generative Compromise Board
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-normal">
              Consensus results generated by the diffusion and REINFORCE model stack using active proxy mappings. Notice how genres align exactly with stated needs.
            </p>
            <SlateTable slate={result.slate} pickLabel="Best for the family" />
          </div>

          {/* Validation honesty note */}
          <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl relative overflow-hidden">
            <h3 className="text-xs font-bold text-amber-200 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <HelpIcon className="w-4 h-4 text-amber-400" />
              <span>Usability & Metric Restrictions</span>
            </h3>
            <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <p>
                Please note that this recommendation result remains exclusively <strong>illustrative</strong> rather than measured. Because a day-one onboarding profile possesses zero rating behaviors, there are no historical holds we can carve out to benchmark empirical NDCG@5 or Hit@5 values.
              </p>
              <p>
                Its core function is functional proof — verifying that the continuous embedding profiles generated can satisfy extreme living room tensions when zero baseline histories exist.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
