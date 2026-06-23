import React, { useState, useEffect } from 'react'
import { fetchGroups, fetchMode2, fetchMode2Custom } from '../api.js'
import CustomGroupBuilder, {
  buildCustomMemberPayload,
  createInitialCustomMembers,
  customMembersReady,
} from './CustomGroupBuilder.jsx'
import GroupPanel from './GroupPanel.jsx'
import SlateTable from './SlateTable.jsx'
import { CheckCircle, Filter, Play, RefreshCw, ToggleLeft, ToggleRight, Tv } from 'lucide-react'

const OTT_PROVIDERS = [
  'Netflix',
  'Amazon Prime Video',
  'Disney+ / Hotstar',
  'Zee5',
  'SonyLIV',
  'Hulu',
  'Max',
]

function MetricPair({ baseline, watchwise, accent = false }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <div className="font-display text-2xl font-extrabold tracking-tighter text-[#1A1A1A]">{baseline}</div>
        <div className="mt-1 font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#707070]">Baseline</div>
      </div>
      <div className="border-l border-black/15 pl-3">
        <div className={`font-display text-2xl font-extrabold tracking-tighter ${accent ? 'text-[#EA580C]' : 'text-[#1A1A1A]'}`}>{watchwise}</div>
        <div className="mt-1 font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#707070]">WatchWise</div>
      </div>
    </div>
  )
}

function Mode2Insight({ result }) {
  const slate = result?.watchwise_slate || result?.slate || []
  if (!result || slate.length === 0) return null

  const genreSet = new Set(slate.flatMap(m => m.genres.split(', ')))
  const baselineMetrics = result.metrics?.avg_baseline
  const watchwiseMetrics = result.metrics?.[result.watchwise_method]
  const showMeasuredMetrics = !result.custom && baselineMetrics && watchwiseMetrics

  return (
    <div className="swiss-panel-strong border-t-[#EA580C] p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-dashed border-black/20 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="swiss-section-title">Filter Optimization Results</span>
          <h3 className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tighter">
            Streamable slate verified
          </h3>
        </div>
        <span className="swiss-tag swiss-tag-accent">{result.watchwise_method || 'watchwise'}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="border border-black/15 bg-white p-4">
          {showMeasuredMetrics ? (
            <MetricPair baseline={baselineMetrics.hit5} watchwise={watchwiseMetrics.hit5} accent />
          ) : (
            <div className="font-display text-3xl font-extrabold tracking-tighter text-[#EA580C]">{Math.round(result.match_rate * 100)}%</div>
          )}
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">
            {result.custom ? 'Constraint match' : 'Held-out Hit@5'}
          </div>
        </div>
        <div className="border border-black/15 bg-white p-4">
          {showMeasuredMetrics ? (
            <MetricPair baseline={baselineMetrics.ndcg5} watchwise={watchwiseMetrics.ndcg5} />
          ) : (
            <div className="font-display text-3xl font-extrabold tracking-tighter">{slate.length}</div>
          )}
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">
            {result.custom ? 'Profile slate size' : 'Held-out NDCG'}
          </div>
        </div>
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-3xl font-extrabold tracking-tighter">{Math.round(result.match_rate * 100)}%</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Constraint match</div>
        </div>
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-3xl font-extrabold tracking-tighter">{genreSet.size}</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Genres covered</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="border-l-4 border-[#EA580C] bg-white p-4">
          <div className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">Legitimate selection</div>
          <p className="mt-2 text-xs leading-relaxed text-[#505051]">
            Every recommendation is limited to the selected OTT services, then checked for certification and runtime constraints.
          </p>
        </div>

        <div className="border-l-4 border-[#1A1A1A] bg-white p-4">
          <div className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#1A1A1A]">Candidate pruning</div>
          <p className="mt-2 text-xs leading-relaxed text-[#505051]">
            WatchWise synthesizes candidates first, then applies constraints so narrower catalogs still preserve personalized alternatives.
          </p>
        </div>
      </div>
      {result.metric_note && (
        <div className="mt-5 border-l-4 border-[#1A1A1A] bg-white p-4 text-xs leading-relaxed text-[#505051]">
          {result.metric_note}
        </div>
      )}
    </div>
  )
}

export default function Mode2() {
  const [kind, setKind] = useState('divergent')
  const [groupSource, setGroupSource] = useState('preset')
  const [groups, setGroups] = useState([])
  const [selectedGid, setSelectedGid] = useState(null)
  const [customMembers, setCustomMembers] = useState(createInitialCustomMembers)
  const [allowTeen, setAllowTeen] = useState(true)
  const [selectedProviders, setSelectedProviders] = useState(OTT_PROVIDERS)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showFiltersDeepDive, setShowFiltersDeepDive] = useState(false)
  const canRun = selectedProviders.length > 0 && (
    groupSource === 'custom'
      ? customMembersReady(customMembers)
      : Boolean(selectedGid)
  )

  useEffect(() => {
    fetchGroups(kind, 'mode2').then((data) => {
      setGroups(data.groups)
      if (data.groups.length > 0) setSelectedGid(data.groups[0].gid)
    })
  }, [kind])

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
      const data = groupSource === 'custom'
        ? await fetchMode2Custom(buildCustomMemberPayload(customMembers), allowTeen, selectedProviders)
        : await fetchMode2(selectedGid, allowTeen, selectedProviders)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const watchwiseSlate = result?.watchwise_slate || result?.slate || []
  const baselineSlate = result?.baseline_slate || []
  const visibleProviders = result?.selected_providers || selectedProviders

  return (
    <div className="space-y-8 text-[#1A1A1A]">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        <div className="swiss-panel-strong h-full p-6 lg:col-span-7">
          <span className="swiss-section-title">Mode 2 · Streamability Engine</span>
          <h2 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tighter">
            Real-world constraints before movie night
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#505051]">
            <p>
              A strong recommendation fails if it is not available on the household's subscriptions, runs too long, or falls outside the safety band.
            </p>
            <p>
              Mode 2 applies selected OTT availability, age-safety, and runtime constraints while preserving the same recommendation pipeline.
            </p>
          </div>
          <div className="mt-6 border-l-4 border-[#EA580C] bg-white p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[#404040]">
            Hard constraints become part of the evaluated catalog slice.
          </div>
          <div className="mt-6 border-t border-black/10 pt-5">
            <div className="swiss-section-title mb-3">Technical Approach</div>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  step: '01',
                  k: 'Pipeline',
                  v: (
                    <>
                      Mode 2 reuses the exact trained stack from Mode 1 — <strong className="font-semibold text-[#1A1A1A]">128-D matrix factorization</strong>, the <strong className="font-semibold text-[#1A1A1A]">group-conditioned diffusion</strong> generator, and the <strong className="font-semibold text-[#1A1A1A]">REINFORCE</strong> reranker. Only the candidate universe changes.
                    </>
                  ),
                },
                {
                  step: '02',
                  k: 'Hard gates',
                  v: (
                    <>
                      Three constraints — <strong className="font-semibold text-[#1A1A1A]">OTT availability</strong> by region, <strong className="font-semibold text-[#1A1A1A]">runtime ≤ 150 min</strong>, and <strong className="font-semibold text-[#1A1A1A]">family-safe certification</strong> — are applied <strong className="font-semibold text-[#1A1A1A]">before any scoring</strong>, so the generator and reranker only ever see watchable titles.
                    </>
                  ),
                },
                {
                  step: '03',
                  k: 'Generation',
                  v: (
                    <>
                      Because the <strong className="font-semibold text-[#1A1A1A]">diffusion</strong> generator emits a <strong className="font-semibold text-[#1A1A1A]">continuous compromise pool</strong>, far more precise options survive the filters than a small filter-first NN subset would leave behind.
                    </>
                  ),
                },
                {
                  step: '04',
                  k: 'Inference',
                  v: (
                    <>
                      The <strong className="font-semibold text-[#1A1A1A]">w₂ max-min</strong> fairness term stays active inside the reranker even under the hard gates, and non-circular <strong className="font-semibold text-[#1A1A1A]">Hit@5</strong> is still reported on the filtered catalog slice.
                    </>
                  ),
                },
              ].map(({ step, k, v }) => (
                <div key={k} className="border border-black/10 bg-white p-4 transition-all hover:border-[#EA580C]/45 flex flex-col justify-between">
                  <div>
                    <div className="mb-2 flex items-center justify-between border-b border-black/10 pb-1.5">
                      <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">{k}</span>
                      <span className="font-mono text-[10px] font-extrabold text-[#9A9A9A]">{step}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#505051]">{v}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="swiss-panel-strong flex h-full flex-col p-6 lg:col-span-5">
          <span className="swiss-section-title">Pipeline Adaptation</span>
          <h3 className="mt-2 font-display text-xl font-extrabold uppercase tracking-tight">
            Pruning sequence
          </h3>
          <div className="mt-5 grid flex-1 gap-4">
            <div className="border border-black/15 bg-white border-l-4 border-l-[#707070] p-4 transition-all hover:bg-[#FAF9F6]/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                  <span className="swiss-tag">Filter-first</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#505051]">
                  A filter-first recommender trims the catalog to one service, family-safe ratings, and runtime first, then averages the remaining embeddings. It may predict <strong className="font-semibold text-[#1A1A1A]">Finding Nemo</strong> or <strong className="font-semibold text-[#1A1A1A]">The Incredibles</strong> because they are popular, short enough, and broadly safe.
                </p>
              </div>
              <div className="mt-3.5 border-t border-black/10 pt-2.5">
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#D83B01] block mb-1">▼ Where it fails</span>
                <p className="text-xs leading-relaxed text-[#606060]">
                  The constraints erase the interesting middle before taste modeling happens. The final prediction is watchable, but it can ignore a parent&apos;s mystery preference and a teen&apos;s sci-fi preference, returning the obvious repeat instead of a true compromise.
                </p>
              </div>
            </div>
            <div className="border border-[#EA580C]/35 bg-[#FAF9F6]/40 border-l-4 border-l-[#EA580C] p-4 transition-all hover:bg-[#EA580C]/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EA580C]/10">
                  <span className="swiss-tag swiss-tag-accent">WatchWise</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#505051]">
                  WatchWise first builds the group compromise in latent space, then applies OTT, runtime, and safety gates before reranking. Under the same household filters, it can keep options like <strong className="font-semibold text-[#1A1A1A]">Kubo and the Two Strings</strong>, <strong className="font-semibold text-[#1A1A1A]">Hunt for the Wilderpeople</strong>, or <strong className="font-semibold text-[#1A1A1A]">Apollo 13</strong> alive.
                </p>
              </div>
              <div className="mt-3.5 border-t border-[#EA580C]/20 pt-2.5">
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#B84309] block mb-1">▲ Where it wins</span>
                <p className="text-xs leading-relaxed text-[#606060]">
                  The selected movie is still streamable, age-appropriate, and under the time limit, but it is chosen from candidates already shaped around the family&apos;s tastes. The filters become hard gates, not the whole recommendation strategy.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-5 border-t border-dashed border-black/20 pt-3 font-mono text-[10px] uppercase tracking-wide text-[#707070]">
            Uses provider metadata to map stream paths against selected services.
          </p>
        </div>
      </section>

      <div className="swiss-panel overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFiltersDeepDive(!showFiltersDeepDive)}
          className="flex w-full items-center justify-between gap-4 border-b border-black/15 bg-[#FAF9F6] p-5 text-left transition-colors hover:bg-white"
        >
          <div className="flex items-center gap-2 font-mono text-xs font-extrabold uppercase tracking-widest text-[#1A1A1A]">
            <Filter className="h-4 w-4 text-[#EA580C]" />
            Criteria parsing schema and logistics
          </div>
          <span className="swiss-tag swiss-tag-accent">{showFiltersDeepDive ? 'Hide schema' : 'Expand parser'}</span>
        </button>

        {showFiltersDeepDive && (
          <div className="grid grid-cols-1 gap-5 p-5 text-xs leading-relaxed text-[#505051] md:grid-cols-2">
            <div className="border border-black/15 bg-white p-4">
              <div className="border-b border-black/15 pb-2 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">
                Aggressive constraints imposed
              </div>
              <ul className="mt-3 list-inside list-disc space-y-1">
                <li>Retains only movies available on selected services.</li>
                <li>Keeps movies found on at least one selected OTT subscription.</li>
                <li>Requires runtime under the configured maximum.</li>
                <li>Restricts certification to family-safe or older-teen bands.</li>
              </ul>
            </div>
            <div className="border border-black/15 bg-white p-4">
              <div className="border-b border-black/15 pb-2 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">
                Technical advantage
              </div>
              <p className="mt-3">
                A generated continuous pool leaves more precise options after filtering than a small filter-first retrieval subset.
              </p>
            </div>
          </div>
        )}
      </div>

      <section className="swiss-panel-strong p-6">
        <div className="mb-5">
          <h3 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-tighter">
            <Tv className="h-5 w-5 text-[#EA580C]" />
            Interactive constraint matrix
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#505051]">
            Choose OTT subscriptions, group properties, and age-safety behavior before running constrained recommendation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-4">
            <label className="swiss-label">1. OTT subscriptions</label>
            <div className="border border-black/20 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-black/10 pb-2">
                <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#606060]">
                  Available services
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProviders(OTT_PROVIDERS)
                    setResult(null)
                  }}
                  className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]"
                >
                  Select all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {OTT_PROVIDERS.map((provider) => {
                  const checked = selectedProviders.includes(provider)
                  return (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => toggleProvider(provider)}
                      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] font-extrabold uppercase tracking-wide transition-colors ${
                        checked
                          ? 'border-[#EA580C] bg-[#EA580C]/10 text-[#B84309]'
                          : 'border-black/20 bg-[#FAF9F6] text-[#606060] hover:border-[#1A1A1A] hover:text-[#1A1A1A]'
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{provider}</span>
                    </button>
                  )
                })}
              </div>
              {selectedProviders.length === 0 && (
                <div className="mt-3 border-l-4 border-[#EA580C] bg-[#F7F6F0] p-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#B84309]">
                  Select at least one provider to run constrained inference.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 lg:col-span-3">
            <label className="swiss-label">2. Choose household cohort</label>
            <div className="mb-3 grid grid-cols-2 border border-black/20 bg-white p-1">
              {[
                ['preset', 'Preset'],
                ['custom', 'Custom'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setGroupSource(value)
                    setResult(null)
                  }}
                  className={`px-2 py-2 font-mono text-[10px] font-extrabold uppercase tracking-widest transition-colors ${
                    groupSource === value
                      ? 'bg-[#1A1A1A] text-white'
                      : 'text-[#505051] hover:bg-[#F7F6F0] hover:text-[#1A1A1A]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {groupSource === 'preset' ? (
              <select
                value={selectedGid || ''}
                onChange={(e) => setSelectedGid(Number(e.target.value))}
                className="swiss-select"
              >
                {groups.map((g) => (
                  <option key={g.gid} value={g.gid}>{g.label}</option>
                ))}
              </select>
            ) : (
              <div className="border border-black/20 bg-white p-3 text-xs leading-relaxed text-[#505051]">
                Custom group editor opens below the constraint row.
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-4 lg:col-span-5">
            <div className="border border-black/20 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="block font-display text-lg font-extrabold uppercase tracking-tight">Older-teen ratings</span>
                  <span className="block text-xs text-[#606060]">Allow older-teen safety bands.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowTeen(!allowTeen)}
                  className="text-[#EA580C] focus:outline-none"
                  aria-pressed={allowTeen}
                >
                  {allowTeen ? (
                    <ToggleRight className="h-10 w-10" />
                  ) : (
                    <ToggleLeft className="h-10 w-10 text-[#707070]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRecommend}
              disabled={loading || !canRun}
              className="swiss-button w-full py-4"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Recommending…</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>
                    {selectedProviders.length === 0
                      ? 'Choose a service'
                      : groupSource === 'custom' && !customMembersReady(customMembers)
                        ? 'Finish your group'
                        : 'Recommend Movies'}
                  </span>
                </>
              )}
            </button>
          </div>

          {groupSource === 'custom' && (
            <div className="lg:col-span-12">
              <CustomGroupBuilder
                members={customMembers}
                onMembersChange={(next) => {
                  setCustomMembers(next)
                  setResult(null)
                }}
                compact
              />
            </div>
          )}
        </div>
      </section>

      {result && (
        <div className="space-y-8">
          <GroupPanel group={result.group} />

          <Mode2Insight result={result} />

          <div className="swiss-panel-strong p-6">
            <div className="mb-5 flex flex-col gap-3 border-b border-dashed border-black/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="swiss-section-title">Verified family watchlist tonight</span>
                <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight">
                  Selected OTT catalog slice
                </h3>
              </div>
              <span className="swiss-tag swiss-tag-accent">
                {Math.round(result.match_rate * 100)}% match rate
              </span>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-[#505051]">
              Both slates are generated within the selected OTT set: <strong>{visibleProviders.join(', ')}</strong>. The Caters To tags show whose taste vectors are served.
            </p>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h4 className="font-display text-lg font-extrabold uppercase tracking-tight">Traditional baseline</h4>
                    <p className="text-xs text-[#606060]">Average predicted score after identical OTT filtering.</p>
                  </div>
                  <span className="swiss-tag">{Math.round((result.baseline_match_rate ?? 0) * 100)}% match</span>
                </div>
                <SlateTable slate={baselineSlate} showFilters={true} pickLabel="Baseline pick under selected OTT" />
              </div>

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-[#EA580C]">WatchWise collective</h4>
                    <p className="text-xs text-[#606060]">Best curated WatchWise stack under identical OTT filtering.</p>
                  </div>
                  <span className="swiss-tag swiss-tag-accent">{Math.round(result.match_rate * 100)}% match</span>
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ['Predictive Rating', 'Overall predicted satisfaction. Higher denotes higher average appeal to the family cohort.'],
              ['Caters To', 'Specifies which user taste profiles are directly satisfied by the item.'],
              ['Hard Constraints Met', 'Confirms selected OTT availability, age rating, and runtime parameters.'],
            ].map(([title, copy]) => (
              <div key={title} className="swiss-panel p-4">
                <strong className="block font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">{title}</strong>
                <p className="mt-2 text-xs leading-relaxed text-[#505051]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
