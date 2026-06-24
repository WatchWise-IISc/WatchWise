import React from 'react'
import { Heart, HelpCircle, Users } from 'lucide-react'

export default function GroupPanel({ group }) {
  if (!group) return null

  const isDivergent = group.kind === 'divergent'
  const isSimilar = group.kind === 'similar'
  const isCustom = group.kind === 'custom'

  return (
    <div className={`swiss-panel-strong p-6 ${isDivergent ? 'border-t-[#EA580C]' : ''}`}>
      <div className="mb-6 flex flex-col gap-4 border-b border-dashed border-black/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="border border-black/20 bg-white p-2.5">
            <Users className="h-5 w-5 text-[#EA580C]" />
          </div>
          <div>
            <div className="swiss-section-title">Active recommendation cohort</div>
            <h3 className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tighter">
              {isCustom ? 'Custom group profile' : `Group profile #${group.gid}`}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`swiss-tag ${isDivergent ? 'swiss-tag-accent' : ''}`}>
            {isCustom ? 'custom group' : `${group.kind} taste friction`}
          </span>
          <span className="swiss-tag">
            {group.num_members} co-viewers
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {group.members.map((m) => (
          <div key={m.id} className="border border-black/15 bg-white p-4 transition-colors hover:border-[#1A1A1A]">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/25 bg-[#FAF9F6] font-mono text-xs font-extrabold text-[#1A1A1A]">
                M{m.id}
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-extrabold uppercase tracking-tight">
                    {m.name || `Member ${m.id}`}
                  </span>
                </div>

                {m.proxy_user != null && (
                  <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-[#707070]">
                    Proxy user #{m.proxy_user}
                  </div>
                )}

                <div>
                  <span className="swiss-label">Top genres</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[#1A1A1A]" title={m.top_genres}>
                    {m.top_genres}
                  </span>
                </div>

                {(m.favorite_movies?.length > 0 || m.fav_movie) && (
                  <div className="border-t border-black/10 pt-3">
                    <span className="swiss-label">Anchored favorite{m.favorite_movies?.length > 1 ? 's' : ''}</span>
                    <span
                      className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-[#1A1A1A]"
                      title={(m.favorite_movies?.length ? m.favorite_movies : [m.fav_movie]).join(', ')}
                    >
                      <Heart className="h-3.5 w-3.5 shrink-0 text-[#EA580C]" />
                      <span className="truncate">
                        {(m.favorite_movies?.length ? m.favorite_movies : [m.fav_movie]).join(', ')}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isDivergent && (
        <div className="mt-4 flex items-start gap-2 border-l-4 border-[#EA580C] bg-white p-3 text-xs leading-relaxed text-[#505051]">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" />
          <span>
            <strong className="text-[#1A1A1A]">Divergent taste active:</strong> this group is synthesized with conflicting film preferences and is the hardest collaborative filtering case.
          </span>
        </div>
      )}

      {isSimilar && (
        <div className="mt-4 border-l-4 border-[#1A1A1A] bg-white p-3 font-mono text-[10px] font-bold uppercase tracking-wide text-[#606060]">
          Similar-taste cohort: easier agreement baseline for comparison.
        </div>
      )}

      {isCustom && (
        <div className="mt-4 border-l-4 border-[#EA580C] bg-white p-3 text-xs leading-relaxed text-[#505051]">
          Custom members are mapped to real high-activity proxy users by selected genres and favorite films.
        </div>
      )}
    </div>
  )
}
