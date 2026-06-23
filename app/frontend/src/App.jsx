import React, { useState } from 'react'
import Mode1 from './components/Mode1.jsx'
import Mode2 from './components/Mode2.jsx'
import Mode3 from './components/Mode3.jsx'
import { Film, Info, Layers, ShieldCheck, Sparkles, Tv, X } from 'lucide-react'

const TABS = [
  {
    id: 'mode1',
    label: 'Fairness Stress Test',
    short: 'Mode 1',
    desc: 'Worst-off satisfaction, held-out NDCG, and Hit@5',
    icon: ShieldCheck,
  },
  {
    id: 'mode2',
    label: 'OTT Constraints',
    short: 'Mode 2',
    desc: 'Streamable slates under real filters',
    icon: Tv,
  },
  {
    id: 'mode3',
    label: 'Cold Start Builder',
    short: 'Mode 3',
    desc: 'Custom members, genres, and proxy mapping',
    icon: Sparkles,
  },
]

const HEADER_STATS = {
  mode1: [
    { value: '25M', label: 'real movielens ratings', detail: 'Grounded in 25M authentic ratings (ml-25m). No synthetic preferences — real users, real held-out likes.' },
    { value: '3×', label: 'ndcg@5 vs nn retrieval', detail: 'On divergent groups, diffusion candidates + reranker recover ~3× more unseen relevant movies than pure NN retrieval.' },
    { value: 'DDPM', label: 'group-conditioned diffusion', detail: 'DDPM denoiser is conditioned on the group centroid embedding, generating compromise candidates that live between member tastes.' },
    { value: 'REINFORCE', label: 'slate-building rl', detail: 'Policy learns to pick full 5-movie slates optimizing composite reward (mean + min-member + diversity) in one sequential pass.' },
    { value: 'W2+MIN', label: 'worst-off fairness term', detail: 'Reward = w1·avg + w2·min(sat) + diversity terms. The min term explicitly lifts the usually-ignored family member.' },
    { value: '70/15/15', label: 'disjoint group splits', detail: 'RL trains on 70% of synthetic families and is measured only on completely unseen groups — no group-level leakage.' },
  ],
  mode2: [
    { value: '3', label: 'hard filters · ott · runtime · age', detail: 'OTT platforms, runtime ≤150 min and family-safe certs are applied to the pool before diffusion or scoring ever run.' },
    { value: 'PRE', label: 'filters before scoring', detail: 'Constraints shrink the candidate universe that the generator and reranker consider — guarantees every slate is watchable tonight.' },
    { value: '4', label: 'method stacks scored', detail: 'Baseline / NN / diffusion / RL all evaluated on identical filtered pools so differences are apples-to-apples.' },
    { value: 'Hit@5', label: 'hidden relevance check', detail: 'Even under real-world filters we still report non-circular Hit@5 against each member’s held-out ratings.' },
    { value: 'W2', label: 'fairness still active', detail: 'Max-min protection remains inside the reranker even when OTT + age hard gates are present.' },
    { value: 'IN/US', label: 'region aware', detail: 'Same engine serves India (Netflix/Hotstar/Prime/Zee5/SonyLIV) and US (Netflix/Prime/Hulu/Max) via cached providers.' },
  ],
  mode3: [
    { value: 'CUSTOM', label: 'dynamic member sets', detail: 'Add or remove members and select genres on the fly; each submitted profile triggers a fresh proxy match and slate inference.' },
    { value: '0', label: 'required prior ratings', detail: 'Cold-start families need zero prior ratings; a short hand-authored profile is projected into the existing MF space.' },
    { value: 'PROXY', label: 'embedding space match', detail: 'New members are mapped to nearest real MovieLens users by content + stated taste — then treated as a normal group.' },
    { value: 'HYBRID', label: 'nn + diffusion pool', detail: 'Cold-start uses both retrieval and generated candidates so the slate isn’t limited to what similar users already rated.' },
    { value: 'RL', label: 'fair cold-start slate', detail: 'Even with proxy users the REINFORCE policy still protects the worst-off member of the new family.' },
    { value: 'K=5', label: 'compact watchlist', detail: 'Always returns a tight 3-5 movie slate — the size families can realistically decide on for “tonight”.' },
  ],
}

export default function App() {
  const [activeTab, setActiveTab] = useState('mode1')
  const [showDocSidebar, setShowDocSidebar] = useState(false)
  const [insight, setInsight] = useState(null)
  const activeMeta = TABS.find((tab) => tab.id === activeTab) || TABS[0]
  const headerStats = HEADER_STATS[activeTab] || HEADER_STATS.mode1

  return (
    <div className="min-h-screen grid-bg-swiss text-[#1A1A1A] selection:bg-[#EA580C] selection:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-4 md:px-8 md:py-8">
        <header className="border-b-2 border-[#1A1A1A] pb-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-7">
              <div className="mb-4 inline-flex items-center gap-2 bg-[#1A1A1A] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                <Film className="h-3.5 w-3.5" />
                Fair group recommender
              </div>
              <h1 className="swiss-display text-6xl md:text-8xl xl:text-9xl">
                WatchWise
              </h1>
              <div className="mt-3 font-display text-2xl font-extrabold uppercase leading-tight tracking-tight text-[#1A1A1A] md:text-4xl">
                The Anti-Veto
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#505051] md:text-base">
                A structural screening interface designed to unify divergent cinema preferences using fairness-aware multi-objective optimization.
              </p>
              <div className="mt-5 grid max-w-4xl grid-cols-1 gap-2 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#404040] md:grid-cols-3">
                <div className="border-l-4 border-[#EA580C] bg-white px-3 py-2">
                  Custom model: 128D MF embeddings trained on MovieLens-25M with a 20% hidden-rating holdout.
                </div>
                <div className="border-l-4 border-[#1A1A1A] bg-white px-3 py-2">
                  Generator: conditional DDPM, 500 noise steps, 120 training epochs, 100-step DDIM inference.
                </div>
                <div className="border-l-4 border-[#EA580C] bg-white px-3 py-2">
                  Slate policy: hybrid NN plus diffusion pool, 120 candidates, 20K RL episodes, K=5 fairness reward.
                </div>
              </div>
            </div>

            <div className="swiss-panel flex flex-col p-4 font-mono text-xs lg:col-span-5">
              <div className="flex items-center justify-between border-b border-black/15 pb-2">
                <span className="text-[#707070]">WATCHWISE MODEL CARD</span>
                <span className="font-extrabold uppercase tracking-widest text-[#EA580C]">{activeMeta.short}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
                {headerStats.map((stat) => {
                  const isActive = insight && insight.label === stat.label && insight.tab === activeTab
                  return (
                    <div
                      key={`${activeTab}-${stat.label}`}
                      onClick={() => setInsight({ ...stat, tab: activeTab })}
                      className={`cursor-pointer border bg-white px-3 py-2 transition-all active:scale-[0.985] ${isActive ? 'border-[#EA580C] ring-1 ring-[#EA580C]/30 bg-[#fffaf5]' : 'border-black/15 hover:border-[#EA580C]/50 hover:bg-[#faf8f4]'}`}
                    >
                      <div className="font-display text-lg lg:text-xl font-extrabold uppercase tracking-tighter text-[#1A1A1A]">
                        {stat.value}
                      </div>
                      <div className="mt-0.5 text-[9px] font-extrabold uppercase tracking-widest text-[#606060]">
                        {stat.label}
                      </div>
                    </div>
                  )
                })}
              </div>
              {insight && (
                <div className="mt-2 border-l-2 border-[#EA580C] bg-[#fffaf5] px-2 py-1 text-[9px] leading-snug tracking-normal text-[#404040]">
                  <span className="font-extrabold text-[#B84309]">{insight.value} {insight.label.toUpperCase()}</span> — {insight.detail}
                </div>
              )}
              {!insight && (
                <div className="mt-2 border-l-2 border-[#EA580C]/40 bg-white/60 px-2 py-1 text-[9px] leading-snug tracking-normal text-[#505050]">
                  Click any tile to see how this element drives WatchWise’s fairness-aware group compromise.
                </div>
              )}
              <div className="mt-3 border border-[#CFE1D9] bg-[#F4FBF8] p-4 text-[#1F5B43]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono text-[11px] font-extrabold uppercase tracking-widest">
                    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1F5B43] opacity-35" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1F5B43]" />
                    </span>
                    <span>Active inference stack</span>
                  </div>
                  <span className="shrink-0 bg-[#E4F1EB] px-2 py-1 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#1F5B43]">
                    {activeMeta.short.replace('Mode ', 'Mode 0')}
                  </span>
                </div>
                <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-[#718175]">
                  Latent compilation:
                </div>
                <div className="mt-1 whitespace-nowrap font-display text-lg font-extrabold leading-tight tracking-tight text-[#253042] xl:text-xl">
                  128D MF Embeddings → Conditional DDPM Pool
                </div>
                <div className="mt-4 border-t border-[#CFE1D9] pt-4">
                  <p className="text-[13px] font-medium leading-relaxed text-[#1F5B43]">
                    A fairness-aware RL slate policy reranks candidate vectors for group relevance while guarding worst-off member satisfaction thresholds.
                  </p>
                </div>
                <div className="mt-4 border-t border-[#CFE1D9]" />
              </div>
              <div className="min-h-3 flex-1" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setShowDocSidebar(true)}
                className="mt-3 w-full swiss-button-secondary"
              >
                <Info className="h-3.5 w-3.5" />
                Project Blueprint Spec
              </button>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {TABS.map((tab, index) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveTab(tab.id); setInsight(null) }}
                  className={`group border p-4 text-left transition-colors ${
                    isActive
                      ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                      : 'border-black/20 bg-[#FAF9F6] text-[#1A1A1A] hover:border-[#1A1A1A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`font-mono text-[10px] font-extrabold uppercase tracking-widest ${isActive ? 'text-white/65' : 'text-[#EA580C]'}`}>
                        {String(index + 1).padStart(2, '0')} // {tab.short.toUpperCase()}
                      </div>
                      <div className="mt-2 flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-tight">
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </div>
                      <div className={`mt-1 text-xs ${isActive ? 'text-white/70' : 'text-[#606060]'}`}>
                        {tab.desc}
                      </div>
                    </div>
                    <span className={`font-mono text-[10px] font-extrabold ${isActive ? 'text-[#EA580C]' : 'text-[#909090]'}`}>
                      {tab.short.toUpperCase()}
                    </span>
                  </div>
                </button>
              )
            })}
          </nav>
        </header>

        <main className="flex-1 py-8">
          {activeTab === 'mode1' && <Mode1 />}
          {activeTab === 'mode2' && <Mode2 />}
          {activeTab === 'mode3' && <Mode3 />}
        </main>

        <footer className="border-t-2 border-[#1A1A1A] py-6 font-mono text-[10px] uppercase tracking-widest text-[#606060]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span>WatchWise // Fairness-Aware Group Movie Recommender</span>
            <span>MovieLens Ratings // Diffusion Candidates // Reinforce Slate Layer</span>
          </div>
        </footer>
      </div>

      {showDocSidebar && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1A1A1A]/45" onClick={() => setShowDocSidebar(false)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l-4 border-[#1A1A1A] bg-[#F7F6F0] p-6 text-[#1A1A1A]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4 border-b-2 border-[#1A1A1A] pb-4">
              <div>
                <div className="flex items-center gap-2 swiss-section-title">
                  <Layers className="h-4 w-4" />
                  System Specs
                </div>
                <h3 className="mt-2 font-display text-2xl font-extrabold uppercase tracking-tighter">
                  WatchWise Blueprint
                </h3>
              </div>
              <button type="button" onClick={() => setShowDocSidebar(false)} className="swiss-button-secondary px-3">
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="space-y-5 text-sm leading-relaxed text-[#505051]">
              <div className="swiss-panel-strong p-4">
                <div className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">
                  How to read validation
                </div>
                <p className="mt-2">
                  Twenty percent of every user's ratings are hidden as a non-circular holdout before matrix factorization. NDCG@5 and Hit@5 are calculated only against these unseen real ratings.
                </p>
              </div>

              <div className="swiss-panel p-4">
                <h4 className="mb-3 border-b border-black/15 pb-2 font-display text-lg font-extrabold uppercase tracking-tight">
                  Ablation Controls
                </h4>
                <div className="space-y-3 font-mono text-xs uppercase text-[#404040]">
                  <p><strong className="text-[#EA580C]">1. avg_baseline:</strong> nearest-neighbour candidates with average user ratings.</p>
                  <p><strong className="text-[#EA580C]">2. nn_greedy:</strong> nearest-neighbour pool with greedy fairness reranking.</p>
                  <p><strong className="text-[#EA580C]">3. diffusion_greedy:</strong> generated candidates with greedy reranking.</p>
                  <p><strong className="text-[#EA580C]">4. nn_rl:</strong> traditional pool with REINFORCE slate selection.</p>
                  <p><strong className="text-[#EA580C]">5. diffusion_rl:</strong> WatchWise generated candidates with REINFORCE slate selection.</p>
                  <p><strong className="text-[#EA580C]">6. hybrid_rl:</strong> nearest-neighbour and diffusion pools combined before REINFORCE slate selection.</p>
                </div>
              </div>

              <div className="swiss-panel p-4">
                <h4 className="mb-2 font-display text-lg font-extrabold uppercase tracking-tight">
                  Core Claim
                </h4>
                <p>
                  The app compares whether a conditional diffusion generator produces fairer group movie choices than nearest-neighbour retrieval when both are passed through the same evaluation logic.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
