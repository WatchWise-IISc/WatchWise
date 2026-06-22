import React from 'react'
import { Film, Clock, Crown } from 'lucide-react'

// Map genres to elegant color categories for an immersive palette
function getGenreStyles(genre) {
  const g = genre.toLowerCase()
  if (g.includes('action') || g.includes('adventure') || g.includes('thriller')) {
    return 'bg-orange-500/10 border-orange-500/20 text-orange-400'
  }
  if (g.includes('drama') || g.includes('romance') || g.includes('mystery')) {
    return 'bg-violet-500/10 border-violet-500/20 text-violet-400'
  }
  if (g.includes('comedy') || g.includes('family') || g.includes('animation') || g.includes('children')) {
    return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
  }
  if (g.includes('sci-fi') || g.includes('fantasy') || g.includes('imax')) {
    return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
  }
  if (g.includes('horror') || g.includes('crime') || g.includes('documentary')) {
    return 'bg-rose-500/10 border-rose-500/20 text-rose-400'
  }
  return 'bg-slate-500/10 border-slate-500/20 text-slate-400'
}

// Map members to corresponding background-theme colors
function getMemberStyle(mName) {
  const cleaned = mName.trim().toUpperCase()
  if (cleaned.includes('M1')) return 'bg-violet-500/15 border-violet-500/30 text-violet-300'
  if (cleaned.includes('M2')) return 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
  if (cleaned.includes('M3')) return 'bg-amber-500/15 border-amber-500/30 text-amber-300'
  if (cleaned.includes('M4')) return 'bg-rose-500/15 border-rose-500/30 text-rose-300'
  if (cleaned.includes('M5')) return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
  return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
}

function formatRuntime(mins) {
  if (!mins) return '—'
  const num = Number(mins)
  if (isNaN(num)) return mins
  const hrs = Math.floor(num / 60)
  const rem = num % 60
  return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`
}

// The single best film for the group to watch together. This is NOT the highest
// average rating (that's the popularity-dominated baseline rule we argue against);
// it's the film that best protects the worst-off member — the highest min-member
// taste-fit — tie-broken by mean taste-fit, then slate order. Same fairness
// objective the reranker optimises. Falls back to group_pred if satisfaction
// fields are absent.
function pickUltimateFit(slate) {
  const floor = (m) => (m.min_member_sat != null ? m.min_member_sat : parseFloat(m.group_pred))
  const avg = (m) => (m.mean_member_sat != null ? m.mean_member_sat : parseFloat(m.group_pred))
  return slate.reduce((best, cur) => {
    if (!best) return cur
    const bf = floor(best)
    const cf = floor(cur)
    if (cf > bf) return cur
    if (cf === bf && avg(cur) > avg(best)) return cur
    return best
  }, null)
}

export default function SlateTable({
  slate,
  showFilters = false,
  pickLabel = 'Top pick to watch together',
  pickSummary = 'members'
}) {
  if (!slate || slate.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic py-12 text-center bg-slate-900/10 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2">
        <Film className="w-8 h-8 text-slate-700 animate-pulse" />
        <div>No matching movies satisfy these hard constraints.</div>
        <div className="text-xs text-slate-600">Try broadening your platform choices or allowing teen mode.</div>
      </div>
    )
  }

  const topPick = pickUltimateFit(slate)
  const worstOffPct = topPick && topPick.min_member_sat != null
    ? Math.round(topPick.min_member_sat * 100)
    : null
  const isCollectivePick = pickSummary === 'collective'

  // Shared table geometry keeps paired recommendation tables aligned row-for-row.
  const colWidths = showFilters
    ? {
        num: "w-[6%]",
        title: "w-[30%]",
        genres: "w-[20%]",
        score: "w-[12%] text-right",
        caters: "w-[14%] text-left",
        lang: "w-[6%] text-center",
        length: "w-[7%] text-right",
        cert: "w-[5%] text-center",
        row: "h-[104px]"
      }
    : {
        num: "w-[8%] text-center",
        title: "w-[36%]",
        genres: "w-[24%]",
        score: "w-[15%] text-right",
        caters: "w-[17%] text-left",
        row: "h-[92px]"
      }
  const tableMinWidth = showFilters ? 'min-w-[1040px]' : 'min-w-[920px]'

  return (
    <div className="overflow-hidden border border-white/5 rounded-xl bg-slate-950/40 backdrop-blur-xl shadow-lg">
      <div className="overflow-x-auto">
        <table className={`w-full ${tableMinWidth} table-fixed text-sm border-collapse`}>
          <thead>
            <tr className="border-b border-white/[0.06] bg-slate-900/60 backdrop-blur text-left">
              <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.num}`}>#</th>
              <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.title}`}>Title</th>
              <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.genres}`}>Genres</th>
              <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.score}`}>Pred Score</th>
              <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.caters}`}>Caters To</th>
              {showFilters && (
                <>
                  <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.lang}`}>Lang</th>
                  <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.length}`}>Length</th>
                  <th className={`py-3 px-4 font-bold text-slate-400 text-xs uppercase tracking-wider ${colWidths.cert}`}>Cert</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {slate.map((movie, i) => {
              // Convert group rating to percentage for bar visualization (assuming MovieLens 1 to 5 scale or 0 to 1 sat)
              const scoreVal = parseFloat(movie.group_pred)
              const isSatisfactionScale = scoreVal <= 1.05
              let barPercentage = 0
              if (isSatisfactionScale) {
                barPercentage = scoreVal * 100
              } else {
                // MovieLens scale 1 to 5
                barPercentage = ((scoreVal - 1) / 4) * 100
              }
              barPercentage = Math.min(Math.max(barPercentage, 0), 100)

              return (
                <tr key={i} className={`hover:bg-slate-900/40 transition-colors duration-200 align-middle ${colWidths.row}`}>
                  {/* Position Badge */}
                  <td className={`px-4 align-middle text-center ${colWidths.num}`}>
                    <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-900 border border-white/5 py-1 px-2 rounded-md">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </td>

                  {/* Title */}
                  <td className={`px-4 align-middle font-bold text-slate-100 ${colWidths.title}`}>
                    <div className="slate-title-clamp text-[13px] sm:text-[13.5px] leading-snug pr-2" title={movie.title}>
                      {movie.title}
                    </div>
                  </td>

                  {/* Genres */}
                  <td className={`px-4 align-middle ${colWidths.genres}`}>
                    <div className="slate-genre-stack flex flex-wrap gap-1 max-w-full overflow-hidden">
                      {movie.genres.split(', ').map((g) => (
                        <span key={g} className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${getGenreStyles(g)}`}>
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Predicted Rating Sparkline */}
                  <td className={`px-4 align-middle text-right ${colWidths.score}`}>
                    <div className="inline-flex min-w-[84px] flex-col items-end text-right">
                      <div className="font-mono font-bold text-slate-200 text-xs md:text-sm">
                        {movie.group_pred}
                      </div>
                      <div className="w-20 h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                          style={{ width: `${barPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Matches / Caters to Members */}
                  <td className={`px-4 align-middle ${colWidths.caters}`}>
                    {movie.best_for && movie.best_for.length > 0 ? (
                      <div className="flex items-center justify-start gap-1 overflow-hidden whitespace-nowrap max-w-full">
                        {movie.best_for.map((m) => (
                          <span
                            key={m}
                            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getMemberStyle(m)}`}
                          >
                            Member {m.replace('M', '')}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Localized filters detailed */}
                  {showFilters && (
                    <>
                      <td className={`px-4 align-middle text-center ${colWidths.lang}`}>
                        <span className="text-xs text-slate-400 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-white/[0.04]">
                          {movie.language ? movie.language.toUpperCase() : 'EN'}
                        </span>
                      </td>
                      <td className={`px-4 align-middle text-right ${colWidths.length}`}>
                        <span className="text-xs text-slate-300 font-medium font-mono flex items-center justify-end gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                          {formatRuntime(movie.runtime)}
                        </span>
                      </td>
                      <td className={`px-4 align-middle text-center ${colWidths.cert}`}>
                        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {movie.cert || 'G'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Ultimate-fit summary: the one film to play if the group watches together */}
      {topPick && (
        <div className="min-h-[64px] border-t border-white/[0.06] bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.03] to-transparent px-4 py-3.5">
          <div className="grid gap-2 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {pickLabel}
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 break-words text-[13px] font-bold leading-snug text-slate-100" title={topPick.title}>
                {topPick.title}
              </span>
              {isCollectivePick ? (
                <>
                  <span className="shrink-0 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
                    whole-group fit
                  </span>
                  <span className="text-[11px] font-medium text-emerald-300/80">
                    balanced across every member
                  </span>
                </>
              ) : (
                <>
                  {worstOffPct != null && (
                    <span
                      className="shrink-0 font-mono text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded"
                      title="Worst-off member's taste-fit for this film (percentile in their own preference distribution) — the fairness signal, not the average rating."
                    >
                      worst-off fit {worstOffPct}%
                    </span>
                  )}
                  {topPick.best_for && topPick.best_for.length > 0 ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0">caters to</span>
                      {topPick.best_for.map((m) => (
                        <span key={m} className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getMemberStyle(m)}`}>
                          Member {m.replace('M', '')}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-slate-500 italic">balanced group compromise</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
