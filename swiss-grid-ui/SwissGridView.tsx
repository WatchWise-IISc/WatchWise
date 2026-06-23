import React, { useState, useEffect } from 'react';
import { CohortSet, Recommendation, AblationMethod } from '../types';
import { Play, Sparkles, AlertCircle, Table2, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; // or motion/react

interface SwissGridViewProps {
  selectedCohort: CohortSet;
  cohorts: CohortSet[];
  onSelectCohort: (id: string) => void;
  recommendations: Recommendation[];
  baselineMovies: string[];
  ablationMethods: AblationMethod[];
  latentSeeds: Array<{ seed: string; movie: string; similarity: string }>;
  isSimulating: boolean;
  onRunSimulation: () => void;
  simulationStep: number;
}

export default function SwissGridView({
  selectedCohort,
  cohorts,
  onSelectCohort,
  recommendations,
  baselineMovies,
  ablationMethods,
  latentSeeds,
  isSimulating,
  onRunSimulation,
  simulationStep,
}: SwissGridViewProps) {
  const steps = [
    '01 // INITIALIZING LATENT FIELD STATE',
    '02 // COMPUTING CANDIDATE COORDINATES',
    '03 // APPLYING REINFORCE UTILITY SCORING',
    '04 // RESOLVING OPTIMAL GROUP BARRIER',
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F0] text-[#1A1A1A] p-4 md:p-8 font-sans selection:bg-[#EA580C] selection:text-white transition-colors duration-500 relative grid-bg-swiss">
      
      {/* Swiss Header Grid */}
      <header className="border-b-2 border-black pb-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 text-left">
          <div className="inline-flex items-center gap-2 bg-black text-white px-2.5 py-0.5 text-xs font-mono tracking-widest uppercase mb-3">
            WATCHWISE VERSION 2.0 // SYSTEM SPEC
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tighter leading-none uppercase">
            Fairness-Aware<br />Cooperative Grouping
          </h1>
          <p className="mt-4 text-sm md:text-base text-[#505051] max-w-xl font-sans font-normal leading-relaxed">
            Swiss structural evaluation layout. This interface balances information density and typography to validate diffusion-generated models against classic collaborative baseline average models.
          </p>
        </div>
        <div className="border hover:border-black transition-colors border-dashed border-[#A0A0A0] p-4 flex flex-col justify-between font-mono text-xs text-left">
          <div>
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
              <span className="text-[#808080]">GRID LAYOUT</span>
              <span className="font-bold">SWISS MODERN 01</span>
            </div>
            <div className="space-y-1 text-[#404040]">
              <p>ACCENT: #EA580C CRIMSOM</p>
              <p>TYPOGRAPHY: SPACE GROTESK</p>
              <p>ALIGNMENT: OPTIMAL ASYMMETRIC</p>
            </div>
          </div>
          <div className="text-[10px] text-[#808080] mt-4">
            * STABLE VIEWPORT (RENDER MODE: CONTINUOUS)
          </div>
        </div>
      </header>

      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        
        {/* Left Column: Interactive Settings (4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Controls Box */}
          <div className="border-t-4 border-black bg-white p-6 rounded-none shadow-none border-x border-b border-black/10">
            <h2 className="text-xs font-mono font-bold tracking-wider text-[#ea580c] uppercase mb-4 flex items-center gap-1.5 pb-2 border-b border-gray-100">
              <Compass className="w-3.5 h-3.5" /> 1.0 CONTROLLER MATRIX
            </h2>
            
            <label className="block text-xs font-mono font-bold tracking-wide uppercase mb-2 text-[#404040]">
              SELECT COHORT PROFILE
            </label>
            <div className="space-y-2 mb-6">
              {cohorts.map((cohort) => {
                const isSelected = cohort.id === selectedCohort.id;
                return (
                  <button
                    key={cohort.id}
                    onClick={() => onSelectCohort(cohort.id)}
                    className={`w-full text-left p-3 border rounded-none transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-2 border-black bg-[#EA580C]/5 text-black font-semibold'
                        : 'border-gray-300 bg-transparent text-[#606060] hover:border-black hover:text-black'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-mono font-bold">{cohort.id.toUpperCase()}</div>
                      <div className="text-sm font-display tracking-tight mt-0.5">{cohort.name.split(' (')[0]}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-mono border ${
                      cohort.difficultyClass === 'error'
                        ? 'border-red-400 text-red-600 bg-red-50'
                        : cohort.difficultyClass === 'warning'
                        ? 'border-amber-400 text-amber-700 bg-amber-50'
                        : 'border-green-400 text-green-700 bg-green-50'
                    }`}>
                      {cohort.difficulty.split(' (')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[#606060] font-sans leading-relaxed mb-6 bg-[#F7F6F0] p-3 border-l-2 border-[#EA580C]">
              {selectedCohort.description}
            </p>

            <button
              disabled={isSimulating}
              onClick={onRunSimulation}
              className={`w-full py-4 px-6 text-sm font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSimulating
                  ? 'bg-[#EAEAEA] text-[#909090] cursor-not-allowed border border-gray-300'
                  : 'bg-black text-white hover:bg-[#EA580C]'
              } rounded-none`}
            >
              <Play className="w-4 h-4 fill-current" />
              {isSimulating ? 'SIMULATING STACK...' : 'COMPUTE & COMPARE METHODS'}
            </button>

            <AnimatePresence>
              {isSimulating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-dashed border-gray-200"
                >
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#EA580C] mb-1.5">
                    <span>STATUS: NEURAL RELAXATION</span>
                    <span>{Math.round((simulationStep / 4) * 100)}%</span>
                  </div>
                  <div className="h-1 bg-gray-100 overflow-hidden border border-gray-200">
                    <motion.div
                      className="h-full bg-[#EA580C]"
                      initial={{ width: '0%' }}
                      animate={{ width: `${(simulationStep / 4) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-gray-505 animate-pulse uppercase">
                    {steps[simulationStep - 1] || 'FINALIZING RERANKER INTEGRATION...'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Paradox Card */}
          <div className="border border-black bg-white p-6 rounded-none relative">
            <h3 className="text-sm font-display font-bold uppercase tracking-tight mb-2">
              The Democratic Movie Night Paradox
            </h3>
            <p className="text-xs text-[#505051] font-sans leading-relaxed mb-3">
              Traditional voting models prioritize central averages which alienates individual extreme states. Minimizing dissatisfaction ensures democratic alignment.
            </p>
            <div className="bg-[#1A1A1A] text-white p-3 font-mono text-[10px] tracking-wide flex items-start gap-2">
              <span className="text-[#EA580C] font-bold">#</span>
              <p>Primary Metric: min-member satisfaction — optimizing boundaries through joint collaborative fields.</p>
            </div>
          </div>

          {/* Seeds Box */}
          <div className="border border-black bg-white p-6 rounded-none">
            <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-gray-500 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" /> LATENT SPACE COMPROMISE EXTRACTIONS
            </h3>
            <div className="space-y-1.5 divide-y divide-gray-100">
              {latentSeeds.map((item, idx) => (
                <div key={idx} className="pt-2 text-[11px] font-mono flex items-start justify-between gap-2">
                  <span className="text-[#EA580C] bg-orange-50 px-1 font-bold">{item.seed}</span>
                  <span className="text-left text-[#303030] flex-1 line-clamp-1">{item.movie}</span>
                  <span className="text-[10px] text-[#808080] shrink-0 font-bold">{item.similarity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Main Dashboard (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Active Cohort Summary */}
          <div className="bg-white border-t-4 border-[#1A1A1A] border-x border-b border-black/10 p-6 rounded-none">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-gray-400 block uppercase">COHORT STRUCTURAL SUMMARY</span>
                <h3 className="text-xl font-display font-bold uppercase tracking-tight">{selectedCohort.name}</h3>
              </div>
              <span className="px-2 py-1 text-xs font-mono bg-[#EAEAEA] font-semibold">
                {selectedCohort.members.length} CO-VIEWERS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {selectedCohort.members.map((member) => (
                <div key={member.id} className="border border-gray-200 p-4 bg-[#FAF9F6] flex flex-col justify-between hover:border-black transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 font-bold">
                      <div className="w-3 h-3 shrink-0" style={{ backgroundColor: member.avatarColor }} />
                      <span className="font-mono text-xs">{member.name.split(' (')[0]}</span>
                    </div>
                    <div className="text-[10px] text-[#808080] uppercase font-mono">TOP GENRES:</div>
                    <div className="flex flex-wrap gap-1 mt-1 mb-3">
                      {member.topGenres.map((g, i) => (
                        <span key={i} className="text-[9px] font-mono bg-white border border-gray-200 px-1.5 py-0.5">
                          {g.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-2 border border-gray-100">
                    <span className="text-[8px] text-[#A0A0A0] font-mono block">ANCHORED FAVORITE:</span>
                    <p className="text-[10px] italic text-gray-800 line-clamp-1 mt-0.5">
                      "{member.anchoredFavorite}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Bar Graphs for Comparison */}
          <div className="bg-white border border-black p-6 rounded-none">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black mb-1">
              COHORT SATISFACTION INDEX COMPARISON
            </h3>
            <p className="text-xs text-gray-400 font-mono mb-6 uppercase">
              REVOLUTION RATIO (WATCHWISE MODEL Vs BASELINE MODEL)
            </p>
            
            <div className="space-y-4">
              {selectedCohort.members.map((member) => {
                const trPercent = Math.round(member.satisfactionTraditional * 100);
                const wwPercent = Math.round(member.satisfactionWatchWise * 100);
                
                return (
                  <div key={member.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-3 font-mono text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: member.avatarColor }} />
                      {member.name.split(' (')[0]}
                    </div>
                    
                    <div className="md:col-span-9 space-y-1">
                      {/* Traditional bar */}
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[9px] font-mono text-gray-400 text-right uppercase">TRADITIONAL:</span>
                        <div className="flex-1 h-3.5 bg-gray-100 rounded-none overflow-hidden relative border border-gray-200">
                          <motion.div
                            className="h-full bg-gray-400"
                            initial={{ width: '0%' }}
                            animate={{ width: `${trPercent}%` }}
                            transition={{ duration: 0.8 }}
                          />
                          <span className="absolute right-1 top-[1px] text-[8px] font-mono text-gray-600 font-bold">
                            {trPercent}%
                          </span>
                        </div>
                      </div>

                      {/* Watchwise bar */}
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[9px] font-mono text-[#EA580C] text-right font-bold uppercase">WATCHWISE:</span>
                        <div className="flex-1 h-4 bg-[#EA580C]/10 rounded-none overflow-hidden relative border border-[#EA580C]/20">
                          <motion.div
                            className="h-full bg-[#EA580C]"
                            initial={{ width: '0%' }}
                            animate={{ width: `${wwPercent}%` }}
                            transition={{ duration: 1 }}
                          />
                          <span className="absolute right-1.5 top-0.5 text-[9px] font-mono text-white font-extrabold select-none">
                            {wwPercent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-dashed border-gray-100 flex items-center gap-2 text-xs font-sans text-gray-500 bg-[#FAF9F6] p-3">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#EA580C]" />
              <p>
                <strong>Worst-Off Resolution:</strong> WatchWise model pulls the lowest member satisfaction level from <strong>{Math.round(Math.min(...selectedCohort.members.map(m => m.satisfactionTraditional)) * 100)}%</strong> up to <strong>{Math.round(Math.min(...selectedCohort.members.map(m => m.satisfactionWatchWise)) * 100)}%</strong>, removing veto triggers.
              </p>
            </div>
          </div>

          {/* Side-by-Side Slates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Control Model */}
            <div className="bg-white border-t-2 border-dashed border-gray-400 p-6 rounded-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[9px] font-mono bg-gray-200 text-gray-700 px-1.5 py-0.5 uppercase tracking-wider font-bold">
                    CONTROL MODEL
                  </span>
                  <h4 className="text-sm font-mono font-bold uppercase mt-1">TRADITIONAL AVERAGE</h4>
                </div>
                <span className="w-2.5 h-2.5 bg-gray-400" />
              </div>
              
              <div className="space-y-3">
                {baselineMovies.map((movie, idx) => (
                  <div key={idx} className="p-3 border border-gray-200 bg-[#FAF9F6] text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="text-gray-400 text-[10px] font-bold">SLATE ROW 0{idx + 1}</div>
                      <p className="text-[#1A1A1A] font-bold leading-tight mt-0.5">{movie.split(' [')[0]}</p>
                      <span className="text-[10px] text-gray-400">{movie.split('[Genre: ')[1]?.replace(']', '') || 'General'}</span>
                    </div>
                    {(idx === 1 || idx === 3) && (
                      <span className="px-1.5 py-0.5 text-[8px] bg-red-100 border border-red-300 text-red-700 uppercase font-mono tracking-tight font-extrabold shrink-0">
                        VETO TRIGGER
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* WatchWise Redesigned Recommendations */}
            <div className="bg-white border-t-2 border-solid border-black p-6 rounded-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[9px] font-mono bg-[#EA580C] text-white px-1.5 py-0.5 uppercase tracking-wider font-bold">
                    SYSTEM CHAMPION
                  </span>
                  <h4 className="text-sm font-mono font-bold uppercase mt-1 text-[#EA580C]">WATCHWISE (DIFFUSION + RL)</h4>
                </div>
                <span className="w-2.5 h-2.5 bg-[#EA580C]" />
              </div>

              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 border border-black bg-white hover:bg-orange-50/25 transition-colors text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="text-[#EA580C] text-[10px] font-bold">SLATE ROW 0{rec.rank}</div>
                      <p className="text-black font-extrabold leading-tight mt-0.5">{rec.title} ({rec.year})</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {rec.genres.slice(0, 2).map((g, gi) => (
                          <span key={gi} className="text-[9px] bg-slate-100 border border-gray-200 px-1 py-0.1 text-gray-500">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-[#808080]">MATCH RATIO</div>
                      <span className="text-xs text-[#EA580C] font-bold">{rec.watchwiseMatch}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Ablation Metrics Table */}
          <div className="bg-white border-t-4 border-black p-6 rounded-none border-x border-b border-black/10">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black mb-2 flex items-center gap-1.5">
              <Table2 className="w-4 h-4 text-[#EA580C]" /> ABLATION STACK METRICS COMPILATION
            </h3>
            <p className="text-xs text-gray-500 mb-4 font-sans leading-relaxed">
              Diffusion candidates paired with custom reinforcement utility networks ensure extreme alignment values.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-t-2 border-b-2 border-black bg-[#FAF9F6] text-[10px] tracking-wider text-[#505051] uppercase">
                    <th className="py-2.5 px-2">MODEL STACK DESIGN</th>
                    <th className="py-2.5 px-2 text-right">MEAN RELEVANCE</th>
                    <th className="py-2.5 px-2 text-right text-[#EA580C]">MIN SATISFACTION</th>
                    <th className="py-2.5 px-2 text-right">FAIRNESS GAP</th>
                    <th className="py-2.5 px-2 text-right">HELD-OUT MATCH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ablationMethods.map((ab, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-orange-50/10 transition-colors ${
                        ab.isOptimal ? 'bg-orange-50 font-bold border-y border-[#EA580C]' : 'text-gray-600'
                      }`}
                    >
                      <td className="py-3 px-2">
                        <div className="text-[11px] font-bold text-gray-900">{ab.name}</div>
                        <div className="text-[9px] text-[#A0A0A0]">{ab.tag}</div>
                      </td>
                      <td className="py-3 px-2 text-right font-mono">{(ab.relevance).toFixed(3)}</td>
                      <td className={`py-3 px-2 text-right font-mono font-bold ${ab.isOptimal ? 'text-[#EA580C]' : ''}`}>
                        {(ab.minSat).toFixed(3)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono">{(ab.fairnessGap).toFixed(3)}</td>
                      <td className="py-3 px-2 text-right font-mono text-gray-700">{(ab.heldOutHit).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      <footer className="mt-16 pt-6 border-t border-black grid grid-cols-1 md:grid-cols-3 gap-6 text-[#808080] font-mono text-xs">
        <div>WATCHWISE V2.0 // SWISS GRID SPEC</div>
        <div className="text-center md:text-left">DEVELOPED BY COOPERATIVE ML DEPT</div>
        <div className="text-right">BUILD REVISION: 2026 // PRODUCTION ACCELERATED</div>
      </footer>
    </div>
  );
}