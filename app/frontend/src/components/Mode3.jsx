import React, { useEffect, useState } from 'react'
import { fetchHealth, fetchMode3Custom } from '../api.js'
import SlateTable from './SlateTable.jsx'
import { Cpu, Film, HelpCircle, Info, RefreshCw, Sparkles, Users } from 'lucide-react'

const ALL_GENRES = [
  'Action', 'Adventure', 'Animation', 'Children', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Film-Noir', 'Horror', 'IMAX', 'Musical', 'Mystery', 'Romance',
  'Sci-Fi', 'Thriller', 'War', 'Western',
]

function MetricPair({ baseline, watchwise }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <div className="font-display text-2xl font-extrabold tracking-tighter text-[#1A1A1A]">{baseline}</div>
        <div className="mt-1 font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#707070]">Baseline</div>
      </div>
      <div className="border-l border-black/15 pl-3">
        <div className="font-display text-2xl font-extrabold tracking-tighter text-[#EA580C]">{watchwise}</div>
        <div className="mt-1 font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#707070]">WatchWise</div>
      </div>
    </div>
  )
}

const getInitial = name => name ? name.trim().charAt(0).toUpperCase() : 'U'

export default function Mode3() {
  const [members, setMembers] = useState([
    { id: 1, name: 'Member 1', genres: ['Action', 'Sci-Fi'] },
    { id: 2, name: 'Member 2', genres: ['Drama', 'Romance'] },
  ])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [backendOk, setBackendOk] = useState(null) // null=checking, true, false

  useEffect(() => {
    let alive = true
    fetchHealth()
      .then((d) => { if (alive) setBackendOk(!!d && d.status === 'ok') })
      .catch(() => { if (alive) setBackendOk(false) })
    return () => { alive = false }
  }, [])

  const addMember = () => {
    if (members.length >= 5) return
    const nextNum = members.length + 1
    setMembers([...members, { id: Date.now(), name: `Member ${nextNum}`, genres: [] }])
  }

  const removeMember = (id) => {
    if (members.length <= 1) return
    setMembers(members.filter((m) => m.id !== id))
  }

  const updateName = (id, newName) => {
    setMembers(members.map((m) => (m.id === id ? { ...m, name: newName } : m)))
  }

  const toggleGenre = (id, genre) => {
    setMembers(
      members.map((m) => {
        if (m.id !== id) return m
        const has = m.genres.includes(genre)
        return {
          ...m,
          genres: has ? m.genres.filter((g) => g !== genre) : [...m.genres, genre],
        }
      })
    )
  }

  const handleRecommend = async () => {
    const payload = members
      .map((m) => ({
        name: (m.name || '').trim() || 'Member',
        genres: m.genres,
      }))
      .filter((m) => m.genres.length > 0)

    if (payload.length === 0) {
      // allow sending even if empty; backend will handle but UX better to require
      alert('Select at least one genre for at least one member to run inference.')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const data = await fetchMode3Custom(payload)
      setResult(data)
    } catch (err) {
      console.error('Mode3 fetch error:', err)
      // Show the real error when possible so user/dev can diagnose (missing cache, 500 traceback detail, network, etc.)
      const msg = err?.message || 'Unknown error'
      alert(`Could not generate recommendations.\n\n${msg}\n\nMake sure the backend (uvicorn) is running and the cache for the current phase is present.`)
    } finally {
      setLoading(false)
    }
  }

  const baselineMetrics = result?.metrics?.avg_baseline
  const watchwiseMetrics = result?.metrics?.watchwise
  const selectedStack = result?.watchwise_method_label || result?.watchwise_method || 'Hybrid + profile gate'

  return (
    <div className="space-y-8 text-[#1A1A1A]">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        <div className="swiss-panel-strong h-full p-6 lg:col-span-7">
          <span className="swiss-section-title">Mode 3 · Onboarding Strategy</span>
          <h2 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tighter">
            The cold-start onboarding problem
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#505051]">
            <p>
              A brand-new family has no ratings, no likes, and no viewing history for collaborative filtering to use.
            </p>
            <p>
              WatchWise maps declared genre affinities to active proxy users, then reuses the same generative slate logic to form an immediate compromise.
            </p>
          </div>
          <div className="mt-6 flex items-start gap-2 border-l-4 border-[#EA580C] bg-white p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[#404040]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" />
            Avoids cold starts without tedious rating checklists.
          </div>
          <div className="mt-6 border-t border-black/10 pt-5">
            <div className="swiss-section-title mb-3">Technical Approach</div>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  step: '01',
                  k: 'Proxy mapping',
                  v: (
                    <>
                      With <strong className="font-semibold text-[#1A1A1A]">zero ratings</strong> for a new family, each member&apos;s declared <strong className="font-semibold text-[#1A1A1A]">genre affinities</strong> and content features are projected into the existing <strong className="font-semibold text-[#1A1A1A]">128-D matrix-factorization space</strong> and matched to the nearest real MovieLens users.
                    </>
                  ),
                },
                {
                  step: '02',
                  k: 'Generation',
                  v: (
                    <>
                      Those proxy users are then treated as an ordinary group: a <strong className="font-semibold text-[#1A1A1A]">hybrid NN + diffusion</strong> candidate pool is generated and <strong className="font-semibold text-[#1A1A1A]">profile-gated</strong> against the genres each member selected.
                    </>
                  ),
                },
                {
                  step: '03',
                  k: 'Inference',
                  v: (
                    <>
                      The same <strong className="font-semibold text-[#1A1A1A]">REINFORCE</strong> slate policy ranks the final <strong className="font-semibold text-[#1A1A1A]">3–5 movie watchlist</strong> and still protects the <strong className="font-semibold text-[#1A1A1A]">worst-off member</strong> of the new family.
                    </>
                  ),
                },
                {
                  step: '04',
                  k: 'Caveat',
                  v: (
                    <>
                      Cold-start results are <strong className="font-semibold text-[#1A1A1A]">illustrative, not measured</strong>: a brand-new family has no held-out ratings, so <strong className="font-semibold text-[#1A1A1A]">NDCG@5 / Hit@5</strong> are not computed here.
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
          <span className="swiss-section-title">Technical Contrast</span>
          <h3 className="mt-2 font-display text-xl font-extrabold uppercase tracking-tight">
            Cold-start solutions
          </h3>
          <div className="mt-5 grid flex-1 gap-4">
            <div className="border border-black/15 bg-white border-l-4 border-l-[#707070] p-4 transition-all hover:bg-[#FAF9F6]/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                  <span className="swiss-tag">Traditional</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#505051]">
                  A traditional collaborative filter needs ratings before it can locate each new member. With a brand-new anime fan, rom-com fan, and documentary fan, it falls back to global popularity and may predict <strong className="font-semibold text-[#1A1A1A]">The Shawshank Redemption</strong> or <strong className="font-semibold text-[#1A1A1A]">Toy Story</strong> for everyone.
                </p>
              </div>
              <div className="mt-3.5 border-t border-black/10 pt-2.5">
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#D83B01] block mb-1">▼ Where it fails</span>
                <p className="text-xs leading-relaxed text-[#606060]">
                  Those movies are defensible defaults, but the system cannot explain why the anime fan or documentary fan should be satisfied. It predicts safety from popularity, not compatibility from declared taste.
                </p>
              </div>
            </div>
            <div className="border border-[#EA580C]/35 bg-[#FAF9F6]/40 border-l-4 border-l-[#EA580C] p-4 transition-all hover:bg-[#EA580C]/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EA580C]/10">
                  <span className="swiss-tag swiss-tag-accent">WatchWise</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#505051]">
                  WatchWise turns each declared genre profile into a proxy user vector, combines those vectors as a temporary household, and runs the same diffusion plus REINFORCE slate logic. It can predict bridging titles like <strong className="font-semibold text-[#1A1A1A]">Spirited Away</strong>, <strong className="font-semibold text-[#1A1A1A]">Amelie</strong>, or <strong className="font-semibold text-[#1A1A1A]">Won&apos;t You Be My Neighbor?</strong>
                </p>
              </div>
              <div className="mt-3.5 border-t border-[#EA580C]/20 pt-2.5">
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-[#B84309] block mb-1">▲ Where it wins</span>
                <p className="text-xs leading-relaxed text-[#606060]">
                  The first slate is still illustrative, but every title is tied to a stated preference and checked against the group floor. Instead of asking for a tedious rating checklist, the app gives a plausible compromise immediately and improves once real feedback exists.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-5 border-t border-dashed border-black/20 pt-3 font-mono text-[10px] uppercase tracking-wide text-[#707070]">
            Integrates latent rating behavior from long-term users.
          </p>
        </div>
      </section>

      <div className="swiss-panel overflow-hidden">
        <div className="border-b border-black/15 bg-[#FAF9F6] p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-extrabold uppercase tracking-widest">
            <Cpu className="h-4 w-4 text-[#EA580C]" />
            Proxy user affinity mechanics
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 text-xs leading-relaxed text-[#505051] md:grid-cols-2">
          {[
            ['1. Declared genre interests', 'New users select a few genres with zero numerical ratings.'],
            ['2. Latent database querying', 'Genre interests are matched against historical users with strong activity in those genres.'],
            ['3. Greedy ID isolation', 'No two co-viewers are mapped to the same account, preserving useful taste contrast.'],
            ['4. Generation and REINFORCE', 'Surrogate embeddings feed the same DDPM candidate generation and slate selection flow.'],
          ].map(([title, copy]) => (
            <div key={title} className="border border-black/15 bg-white p-4">
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">{title}</span>
              <p className="mt-2">{copy}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="swiss-panel-strong p-6">
        <div className="mb-5">
          <h3 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-tighter">
            <Users className="h-5 w-5 text-[#EA580C]" />
            Build a custom family
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#505051]">
            Define real members with editable names and favorite genres drawn from the MovieLens catalog. We will map each member to a real high-activity proxy user and run the full diffusion + fairness-aware slate pipeline.
          </p>
        </div>

        <div className="space-y-4">
          {members.map((member, idx) => (
            <div key={member.id} className="border border-black/15 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => updateName(member.id, e.target.value)}
                  className="font-display text-xl font-extrabold tracking-tight border border-black/20 bg-[#FAF9F6] px-3 py-1 w-full max-w-[260px]"
                  placeholder="Member name"
                />
                {members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    className="ml-auto text-[10px] border border-black/30 px-2 py-1 hover:bg-[#fff0e9] active:bg-white"
                  >
                    REMOVE
                  </button>
                )}
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#707070] ml-auto md:ml-0">#{idx + 1}</span>
              </div>

              <div className="mt-3">
                <div className="swiss-label mb-1.5">Favorite genres — click any to select or deselect</div>
                <div className="flex flex-wrap gap-1">
                  {ALL_GENRES.map((g) => {
                    const active = member.genres.includes(g)
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(member.id, g)}
                        className={`px-2 py-px text-[10px] font-mono border transition ${active ? 'border-[#EA580C] bg-[#EA580C] text-white' : 'border-black/15 hover:border-[#EA580C]/60 bg-white'}`}
                        title={g}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-1.5 text-[10px] text-[#505050]">
                  {member.genres.length > 0
                    ? member.genres.join(' · ')
                    : 'No genres chosen yet. Select 1–4 that best describe this person’s taste.'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={addMember}
            disabled={members.length >= 5}
            className="swiss-button-secondary px-3 py-1.5 text-xs"
          >
            + Add another member
          </button>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#707070]">Max 5 members • Pick genres for everyone you want represented</span>
        </div>

        <div className="mt-4">
          {backendOk === false && (
            <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-[#B84309] border-l-2 border-[#EA580C] pl-2">
              Backend not reachable. Start with <code className="font-bold">./app/start.sh</code> (or uvicorn + npm run dev) so the engine and cache are loaded.
            </div>
          )}
          <button
            type="button"
            onClick={handleRecommend}
            disabled={loading || backendOk === false || members.every((m) => m.genres.length === 0)}
            className="swiss-button w-full py-3.5"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Recommending…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Recommend Movies</span>
              </>
            )}
          </button>
          <div className="mt-1 text-[10px] text-[#707070] text-center">
            {backendOk === true ? 'Backend ready — using real proxy mapping + diffusion + RL' : backendOk === false ? 'Waiting for backend...' : 'Checking backend...'}
          </div>
        </div>
      </section>

      {result && (
        <div className="space-y-8">
          <div className="swiss-panel-strong border-t-[#EA580C] p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-dashed border-black/20 pb-4">
              <Sparkles className="h-5 w-5 text-[#EA580C]" />
              <div>
                <span className="swiss-section-title">Active Surrogate Assignments</span>
                <h3 className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tighter">
                  Cold profiles bootstrapped
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 text-xs leading-relaxed text-[#505051] md:grid-cols-2">
              <div className="border-l-4 border-[#EA580C] bg-white p-4">
                <div className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">Proxy pairing</div>
                <p className="mt-2">
                  Each new member is paired with a genuine database user who exhibits heavy rating behavior under target preferences.
                </p>
              </div>
              <div className="border-l-4 border-[#1A1A1A] bg-white p-4">
                <div className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#1A1A1A]">Decaying proxy weight</div>
                <p className="mt-2">
                  As members rate and skip titles, self-recorded behavior can replace the borrowed proxy signal.
                </p>
              </div>
            </div>
          </div>

          <div className="swiss-panel p-6">
            <span className="swiss-section-title">Cold-start proxy user ticket assignments</span>
            <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight">
              Surrogate account mapping
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#505051]">
              These active profiles allow the generative model to construct a consensus space without waiting for first-party rating history.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              {result.members.map((m) => (
                <div key={m.name} className="border border-black/15 bg-white p-4">
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/20 bg-[#FAF9F6] font-mono text-sm font-extrabold text-[#1A1A1A]">
                      {getInitial(m.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#1A1A1A]">{m.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-[#606060]">Proxy user #{m.proxy_user}</div>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-black/10 pt-3">
                    <span className="swiss-label">Stated desires</span>
                    <span className="mt-1 block truncate text-xs font-semibold text-[#1A1A1A]" title={m.genres.join(', ')}>
                      {m.genres.join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="swiss-panel-strong p-6">
            <div className="mb-4 flex items-center gap-2">
              <Film className="h-5 w-5 text-[#EA580C]" />
              <div>
                <span className="swiss-section-title">Generative compromise board</span>
                <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight">
                  Cold-start recommendation slate
                </h3>
              </div>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-[#505051]">
              Hybrid NN + diffusion candidates are generated from active proxy mappings, then profile-gated against the genres selected above.
            </p>
            {baselineMetrics && watchwiseMetrics && (
              <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="border border-black/15 bg-white p-4">
                  <MetricPair baseline={baselineMetrics.diversity} watchwise={watchwiseMetrics.diversity} />
                  <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Slate diversity</div>
                </div>
                <div className="border border-black/15 bg-white p-4">
                  <div className="font-display text-3xl font-extrabold tracking-tighter">
                    {watchwiseMetrics.min_member_sat}
                  </div>
                  <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Profile-grounded floor</div>
                </div>
                <div className="border border-black/15 bg-white p-4">
                  <div className="font-display text-2xl font-extrabold uppercase tracking-tighter">
                    {selectedStack}
                  </div>
                  <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#505051]">Selected stack</div>
                </div>
              </div>
            )}
            <SlateTable slate={result.slate} pickLabel="Best for the family" />
          </div>

          <div className="swiss-panel p-5">
            <h3 className="mb-2 flex items-center gap-2 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#EA580C]">
              <HelpCircle className="h-4 w-4" />
              Usability and metric restrictions
            </h3>
            <div className="space-y-2 text-xs leading-relaxed text-[#505051]">
              <p>
                This recommendation result is illustrative rather than measured. A cold-start onboarding profile has no historical holdout ratings for NDCG@5 or Hit@5 evaluation.
              </p>
              <p>
                Its purpose is functional proof that proxy-derived hybrid candidates can be grounded by explicit member intent before direct histories exist.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
