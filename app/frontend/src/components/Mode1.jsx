import React, { useState, useEffect } from 'react'
import { fetchGroups, fetchMode1, fetchMode1Custom } from '../api.js'
import CustomGroupBuilder, {
  buildCustomMemberPayload,
  createInitialCustomMembers,
  customMembersReady,
} from './CustomGroupBuilder.jsx'
import GroupPanel from './GroupPanel.jsx'
import SlateTable from './SlateTable.jsx'
import MetricsChart from './MetricsChart.jsx'
import { Cpu, Film, RefreshCw, Star, Terminal } from 'lucide-react'

function asNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function metric3(value) {
  return asNumber(value).toFixed(3)
}

function pct(value, digits = 0) {
  return `${(asNumber(value) * 100).toFixed(digits)}%`
}

function signedPoints(delta) {
  const points = delta * 100
  const rounded = Math.abs(points) < 10 ? points.toFixed(1) : points.toFixed(0)
  return `${points >= 0 ? '+' : ''}${rounded} pts`
}

function relativeLift(from, to) {
  const base = asNumber(from)
  const next = asNumber(to)
  const delta = next - base
  if (Math.abs(delta) < 0.0005) return 'flat'
  if (Math.abs(base) < 0.0005) return signedPoints(delta)
  return `${delta >= 0 ? '+' : ''}${Math.round((delta / base) * 100)}%`
}

function InsightCard({ metrics, watchwiseMethod = 'diffusion_rl' }) {
  if (!metrics || metrics.length === 0) return null
  const base = metrics.find(m => m.method === 'avg_baseline')
  const best = metrics.find(m => m.method === watchwiseMethod) ||
    metrics.find(m => m.method === 'hybrid_rl') ||
    metrics.find(m => m.method === 'diffusion_rl')
  if (!base || !best) return null
  const floorDelta = asNumber(best.min_member_sat) - asNumber(base.min_member_sat)
  const ndcgDelta = asNumber(best.ndcg5) - asNumber(base.ndcg5)
  const hitDelta = asNumber(best.hit5) - asNumber(base.hit5)
  const worstNdcgDelta = asNumber(best.worst_ndcg5) - asNumber(base.worst_ndcg5)
  const floorLift = floorDelta > 0.004
  const floorPreserved = floorDelta >= -0.01
  const headline = floorLift
    ? 'WatchWise lifts the worst-off viewer'
    : 'WatchWise improves held-out discovery'
  const floorCopy = floorLift
    ? `WatchWise raises the predicted worst-off floor from ${metric3(base.min_member_sat)} to ${metric3(best.min_member_sat)}.`
    : floorPreserved
      ? `The predicted floor is already saturated for this cohort: ${metric3(base.min_member_sat)} traditional vs ${metric3(best.min_member_sat)} WatchWise.`
      : `WatchWise trades ${signedPoints(floorDelta)} of proxy floor for stronger held-out ranking.`
  const validationCopy = ndcgDelta > 0 || hitDelta > 0 || worstNdcgDelta > 0
    ? `The non-circular held-out split improves: baseline NDCG@5 ${metric3(base.ndcg5)} vs WatchWise ${metric3(best.ndcg5)}; baseline Hit@5 ${metric3(base.hit5)} vs WatchWise ${metric3(best.hit5)}.`
    : `This cohort does not produce a held-out win; use the ablation table to inspect the trade-off directly.`

  return (
    <div className="swiss-panel-strong p-5">
      <div className="mb-5 grid gap-4 border-b border-dashed border-black/20 pb-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <span className="swiss-section-title">Empirical Outcome Summary</span>
          <h3 className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tighter text-[#1A1A1A]">
            {headline}
          </h3>
        </div>
        <span className="swiss-tag swiss-tag-accent">{best.method}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-4xl font-extrabold tracking-tighter text-[#EA580C]">{relativeLift(base.ndcg5, best.ndcg5)}</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Held-out NDCG lift</div>
          <p className="mt-2 text-xs leading-relaxed text-[#606060]">Ranking gain on hidden true ratings.</p>
        </div>
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-4xl font-extrabold tracking-tighter text-[#EA580C]">{relativeLift(base.hit5, best.hit5)}</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Held-out Hit@5 lift</div>
          <p className="mt-2 text-xs leading-relaxed text-[#606060]">More hidden true favorites appear in the final slate.</p>
        </div>
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-4xl font-extrabold tracking-tighter text-[#1A1A1A]">{pct(best.min_member_sat, 1)}</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Worst-off proxy floor</div>
          <p className="mt-2 text-xs leading-relaxed text-[#606060]">Predicted taste-fit retained across members.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border-l-4 border-[#EA580C] bg-white p-4">
          <div className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">
            {floorLift ? 'Co-viewer veto eliminated' : 'Proxy floor interpreted correctly'}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#505051]">
            {floorCopy}
          </p>
        </div>
        <div className="border-l-4 border-[#1A1A1A] bg-white p-4">
          <div className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#1A1A1A]">Ground-truth validation</div>
          <p className="mt-2 text-xs leading-relaxed text-[#505051]">
            {validationCopy}
          </p>
        </div>
      </div>
    </div>
  )
}

function CustomColdStartSummary({ result }) {
  const base = result.metrics?.find((m) => m.method === 'avg_baseline')
  const watchwise = result.metrics?.find((m) => m.method === result.watchwise_method)
  if (!base || !watchwise) return null

  return (
    <div className="swiss-panel-strong border-t-[#EA580C] p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-dashed border-black/20 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="swiss-section-title">Custom Group Result</span>
          <h3 className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tighter">
            Cold-start proxy slate generated
          </h3>
        </div>
        <span className="swiss-tag swiss-tag-accent">{result.watchwise_method_label || result.watchwise_method}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-3xl font-extrabold tracking-tighter text-[#EA580C]">{watchwise.min_member_sat}</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Profile-grounded floor</div>
        </div>
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-3xl font-extrabold tracking-tighter">{watchwise.profile_match}</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Favorite profile match</div>
        </div>
        <div className="border border-black/15 bg-white p-4">
          <div className="font-display text-3xl font-extrabold tracking-tighter">{watchwise.diversity}</div>
          <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Slate diversity</div>
        </div>
      </div>

      <div className="mt-5 border-l-4 border-[#1A1A1A] bg-white p-4 text-xs leading-relaxed text-[#505051]">
        {result.metric_note || 'Custom groups use explicit profile fit because no historical holdout exists yet.'}
      </div>
    </div>
  )
}

export default function Mode1() {
  const [kind, setKind] = useState('divergent')
  const [groupSource, setGroupSource] = useState('preset')
  const [groups, setGroups] = useState([])
  const [selectedGid, setSelectedGid] = useState(null)
  const [customMembers, setCustomMembers] = useState(createInitialCustomMembers)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showDeepDive, setShowDeepDive] = useState(false)

  useEffect(() => {
    fetchGroups(kind, 'mode1').then((data) => {
      setGroups(data.groups)
      if (data.groups.length > 0) setSelectedGid(data.groups[0].gid)
    })
  }, [kind])

  const handleRecommend = async () => {
    const isCustom = groupSource === 'custom'
    if (isCustom && !customMembersReady(customMembers)) return
    if (!isCustom && !selectedGid) return
    setLoading(true)
    setResult(null)
    try {
      const data = isCustom
        ? await fetchMode1Custom(buildCustomMemberPayload(customMembers))
        : await fetchMode1(selectedGid)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const canRun = groupSource === 'custom'
    ? customMembersReady(customMembers)
    : Boolean(selectedGid)

  return (
    <div className="space-y-8 text-[#1A1A1A]">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        <div className="swiss-panel-strong h-full p-6 lg:col-span-7">
          <span className="swiss-section-title">Mode 1 · Project Objective</span>
          <h2 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tighter text-[#1A1A1A]">
            The democratic movie night paradox
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#505051]">
            <p>
              When five people pick a film, traditional platforms often average rating vectors and retrieve the highest central compromise.
            </p>
            <p>
              WatchWise asks whether a slate can protect the least-satisfied member by elevating minimum satisfaction instead of only maximizing the average.
            </p>
          </div>
          <div className="mt-6 border-l-4 border-[#EA580C] bg-white p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[#404040]">
            Main scientific metric: min-member satisfaction.
          </div>
          <div className="mt-6 border-t border-black/10 pt-5">
            <div className="swiss-section-title mb-3">Technical Approach</div>
            <dl className="space-y-3 text-sm leading-relaxed text-[#505051]">
              {[
                {
                  k: 'Training',
                  v: (
                    <>
                      We learn <strong className="font-semibold text-[#1A1A1A]">128-dimensional matrix-factorization</strong> embeddings for every user and movie on <strong className="font-semibold text-[#1A1A1A]">MovieLens-25M</strong>, hiding <strong className="font-semibold text-[#1A1A1A]">20%</strong> of each member&apos;s ratings before training so they stay unseen during evaluation.
                    </>
                  ),
                },
                {
                  k: 'Generation',
                  v: (
                    <>
                      A group-conditioned <strong className="font-semibold text-[#1A1A1A]">diffusion model (DDPM, 500 noise steps, 120 epochs)</strong> synthesizes compromise candidates that sit between members&apos; tastes, sampled with <strong className="font-semibold text-[#1A1A1A]">100-step DDIM</strong> at inference — benchmarked head-to-head against classical <strong className="font-semibold text-[#1A1A1A]">nearest-neighbour retrieval</strong>.
                    </>
                  ),
                },
                {
                  k: 'Reranking',
                  v: (
                    <>
                      An identical fairness-aware reranker — a greedy <strong className="font-semibold text-[#1A1A1A]">max-min bandit</strong> versus a <strong className="font-semibold text-[#1A1A1A]">REINFORCE</strong> slate policy trained over <strong className="font-semibold text-[#1A1A1A]">20K episodes</strong> — orders a 120-candidate pool to maximize <strong className="font-semibold text-[#1A1A1A]">reward = w₁·avg + w₂·min-member + diversity</strong>.
                    </>
                  ),
                },
                {
                  k: 'Inference',
                  v: (
                    <>
                      Five method stacks (baseline, plus NN and diffusion each with greedy and RL reranking) are scored on identical pools and graded by held-out <strong className="font-semibold text-[#1A1A1A]">NDCG@5 / Hit@5</strong>; the headline fairness signal is <strong className="font-semibold text-[#1A1A1A]">min-member (worst-off) satisfaction</strong>.
                    </>
                  ),
                },
              ].map(({ k, v }) => (
                <div key={k} className="sm:grid sm:grid-cols-[120px_1fr] sm:gap-4">
                  <dt className="mb-1 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C] sm:mb-0 sm:pt-0.5">
                    {k}
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="swiss-panel flex h-full flex-col p-6 lg:col-span-5">
          <span className="swiss-section-title">Technical Contrast</span>
          <h3 className="mt-2 font-display text-xl font-extrabold uppercase tracking-tight">
            Methodology architecture
          </h3>
          <div className="mt-5 grid flex-1 gap-3">
            <div className="border border-black/15 bg-white p-4">
              <span className="swiss-tag">Traditional</span>
              <p className="mt-2 text-[13px] leading-relaxed text-[#505051]">
                The average-vector baseline searches for movies closest to the group centroid. In a five-person group with four action fans and one quiet-drama fan, it would likely predict <strong className="font-semibold text-[#1A1A1A]">The Avengers</strong> or <strong className="font-semibold text-[#1A1A1A]">Mad Max: Fury Road</strong> as the safest shared choice.
              </p>
              <div className="mt-2.5 border-t border-black/10 pt-2">
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#909090]">Where it fails</span>
                <p className="mt-1 text-xs leading-relaxed text-[#606060]">
                  Those titles can score a strong average because the majority pulls the centroid toward spectacle, but the drama fan&apos;s predicted satisfaction may sit near 2/5. The slate looks democratic numerically while repeatedly sacrificing the same minority taste.
                </p>
              </div>
            </div>
            <div className="border border-[#EA580C]/35 bg-white p-4">
              <span className="swiss-tag swiss-tag-accent">WatchWise</span>
              <p className="mt-2 text-[13px] leading-relaxed text-[#505051]">
                WatchWise samples compromise candidates with diffusion, mixes them with NN retrieval, then ranks by average fit plus the worst-off member floor. The same group can surface <strong className="font-semibold text-[#1A1A1A]">Arrival</strong>, <strong className="font-semibold text-[#1A1A1A]">The Prestige</strong>, or <strong className="font-semibold text-[#1A1A1A]">Knives Out</strong> style picks.
              </p>
              <div className="mt-2.5 border-t border-[#EA580C]/20 pt-2">
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#B84309]">Where it wins</span>
                <p className="mt-1 text-xs leading-relaxed text-[#606060]">
                  These films still satisfy the action-leaning majority through tension and scale, but give the drama-oriented member a much higher personal rank. The reranker prefers the slate whose weakest predicted viewer is closer to 3.5/5 instead of chasing only the loudest average.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-5 border-t border-dashed border-black/20 pt-3 font-mono text-[10px] uppercase tracking-wide text-[#707070]">
            Measured against non-circular held-out user ratings.
          </p>
        </div>
      </section>

      <div className="swiss-panel overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDeepDive(!showDeepDive)}
          className="flex w-full items-center justify-between gap-4 border-b border-black/15 bg-[#FAF9F6] p-5 text-left transition-colors hover:bg-white"
        >
          <div className="flex items-center gap-2 font-mono text-xs font-extrabold uppercase tracking-widest text-[#1A1A1A]">
            <Cpu className="h-4 w-4 text-[#EA580C]" />
            Technical specifications and neural stack
          </div>
          <span className="swiss-tag swiss-tag-accent">{showDeepDive ? 'Hide schema' : 'Expand architecture'}</span>
        </button>

        {showDeepDive && (
          <div className="grid grid-cols-1 gap-4 p-5 text-xs leading-relaxed text-[#505051] md:grid-cols-2 xl:grid-cols-4">
            {[
              ['1. Matrix Factorization', 'User and item ratings are mapped to dense 64-dimensional latents. A 20% holdout split prevents target leakage.'],
              ['2. Conditional Diffusion', 'DDPM denoises latents from Gaussian noise conditioned on the mean group vector.'],
              ['3. Fairness Reward', 'Satisfaction balances mean relevance, minimum member protection, and diversity.'],
              ['4. REINFORCE Slate Layer', 'A sequential policy emits five recommendations from candidate pools using fairness state scalars.'],
            ].map(([title, copy]) => (
              <div key={title} className="border border-black/15 bg-white p-4">
                <div className="border-b border-black/15 pb-2 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">{title}</div>
                <p className="mt-3">{copy}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="swiss-panel-strong p-6">
        <div className="mb-5">
          <h3 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-tighter">
            <Terminal className="h-5 w-5 text-[#EA580C]" />
            Interactive experiment control
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#505051]">
            Configure cohort properties and trigger the recommendation pipeline to benchmark traditional retrieval against WatchWise.
          </p>
        </div>

        <div className="mb-5 inline-flex border border-black/20 bg-white p-1">
          {[
            ['preset', 'Preset groups'],
            ['custom', 'Custom group'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setGroupSource(value)
                setResult(null)
              }}
              className={`px-3 py-2 font-mono text-[10px] font-extrabold uppercase tracking-widest transition-colors ${
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
            <div className="space-y-2 md:col-span-7">
              <label className="swiss-label">1. Select synthesized cohort</label>
              <select
                value={selectedGid || ''}
                onChange={(e) => setSelectedGid(Number(e.target.value))}
                className="swiss-select"
              >
                {groups.map((g) => (
                  <option key={g.gid} value={g.gid}>{g.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-5">
              <button
                type="button"
                onClick={handleRecommend}
                disabled={loading || !canRun}
                className="swiss-button w-full py-3.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Recommending…</span>
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4" />
                    <span>Recommend Movies</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <CustomGroupBuilder
              members={customMembers}
              onMembersChange={(next) => {
                setCustomMembers(next)
                setResult(null)
              }}
            />

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
                  <Star className="h-4 w-4" />
                  <span>Recommend Movies</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {result && (
        <div className="space-y-8">
          <GroupPanel group={result.group} />

          {result.custom ? (
            <CustomColdStartSummary result={result} />
          ) : (
            <InsightCard
              metrics={result.metrics}
              watchwiseMethod={result.watchwise_method}
            />
          )}

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="swiss-panel-strong flex flex-col justify-between p-5">
              <div>
                <div className="mb-4 border-b border-dashed border-black/20 pb-4">
                  <span className="swiss-section-title">Control Baseline</span>
                  <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight">
                    Traditional average recommender
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#505051]">
                    Predicted scores are averaged across all members and the top five candidates are retrieved.
                  </p>
                </div>
                <SlateTable slate={result.baseline_slate} pickLabel="Traditional pick for the group" />
              </div>
              <p className="mt-4 border-t border-black/15 pt-3 font-mono text-[10px] uppercase tracking-wide text-[#707070]">
                Missing member labels reveal users receiving no customized picks.
              </p>
            </div>

            <div className="swiss-panel-strong flex flex-col justify-between border-t-[#EA580C] p-5">
              <div>
                <div className="mb-4 border-b border-dashed border-black/20 pb-4">
                  <span className="swiss-section-title">Tested Architecture</span>
                  <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight">
                    WatchWise collective
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#505051]">
                    {result.custom
                      ? 'Hybrid candidates are profile-gated against selected genres and favorite films before the final slate is shown.'
                      : 'The best measured diffusion or hybrid WatchWise stack is shown against the traditional average baseline.'}
                  </p>
                </div>
                <SlateTable
                  slate={result.watchwise_slate}
                  pickLabel="WatchWise pick for the group"
                  pickSummary="collective"
                />
              </div>
              <p className="mt-4 border-t border-black/15 pt-3 font-mono text-[10px] uppercase tracking-wide text-[#EA580C]">
                Designed to satisfy outlier members without discarding group relevance.
              </p>
            </div>
          </section>

          {!result.custom && (
            <>
              <div className="swiss-panel-strong p-6">
                <div className="mb-5">
                  <span className="swiss-section-title">Complete compressed study</span>
                  <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight">
                    Ablation studies - five-method metrics comparison
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#505051]">
                    Retrieval versus diffusion and greedy reranking versus REINFORCE policy are evaluated under identical conditions.
                  </p>
                </div>

                <div className="overflow-x-auto border border-black/20 bg-white">
                  <table className="w-full min-w-[1120px] text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-[#1A1A1A] bg-[#F7F6F0] font-mono text-[10px] uppercase tracking-widest text-[#505051]">
                        <th className="px-4 py-3 font-extrabold">Pipeline model configuration</th>
                        <th className="px-3 py-3 text-right font-extrabold">Mean relevance</th>
                        <th className="px-3 py-3 text-right font-extrabold text-[#EA580C]">Min-member sat</th>
                        <th className="px-3 py-3 text-right font-extrabold">Fairness gap</th>
                        <th className="px-3 py-3 text-right font-extrabold">NDCG@5</th>
                        <th className="px-3 py-3 text-right font-extrabold">Hit@5</th>
                        <th className="px-3 py-3 text-right font-extrabold">Worst NDCG</th>
                        <th className="px-3 py-3 text-right font-extrabold">Worst Hit</th>
                        <th className="px-3 py-3 text-right font-extrabold">Diversity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {result.metrics.map((m) => {
                        const isWatchWise = m.method === (result.watchwise_method || 'hybrid_rl')
                        const isBaseline = m.method === 'avg_baseline'

                        return (
                          <tr key={m.method} className={isWatchWise ? 'bg-[#EA580C]/10' : isBaseline ? 'bg-[#F7F6F0]' : 'bg-white'}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-[#1A1A1A]">{m.label}</div>
                              {isBaseline && <div className="mt-1 font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#707070]">Traditional status quo</div>}
                              {isWatchWise && <div className="mt-1 flex items-center gap-1 font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#EA580C]">
                                <Star className="h-3 w-3" /> WatchWise optimal stack
                              </div>}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-sm">{m.relevance}</td>
                            <td className={`px-3 py-3 text-right font-mono text-sm ${isWatchWise ? 'font-extrabold text-[#EA580C]' : ''}`}>
                              {m.min_member_sat}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-sm">{m.fairness_gap}</td>
                            <td className="px-3 py-3 text-right font-mono text-sm">{m.ndcg5}</td>
                            <td className="px-3 py-3 text-right font-mono text-sm">{m.hit5}</td>
                            <td className="px-3 py-3 text-right font-mono text-sm">{m.worst_ndcg5}</td>
                            <td className="px-3 py-3 text-right font-mono text-sm">{m.worst_hit5}</td>
                            <td className="px-3 py-3 text-right font-mono text-sm">{m.diversity}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <MetricsChart
                metrics={result.metrics}
                watchwiseMethod={result.watchwise_method}
              />
            </>
          )}

          {result.diffusion_teaser && result.diffusion_teaser.length > 0 && (
            <div className="swiss-panel p-6">
              <div className="mb-4">
                <span className="swiss-section-title">Generative space preview</span>
                <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight">
                  Compromise latent embeddings
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#505051]">
                  Closest real-movie titles to generated sample latents from the diffusion pool.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 border border-black/15 bg-white p-4 font-mono text-xs font-bold text-[#1A1A1A]">
                {result.diffusion_teaser.map((title, i) => (
                  <span key={i} className="swiss-tag">
                    <Film className="h-3.5 w-3.5 text-[#EA580C]" />
                    {title}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-dashed border-black/20 pt-4 text-xs leading-relaxed text-[#505051] md:grid-cols-2">
                <div className="border border-black/15 bg-white p-3">
                  <strong className="block font-mono text-[10px] uppercase tracking-widest text-[#EA580C]">Meaning</strong>
                  WatchWise does not run a title keyword query. It denoises inside the rating manifold to synthesize movie specs for this exact group.
                </div>
                <div className="border border-black/15 bg-white p-3">
                  <strong className="block font-mono text-[10px] uppercase tracking-widest text-[#EA580C]">Generative specifics</strong>
                  The group's centroid conditions the diffusion path, with guidance pushing output toward creative compromise regions.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
