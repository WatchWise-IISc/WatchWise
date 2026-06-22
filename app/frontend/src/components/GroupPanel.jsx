import React from 'react'
import { Users, Shield, Heart, HelpCircle, Star } from 'lucide-react'

export default function GroupPanel({ group }) {
  if (!group) return null

  const isDivergent = group.kind === 'divergent'
  const isSimilar = group.kind === 'similar'

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Absolute faint top accent glow */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
        isDivergent ? 'from-rose-500 to-amber-500' :
        isSimilar ? 'from-emerald-500 to-teal-500' :
        'from-blue-500 to-indigo-500'
      }`} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium tracking-wide">ACTIVE RECOMMENDATION COHORT</div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              Group Profile #{group.gid}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wider px-3 py-1 rounded-full font-bold border ${
            isDivergent 
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
              : isSimilar 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            {group.kind} Taste Friction
          </span>
          <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-medium border border-white/[0.04]">
            {group.num_members} Co-viewers
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {group.members.map((m, i) => {
          // Generate a custom clean color theme for each member to make them stand out
          const themes = [
            { ring: 'ring-violet-500/30 text-violet-400 bg-violet-500/10', text: 'text-violet-400', banner: 'from-violet-500/10 to-transparent' },
            { ring: 'ring-cyan-500/30 text-cyan-400 bg-cyan-500/10', text: 'text-cyan-400', banner: 'from-cyan-500/10 to-transparent' },
            { ring: 'ring-amber-500/30 text-amber-400 bg-amber-500/10', text: 'text-amber-400', banner: 'from-amber-500/10 to-transparent' },
            { ring: 'ring-rose-500/30 text-rose-400 bg-rose-500/10', text: 'text-rose-400', banner: 'from-rose-500/10 to-transparent' },
            { ring: 'ring-emerald-500/30 text-emerald-400 bg-emerald-500/10', text: 'text-emerald-400', banner: 'from-emerald-500/10 to-transparent' },
          ]
          const theme = themes[i % themes.length]

          return (
            <div key={m.id} className="relative group/member overflow-hidden flex items-start gap-4 p-4 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/10 hover:bg-slate-800/40 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none rounded-bl-full" />
              
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-extrabold text-sm ring-2 ${theme.ring}`}>
                M{m.id}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100">Member {m.id}</span>
                  {i === 0 && (
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded border border-white/5">
                      Primary
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">TOP GENRES</span>
                    <span className="text-[11px] text-slate-300 font-medium block truncate" title={m.top_genres}>
                      {m.top_genres}
                    </span>
                  </div>

                  {m.fav_movie && (
                    <div className="pt-1 border-t border-white/[0.03]">
                      <span className="text-[9px] font-bold text-slate-500 block uppercase">Anchored Favorite</span>
                      <span className="text-[11px] text-indigo-300 flex items-center gap-1 font-medium truncate" title={m.fav_movie}>
                        <Heart className="w-3 h-3 text-rose-500 fill-rose-500/10 shrink-0" />
                        <span className="truncate">{m.fav_movie}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {isDivergent && (
        <div className="mt-4 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-[11px] text-orange-200/80 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <span>
            <strong>Divergent Taste active:</strong> This group is synthesized with members having completely conflicting film preferences (correlation ~0.45). This is the hardest mathematical challenge for a collaborative filtering algorithm — and exactly where traditional averages fail most critically.
          </span>
        </div>
      )}
    </div>
  )
}
