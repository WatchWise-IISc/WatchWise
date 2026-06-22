import React, { useState, useEffect } from 'react'
import Mode1 from './components/Mode1.jsx'
import Mode2 from './components/Mode2.jsx'
import Mode3 from './components/Mode3.jsx'
import { Layers, Tv, Sparkles, Brain, Info, Activity, Compass, Flame, Film } from 'lucide-react'

const TABS = [
  { 
    id: 'mode1', 
    label: 'Core Science', 
    short: 'Mode 1',
    desc: 'Measured comparison & metrics', 
    icon: Activity,
    badge: 'Validated',
    color: 'from-violet-500 to-indigo-500'
  },
  { 
    id: 'mode2', 
    label: 'OTT + Filters', 
    short: 'Mode 2',
    desc: 'Streamable & localized tonight', 
    icon: Tv,
    badge: 'Practical',
    color: 'from-cyan-500 to-indigo-500'
  },
  { 
    id: 'mode3', 
    label: 'Cold Start', 
    short: 'Mode 3',
    desc: 'Instant profile mapping', 
    icon: Sparkles,
    badge: 'Onboarding',
    color: 'from-amber-500 to-orange-500'
  },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('mode1')
  const [showDocSidebar, setShowDocSidebar] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden select-none">
      {/* Absolute Ambient Background Lights */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/5 blur-[180px] rounded-full" />
        <div className="absolute top-[40%] right-[10%] w-[35%] h-[35%] bg-cyan-500/5 blur-[150px] rounded-full" />
      </div>

      <div className="flex flex-col lg:flex-row relative z-10 min-h-screen">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-slate-900/40 backdrop-blur-xl flex flex-col justify-between p-6">
          <div className="space-y-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-indigo-500/20">
                <Film className="w-6 h-6 text-white" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                    WatchWise
                  </h1>
                  <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded-md">
                    2.0
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 tracking-wide font-medium">
                  FAIR GROUP RECOMMENDER
                </p>
              </div>
            </div>

            {/* Scientific Statement */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-white/5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Brain className="w-4 h-4 text-indigo-400" />
                <span>The Core Scientific Claim</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Does a <strong className="text-violet-400 font-medium">conditional diffusion generator</strong> produce fairer movie choices than <strong className="text-cyan-400 font-medium font-mono">nearest-neighbours</strong> when fed into an identical reranker?
              </p>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-2">
              <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-2 mb-3">
                Evaluation Engines
              </div>
              {TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all duration-300 text-left relative group ${
                      isActive
                        ? 'bg-slate-800 border-white/10 text-white shadow-xl shadow-slate-950/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                    }`}
                  >
                    {/* Left glow line */}
                    {isActive && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-violet-500 to-indigo-500 rounded-full" />
                    )}

                    <div className={`p-2 rounded-lg transition-all duration-300 ${
                      isActive 
                        ? 'bg-gradient-to-tr ' + tab.color + ' text-white shadow-md' 
                        : 'bg-slate-800/60 text-slate-400 group-hover:text-slate-300'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold tracking-tight">{tab.label}</span>
                        <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 border ${
                          isActive 
                            ? 'bg-white/10 border-white/10 text-white' 
                            : 'bg-slate-800/40 border-slate-700/50 text-slate-500'
                        }`}>
                          {tab.badge}
                        </span>
                      </div>
                      <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                        {tab.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Sidebar Footer Details */}
          <div className="mt-8 lg:mt-0 space-y-4 pt-4 border-t border-slate-900/80">
            <button
              onClick={() => setShowDocSidebar(!showDocSidebar)}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-900/50 transition-all font-medium"
            >
              <Info className="w-4 h-4 text-violet-400" />
              <span>Project Blueprint Spec</span>
            </button>

            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                API Engine Online
              </span>
              <span>v2.0.1</span>
            </div>
          </div>
        </aside>

        {/* MAIN BODY CANVAS */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
          {/* Header Dashboard Bar */}
          <header className="border-b border-slate-900/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold font-mono tracking-wider uppercase bg-slate-900 py-1 px-2.5 rounded-md border border-slate-800">
                {TABS.find(t => t.id === activeTab)?.short}
              </span>
              <span className="text-slate-500">/</span>
              <h2 className="text-sm font-bold text-slate-200">
                {TABS.find(t => t.id === activeTab)?.label} — {TABS.find(t => t.id === activeTab)?.desc}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 bg-indigo-500/5 border border-indigo-400/10 px-3 py-1.5 rounded-full text-xs text-indigo-300 font-medium">
                <Flame className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Phase 2 Live Evaluation</span>
              </div>
            </div>
          </header>

          {/* PAGE CONTENT PANEL */}
          <main className="flex-1 p-6 space-y-8 select-text">
            {activeTab === 'mode1' && <Mode1 />}
            {activeTab === 'mode2' && <Mode2 />}
            {activeTab === 'mode3' && <Mode3 />}
          </main>

          {/* FOOTER CANVAS */}
          <footer className="border-t border-slate-900 p-8 text-center text-xs text-slate-500 bg-slate-950 space-y-1 bg-gradient-to-t from-slate-900/20 to-transparent">
            <div>
              WatchWise 2.0 — Fairness-Aware Group Movie Recommender
            </div>
            <div className="text-[10px] text-zinc-600">
              Deep Learning Course Project · Grounded in real MovieLens ratings · Diffusion-generated compromise candidates vs traditional nearest-neighbour retrieval
            </div>
          </footer>
        </div>

        {/* DETAILS FLOATING DRAWER */}
        {showDocSidebar && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end transition-opacity" onClick={() => setShowDocSidebar(false)}>
            <div 
              className="w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 p-6 shadow-2xl overflow-y-auto space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-extrabold text-slate-100">WatchWise System Specs</h3>
                </div>
                <button 
                  onClick={() => setShowDocSidebar(false)}
                  className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300 transition-all"
                >
                  Close
                </button>
              </div>

              <div className="space-y-5 text-xs text-slate-300 leading-relaxed">
                <div className="space-y-1 bg-indigo-950/20 border border-indigo-500/10 p-4 rounded-xl">
                  <div className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                    How to read the validation
                  </div>
                  <p className="text-slate-400">
                    To maintain absolute scientific honesty, 20% of every user's ratings are hidden as a <strong className="text-indigo-300">non-circular holdout</strong> BEFORE matrix factorization. When evaluations report NDCG@5 and Hit@5, they are calculated ONLY against these unseen real ratings — proving the system learns genuine personal taste rather than simple database memorization.
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs tracking-wider uppercase border-b border-slate-800 pb-1.5">Ablation Controls</h4>
                  <p className="text-slate-400 text-[11px]">
                    To prove that conditional diffusion candidate generation and RL slate selection work, the system compares 5 distinct paths under identical conditions:
                  </p>
                  <ul className="space-y-2 list-none text-[11px]">
                    <li className="flex items-start gap-2 bg-slate-800/40 p-2 rounded-lg">
                      <span className="text-red-400 font-bold font-mono">1. avg_baseline:</span>
                      <span className="text-slate-400">Traditional nearest-neighbour candidate selection with standard averaging of user ratings. Highly biased towards popular titles, often stranding outlier tastes.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-slate-800/40 p-2 rounded-lg">
                      <span className="text-purple-400 font-bold font-mono">2. nn_greedy:</span>
                      <span className="text-slate-400">Nearest-Neighbour candidate pools with greedy fairness-constrained optimization.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-slate-800/40 p-2 rounded-lg">
                      <span className="text-blue-400 font-bold font-mono">3. diffusion_greedy:</span>
                      <span className="text-slate-400">Generates compromise candidate pools using conditional diffusion (DDPM) + greedy selections.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-slate-800/40 p-2 rounded-lg">
                      <span className="text-teal-400 font-bold font-mono">4. nn_rl:</span>
                      <span className="text-slate-400">Standard Nearest-Neighbour pools reranked by the REINFORCE sequential policy network.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-slate-800/40 p-2 rounded-lg">
                      <span className="text-emerald-400 font-bold font-mono">5. diffusion_rl:</span>
                      <span className="text-slate-400">The full WatchWise stack — conditional diffusion candidate pools selecting slates sequential on fairness REINFORCE policy.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-200 text-xs tracking-wider uppercase border-b border-slate-800 pb-1.5">Fairness Semantics</h4>
                  <p className="text-slate-400 text-[11px]">
                    How is group satisfaction measured? Rather than raw predicted ratings (which suffer from popularity skew), satisfaction defines each member's <strong className="text-indigo-300">percentile rank of the movie rating</strong> sorted within their own personal rating history profile. 
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    The reward function balances overall group pleasure (relevance) alongside minority-member safety:
                    <br />
                    <code className="block bg-slate-950 p-2 rounded border border-slate-800 mt-1 sm:text-center text-violet-300 font-mono text-[10px]">
                      R = w1 * mean_sat + w2 * min_member_sat + w3 * diversity - w4 * disagreement
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
