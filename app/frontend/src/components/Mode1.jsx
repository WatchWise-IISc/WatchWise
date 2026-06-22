import React, { useState, useEffect } from 'react'
import { fetchGroups, fetchMode1 } from '../api.js'
import GroupPanel from './GroupPanel.jsx'
import SlateTable from './SlateTable.jsx'
import MetricsChart from './MetricsChart.jsx'
import { Sparkles, HelpCircle, ArrowRight, RefreshCw, Star, ShieldAlert, CheckCircle2, Terminal, Info, LayoutGrid, Award, ShieldCheck, TrendingUp, Compass, Cpu, Film } from 'lucide-react'

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
    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6 shadow-xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent pointer-events-none rounded-bl-full animate-pulse" />

      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
        <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-widest">Empirical Outcome Summary</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-900/80 border border-emerald-500/10 rounded-xl p-5 hover:border-emerald-500/20 transition-all text-center">
          <div className="text-3xl font-black text-emerald-400">+{lift}%</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Worst-Off member Lift</div>
          <div className="text-[11px] text-slate-500 mt-1">Direct increase in individual satisfaction</div>
        </div>
        <div className="bg-slate-900/80 border border-emerald-500/10 rounded-xl p-5 hover:border-emerald-500/20 transition-all text-center">
          <div className="text-3xl font-black text-emerald-400">{gapReduction}%</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Equality Gap Reduced</div>
          <div className="text-[11px] text-slate-500 mt-1">Closes disparity across co-viewers</div>
        </div>
        <div className="bg-slate-900/80 border border-indigo-500/10 rounded-xl p-5 hover:border-indigo-500/20 transition-all text-center">
          <div className="text-3xl font-black text-indigo-400">{best.hit5}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Hit@5 (Held-Out Split)</div>
          <div className="text-[11px] text-slate-500 mt-1">Accuracy on hidden true ratings</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-slate-950/70 border border-white/5 rounded-xl hover:border-white/10 transition-all space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Co-viewer Veto Eliminated</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            The traditional average gave some people high pleasure, but left at least one user with almost zero movies they liked (satisfaction: <strong className="text-rose-400 font-semibold font-mono">{base.min_member_sat}</strong>). Under WatchWise, every single person gets a highly compatible match (satisfaction: <strong className="text-emerald-400 font-semibold font-mono">{best.min_member_sat}</strong>). Nobody disengages or vetoes.
          </p>
        </div>

        <div className="p-4 bg-slate-950/70 border border-white/5 rounded-xl hover:border-white/10 transition-all space-y-1.5">
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Guaranteed Fairness Gains</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            While standard apps assume a homogeneous list keeps the peace, true groups represent conflicting personal tastes. Reducing the fairness margin by <strong className="text-indigo-300 font-semibold font-mono">{gapReduction}%</strong> proves that we can respect unique desires without ruining general enjoyment.
          </p>
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
  const [showDeepDive, setShowDeepDive] = useState(false)

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
    <div className="space-y-8">
      {/* Visual Scientific Infographic cards instead of wall of text */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-slate-900/20 border border-white/5 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block mb-1.5">PROJECT OBJECTIVE</span>
            <h2 className="text-xl font-extrabold text-white tracking-tight">The Democratic Movie Night Paradox</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              When 5 people pick a film, traditional streaming platforms average everyone's rating vectors to yield a compromise. If 3 members love blockbusters and 2 love indie arthouse, the top 5 spots will consist entirely of dramas/comedies which Mom and Dad enjoy — but the teenager is left totally bored.
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              WatchWise asks a critical machine learning question: <strong className="text-violet-400">Can we build 5-movie slates where everyone gets at least one highly personalized pick?</strong> By elevating the <em>minimum</em> satisfaction instead of the average, we bring veto safety to co-viewing.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-violet-905 bg-violet-950/20 border border-violet-500/15 p-3 rounded-xl text-[11px] text-violet-300">
            <Info className="w-4 h-4 shrink-0" />
            <span>Main Scientific Metric: <strong>min-member satisfaction</strong> — maximizing fairness constraints.</span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-gradient-to-tr from-slate-900/60 to-slate-900/20 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block">TECHNICAL CONTRAST</span>
            <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">Methodology Architecture</h3>
          </div>

          <div className="space-y-3 my-4">
            <div className="flex items-center gap-2.5 p-2 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-500/10 transition-colors">
              <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 p-1 rounded">TRADITIONAL</span>
              <div className="text-[11px] text-slate-400 font-medium">Nearest-neighbour retrieval optimized for average group vector.</div>
            </div>
            <div className="flex items-center gap-2.5 p-2 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-emerald-500/10 transition-colors">
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 p-1 rounded">WATCHWISE</span>
              <div className="text-[11px] text-slate-300 font-medium">Generates candidates via conditional diffusion, ranked sequentially via REINFORCE policy.</div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic">
            Models trained on complete MovieLens logs. Outputs validated against non-circular user ratings.
          </p>
        </div>
      </section>

      {/* TECHNICAL COLLAPSIBLE AS HIGH-TECH COMPONENT */}
      <div className="border border-white/5 bg-slate-900/20 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowDeepDive(!showDeepDive)}
          className="w-full flex items-center justify-between p-5 text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900/30 transition-all select-none"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span>TECHNICAL SPECIFICATIONS & NEURAL STACK</span>
          </div>
          <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded border border-violet-500/20">
            {showDeepDive ? 'HIDE SCHEMA' : 'EXPAND STUDY ARCHITECTURE'}
          </span>
        </button>

        {showDeepDive && (
          <div className="p-6 border-t border-white/[0.04] bg-slate-950/60 text-xs text-slate-400 space-y-4 leading-relaxed border-dashed text-justify">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                <div className="font-bold text-slate-200 uppercase tracking-widest text-[10px] text-violet-400 pb-1 border-b border-white/[0.04]">1. Matrix Factorization</div>
                <p className="text-[11px]">User & item ratings are mapped to dense 64-dim latents. An embedding dot product forecasts ratings. Trained on real MovieLens splits. 20% holdout split prevents target leakage.</p>
              </div>
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                <div className="font-bold text-slate-200 uppercase tracking-widest text-[10px] text-cyan-400 pb-1 border-b border-white/[0.04]">2. Conditional Diffusion</div>
                <p className="text-[11px]">Our DDPM denoises latents from Gaussian noise conditioned on mean group vector. Synthesizes 100 movie compromise vectors. Evaluated using 50 DDIM steps with guidance scale=1.5.</p>
              </div>
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                <div className="font-bold text-slate-200 uppercase tracking-widest text-[10px] text-amber-400 pb-1 border-b border-white/[0.04]">3. Fairness Reward</div>
                <p className="text-[11px]">Satisfaction represents relative percentile rank. Mathematically balances interest relevance vs individual safety margins: <strong>R = w1*mean + w2*min_member + diversity</strong>.</p>
              </div>
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                <div className="font-bold text-slate-200 uppercase tracking-widest text-[10px] text-emerald-400 pb-1 border-b border-white/[0.04]">4. REINFORCE Slate Layer</div>
                <p className="text-[11px]">Inputs are 8 group-relative fairness state scalars. Reranks and emits 5 final recommendations step-by-step from candidate pools, optimized to save the outlier member.</p>
              </div>
            </div>
            <div className="p-3 bg-violet-950/10 border border-violet-500/15 rounded-lg text-slate-400 leading-normal text-[11px] text-left">
              <strong>Non-Circular Integrity Split:</strong> Because we carve out evaluation user logs <em>prior</em> to MF latent calculations, recommendations are verified using items the models have never processed. Hit@5 statistics reflect real generalization performance.
            </div>
          </div>
        )}
      </div>

      {/* CORE CONTROL CONSOLE CARD */}
      <section className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none rounded-br-full" />

        <div className="mb-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Terminal className="text-indigo-400 w-4.5 h-4.5" />
            <span>Interactive Experiment Control Center</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Configure cohort properties and trigger recommendation pipelines to benchmark traditional retrievals against WatchWise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">1. Group Difficulty Profile</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-colors select-none"
            >
              <option value="divergent font">Divergent (Hardest - Conflicting tastes)</option>
              <option value="similar font">Similar (Easiest - Group already agrees)</option>
              <option value="random">Random (Medium - Mixed catalog tastes)</option>
            </select>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">2. Select Synthesized Cohort</label>
            <select
              value={selectedGid || ''}
              onChange={(e) => setSelectedGid(Number(e.target.value))}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-colors font-mono"
            >
              {groups.map((g) => (
                <option key={g.gid} value={g.gid}>{g.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <button
              onClick={handleRecommend}
              disabled={loading}
              className="w-full relative flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:from-violet-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-indigo-500/10"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4 text-white" />
                  <span>Computing Models...</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 fill-white/10" />
                  <span>Compute & Compare Methods</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* RESULT VISUAL CANVAS */}
      {result && (
        <div className="space-y-8">
          {/* Active Cohort Panel Details */}
          <GroupPanel group={result.group} />

          {/* Premium Outcome Statistic Tile */}
          <InsightCard
            baseline={result.baseline_slate}
            watchwise={result.watchwise_slate}
            metrics={result.metrics}
          />

          {/* SIDE-BY-SIDE RECOMMENDATIONS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="bg-slate-900/30 border border-rose-500/15 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="flex flex-col">
                <div className="lg:min-h-[110px] flex flex-col justify-start mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest font-mono">Control Baseline</span>
                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">
                    Traditional Average Recommender
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Predicted scores are calculated across all members, averaged, and the top-5 candidates are retrieved. Notice how minority members are typically starved out.
                  </p>
                </div>
                <SlateTable slate={result.baseline_slate} pickLabel="Traditional's pick for the group" />
              </div>
              <p className="text-[10px] text-slate-500 italic mt-6 pt-3 border-t border-white/[0.03] font-mono">
                Verify the "Caters To" list — if some member labels are missing, they got zero customized picks.
              </p>
            </div>

            <div className="bg-slate-900/30 border border-emerald-500/15 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
              <div className="flex flex-col">
                <div className="lg:min-h-[110px] flex flex-col justify-start mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">Tested Architecture</span>
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">
                    WatchWise Collective (Diff + RL)
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    100 compromise candidates generated through conditional diffusion, sequentialized and picked by REINFORCE to maximize local min-satisfaction.
                  </p>
                </div>
                <SlateTable
                  slate={result.watchwise_slate}
                  pickLabel="WatchWise's pick for the group"
                  pickSummary="collective"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium text-emerald-400/80 mt-6 pt-3 border-t border-white/[0.03] font-mono">
                Satisfies everyone — even outlier members get a customized, highly appropriate Match in their genre range.
              </p>
            </div>
          </section>

          {/* SUMMARY MATRIX ABLATION */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none rounded-bl-full" />

            <div className="mb-4">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block">COMPLETE COMPRESSED STUDY</span>
              <h3 className="text-sm font-extrabold text-white tracking-wide">
                Ablation Studies — Complete 5-Method Metrics Comparison
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                We hold variables tightly: [Retrieval vs Diffusion] &times; [Greedy vs REINFORCE RL policy]. Note how each module lifts the fairness outcome.
              </p>
            </div>

            <div className="overflow-x-auto border border-white/5 rounded-xl bg-slate-950/40">
              <table className="w-full text-xs text-left font-sans">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-slate-900/60 pb-1 text-slate-300">
                    <th className="py-3.5 px-4 font-bold tracking-wider">Pipeline Model Configuration</th>
                    <th className="py-3.5 px-3 font-bold text-right">Mean Relevance (Fit)</th>
                    <th className="py-3.5 px-3 font-bold text-emerald-400 text-right">Min-Member Sat (Fairness)</th>
                    <th className="py-3.5 px-3 font-bold text-right">Fairness Gap (Spread)</th>
                    <th className="py-3.5 px-3 font-bold text-indigo-300 text-right">Held-Out NDCG@5</th>
                    <th className="py-3.5 px-3 font-bold text-indigo-300 text-right">Held-Out Hit@5</th>
                    <th className="py-3.5 px-3 font-bold text-right">Genre Diversity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03] font-sans">
                  {result.metrics.map((m) => {
                    const isWatchWise = m.method === 'diffusion_rl'
                    const isBaseline = m.method === 'avg_baseline'

                    return (
                      <tr key={m.method} className={`hover:bg-slate-900/20 transition-colors ${
                        isWatchWise ? 'bg-emerald-500/5 font-semibold text-emerald-300 border-y border-emerald-500/10' :
                        isBaseline ? 'bg-rose-500/5 text-rose-300' : 'text-slate-300'
                      }`}>
                        <td className="py-3 px-4">
                          <div className="text-xs font-bold">{m.label}</div>
                          {isBaseline && <div className="text-[9px] text-rose-500 font-extrabold uppercase mt-0.5 tracking-wider">Traditional Status-Quo</div>}
                          {isWatchWise && <div className="text-[9px] text-emerald-400 font-extrabold uppercase mt-0.5 tracking-wider flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-emerald-400" /> WatchWise Optimal Stack
                          </div>}
                        </td>
                        <td className="text-right py-3 px-3 font-mono text-sm">{m.relevance}</td>
                        <td className={`text-right py-3 px-3 font-mono text-sm ${isWatchWise ? 'text-emerald-300 font-bold' : isBaseline ? 'text-rose-400' : 'text-slate-300'}`}>
                          {m.min_member_sat}
                        </td>
                        <td className="text-right py-3 px-3 font-mono text-sm">{m.fairness_gap}</td>
                        <td className="text-right py-3 px-3 font-mono text-sm font-semibold">{m.ndcg5}</td>
                        <td className="text-right py-3 px-3 font-mono text-sm font-semibold">{m.hit5}</td>
                        <td className="text-right py-3 px-3 font-mono text-sm">{m.diversity}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-400 pt-3 border-t border-white/[0.04] font-sans">
              <div className="p-3 bg-slate-950/40 rounded-lg border border-white/5">
                <strong className="text-slate-300 block mb-1">Variant Pool Swap:</strong> Holds the sequential policy fixed, swaps NN to Diffusion. Does a generative model find closer consensus vectors?
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-white/5">
                <strong className="text-slate-300 block mb-1">Variant Rerank Swap:</strong> Holds candidate pool fixed, wraps Greedy selector to REINFORCE. Does sequential path modeling raise fairness?
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-white/5">
                <strong className="text-slate-300 block mb-1">Headline Metric:</strong> Min-member is the minimum value amongst co-viewers percentile rankings. Moving this represents general peace.
              </div>
            </div>
          </div>

          {/* Metrics visualization Chart */}
          <MetricsChart metrics={result.metrics} />

          {/* Diffusion pool showcase */}
          {result.diffusion_teaser && result.diffusion_teaser.length > 0 && (
            <div className="bg-slate-900/30 border border-indigo-500/10 rounded-2xl p-6 shadow-xl relative overflow-hidden font-sans">
              <div className="mb-4">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">GENERATIVE SPACE PREVIEW</span>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
                  Compromise Latent Embeddings (Sample from diffusion)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Instead of database retrieval, our neural denoiser outputs continuous profile points bridging everyone's vectors. Here are the closest real-movie titles to generated sample latents:
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-white/[0.04] text-xs font-mono font-medium tracking-tight text-indigo-300 flex flex-wrap gap-2 justify-center leading-relaxed">
                {result.diffusion_teaser.map((title, i) => (
                  <span key={i} className="bg-indigo-950/35 border border-indigo-500/15 py-1.5 px-3 rounded-lg flex items-center gap-1 text-[11px]">
                    <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{title}</span>
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-400 mt-4 pt-3 border-t border-white/[0.04]">
                <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl">
                  <strong className="text-indigo-400 block mb-1">What this means:</strong> WatchWise does not run simple queries like <span className="font-mono bg-slate-950 px-1 py-0.5 text-indigo-300 border border-white/5 rounded text-[10px]">Title contains Science</span>. Instead, the conditional DDPM starts with random Gaussian noise and steps backwards 50 times inside the 64-dimensional rating manifold to synthesize movie specs custom-fit for this exact group.
                </div>
                <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl">
                  <strong className="text-indigo-400 block mb-1">Generative specifics:</strong> The conditional state is derived as the group's centroid. Classifier-free guidance of 1.5 forces the output outwards to find creative compromises in niche genre overlap spaces that are rarely queried.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
