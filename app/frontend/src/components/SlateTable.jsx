import React from 'react'
import { Clock, Crown, Film, Tv } from 'lucide-react'

function getGenreStyles(genre) {
  const g = genre.toLowerCase()
  if (g.includes('action') || g.includes('adventure') || g.includes('thriller')) {
    return 'border-[#EA580C]/45 bg-[#EA580C]/10 text-[#B84309]'
  }
  if (g.includes('comedy') || g.includes('family') || g.includes('animation') || g.includes('children')) {
    return 'border-black/25 bg-white text-[#1A1A1A]'
  }
  if (g.includes('sci-fi') || g.includes('fantasy') || g.includes('imax')) {
    return 'border-[#EA580C]/35 bg-white text-[#B84309]'
  }
  return 'border-black/15 bg-[#FAF9F6] text-[#505051]'
}

function getMemberStyle() {
  return 'border-black/20 bg-white text-[#1A1A1A]'
}

function formatRuntime(mins) {
  if (!mins) return '-'
  const num = Number(mins)
  if (isNaN(num)) return mins
  const hrs = Math.floor(num / 60)
  const rem = num % 60
  return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`
}

function formatProviders(providers) {
  if (!providers || providers.length === 0) return []
  return providers.slice(0, 2)
}

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
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 border border-dashed border-black/25 bg-white px-4 py-12 text-center">
        <Film className="h-8 w-8 text-[#EA580C]" />
        <div className="font-display text-lg font-extrabold uppercase tracking-tight text-[#1A1A1A]">No matching movies</div>
        <div className="text-xs leading-relaxed text-[#606060]">Try broadening platform choices or allowing teen mode.</div>
      </div>
    )
  }

  const topPick = pickUltimateFit(slate)
  const worstOffPct = topPick && topPick.min_member_sat != null
    ? Math.round(topPick.min_member_sat * 100)
    : null
  const isCollectivePick = pickSummary === 'collective'

  const colWidths = showFilters
    ? {
        num: 'w-[6%]',
        title: 'w-[28%]',
        genres: 'w-[19%]',
        score: 'w-[12%] text-right',
        caters: 'w-[13%] text-left',
        ott: 'w-[12%] text-left',
        length: 'w-[7%] text-right',
        cert: 'w-[5%] text-center',
        row: 'h-[104px]'
      }
    : {
        num: 'w-[8%] text-center',
        title: 'w-[36%]',
        genres: 'w-[24%]',
        score: 'w-[15%] text-right',
        caters: 'w-[17%] text-left',
        row: 'h-[92px]'
      }
  const tableMinWidth = showFilters ? 'min-w-[1120px]' : 'min-w-[920px]'

  return (
    <div className="overflow-hidden border border-black/20 bg-white">
      <div className="overflow-x-auto">
        <table className={`w-full ${tableMinWidth} table-fixed border-collapse text-sm`}>
          <thead>
            <tr className="border-b-2 border-[#1A1A1A] bg-[#F7F6F0] text-left">
              <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.num}`}>#</th>
              <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.title}`}>Title</th>
              <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.genres}`}>Genres</th>
              <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.score}`}>Pred score</th>
              <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.caters}`}>Caters to</th>
              {showFilters && (
                <>
                  <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.ott}`}>OTT</th>
                  <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.length}`}>Length</th>
                  <th className={`px-4 py-3 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#505051] ${colWidths.cert}`}>Cert</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {slate.map((movie, i) => {
              const scoreVal = parseFloat(movie.group_pred)
              const isSatisfactionScale = scoreVal <= 1.05
              let barPercentage = 0
              if (isSatisfactionScale) {
                barPercentage = scoreVal * 100
              } else {
                barPercentage = ((scoreVal - 1) / 4) * 100
              }
              barPercentage = Math.min(Math.max(barPercentage, 0), 100)

              return (
                <tr key={i} className={`align-middle transition-colors hover:bg-[#F7F6F0] ${colWidths.row}`}>
                  <td className={`px-4 text-center align-middle ${colWidths.num}`}>
                    <span className="border border-black/20 bg-[#FAF9F6] px-2 py-1 font-mono text-xs font-extrabold text-[#505051]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </td>

                  <td className={`px-4 align-middle font-bold text-[#1A1A1A] ${colWidths.title}`}>
                    <div className="slate-title-clamp pr-2 text-[13px] leading-snug sm:text-[13.5px]" title={movie.title}>
                      {movie.title}
                    </div>
                  </td>

                  <td className={`px-4 align-middle ${colWidths.genres}`}>
                    <div className="slate-genre-stack flex max-w-full flex-wrap gap-1 overflow-hidden">
                      {movie.genres.split(', ').map((g) => (
                        <span key={g} className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide ${getGenreStyles(g)}`}>
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className={`px-4 align-middle text-right ${colWidths.score}`}>
                    <div className="inline-flex min-w-[84px] flex-col items-end text-right">
                      <div className="font-mono text-sm font-extrabold text-[#1A1A1A]">
                        {movie.group_pred}
                      </div>
                      <div className="mt-1.5 h-1 w-20 overflow-hidden border border-black/20 bg-[#F7F6F0]">
                        <div
                          className="h-full bg-[#EA580C]"
                          style={{ width: `${barPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className={`px-4 align-middle ${colWidths.caters}`}>
                    {movie.best_for && movie.best_for.length > 0 ? (
                      <div className="flex max-w-full items-center justify-start gap-1 overflow-hidden whitespace-nowrap">
                        {movie.best_for.map((m) => (
                          <span
                            key={m}
                            className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold uppercase ${getMemberStyle(m)}`}
                          >
                            Member {m.replace('M', '')}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[#909090]">-</span>
                    )}
                  </td>

                  {showFilters && (
                    <>
                      <td className={`px-4 align-middle ${colWidths.ott}`}>
                        {movie.streams_on && movie.streams_on.length > 0 ? (
                          <div className="flex max-w-full flex-col gap-1" title={movie.streams_on.join(', ')}>
                            {formatProviders(movie.streams_on).map((provider) => (
                              <span
                                key={provider}
                                className="inline-flex max-w-full items-center gap-1 border border-black/20 bg-[#FAF9F6] px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold uppercase text-[#1A1A1A]"
                              >
                                <Tv className="h-3 w-3 shrink-0 text-[#EA580C]" />
                                <span className="truncate">{provider}</span>
                              </span>
                            ))}
                            {movie.streams_on.length > 2 && (
                              <span className="font-mono text-[9.5px] font-semibold uppercase text-[#707070]">
                                +{movie.streams_on.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#909090]">-</span>
                        )}
                      </td>
                      <td className={`px-4 text-right align-middle ${colWidths.length}`}>
                        <span className="flex items-center justify-end gap-1 font-mono text-xs font-bold text-[#505051]">
                          <Clock className="h-3 w-3 shrink-0 text-[#EA580C]" />
                          {formatRuntime(movie.runtime)}
                        </span>
                      </td>
                      <td className={`px-4 text-center align-middle ${colWidths.cert}`}>
                        <span className="border border-black/20 bg-[#FAF9F6] px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#1A1A1A]">
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

      {topPick && (
        <div className="min-h-[64px] border-t-2 border-[#1A1A1A] bg-[#F7F6F0] px-4 py-3.5">
          <div className="grid gap-2 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">
              <Crown className="h-3.5 w-3.5 shrink-0" />
              {pickLabel}
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 break-words text-[13px] font-extrabold leading-snug text-[#1A1A1A]" title={topPick.title}>
                {topPick.title}
              </span>
              {isCollectivePick ? (
                <>
                  <span className="shrink-0 border border-[#EA580C]/35 bg-[#EA580C]/10 px-2 py-0.5 font-mono text-[9.5px] font-extrabold uppercase tracking-widest text-[#B84309]">
                    whole-group fit
                  </span>
                  <span className="text-[11px] font-semibold text-[#505051]">
                    balanced across every member
                  </span>
                </>
              ) : (
                <>
                  {worstOffPct != null && (
                    <span
                      className="shrink-0 border border-[#EA580C]/35 bg-[#EA580C]/10 px-1.5 py-0.5 font-mono text-xs font-extrabold text-[#B84309]"
                      title="Worst-off member taste-fit for this film."
                    >
                      worst-off fit {worstOffPct}%
                    </span>
                  )}
                  {topPick.best_for && topPick.best_for.length > 0 ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[#707070]">caters to</span>
                      {topPick.best_for.map((m) => (
                        <span key={m} className={`shrink-0 border px-2 py-0.5 font-mono text-[9.5px] font-extrabold uppercase ${getMemberStyle(m)}`}>
                          Member {m.replace('M', '')}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] italic text-[#707070]">balanced group compromise</span>
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
