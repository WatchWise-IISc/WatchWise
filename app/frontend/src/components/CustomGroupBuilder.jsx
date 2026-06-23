import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Film, Plus, Search, UserPlus, X } from 'lucide-react'
import { fetchMovieGenres, fetchMovieSuggestions, searchMovies } from '../api.js'

const FALLBACK_GENRES = [
  'Action', 'Adventure', 'Animation', 'Children', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Film-Noir', 'Horror', 'IMAX', 'Musical', 'Mystery', 'Romance',
  'Sci-Fi', 'Thriller', 'War', 'Western',
]

export function createInitialCustomMembers() {
  return [
    { id: 1, name: 'Member 1', genres: ['Action', 'Sci-Fi'], favorite_movies: [] },
    { id: 2, name: 'Member 2', genres: ['Drama', 'Romance'], favorite_movies: [] },
  ]
}

export function customMembersReady(members) {
  return members.length > 0 && members.every((m) => m.genres.length > 0)
}

export function buildCustomMemberPayload(members) {
  return members
    .map((m, idx) => ({
      name: (m.name || '').trim() || `Member ${idx + 1}`,
      genres: m.genres,
      favorite_movie_ids: (m.favorite_movies || []).map((movie) => movie.id),
    }))
    .filter((m) => m.genres.length > 0)
}

function MovieButton({ movie, onSelect, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(movie)}
      disabled={disabled}
      className="group inline-flex max-w-full items-center gap-1.5 border border-black/15 bg-white px-2 py-1 text-left font-mono text-[10px] font-bold uppercase tracking-wide text-[#1A1A1A] transition-colors hover:border-[#EA580C] hover:bg-[#EA580C]/10 disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-[#F7F6F0] disabled:text-[#909090]"
      title={`${movie.title} · ${movie.genre_text || movie.genres?.join(', ')}`}
    >
      <Film className="h-3.5 w-3.5 shrink-0 text-[#EA580C]" />
      <span className="truncate">{movie.title}</span>
      {movie.year && <span className="shrink-0 text-[#707070]">{movie.year}</span>}
    </button>
  )
}

function MoviePicker({ member, onAddMovie, onRemoveMovie }) {
  const [suggestions, setSuggestions] = useState({ most_rated: [], newest: [] })
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const genreKey = member.genres.join('|')
  const selectedIds = useMemo(
    () => new Set((member.favorite_movies || []).map((movie) => movie.id)),
    [member.favorite_movies],
  )
  const canAddMore = (member.favorite_movies || []).length < 3

  useEffect(() => {
    let alive = true
    fetchMovieSuggestions(member.genres, 6)
      .then((data) => {
        if (alive) setSuggestions(data)
      })
      .catch(() => {
        if (alive) setSuggestions({ most_rated: [], newest: [] })
      })
    return () => { alive = false }
  }, [genreKey])

  useEffect(() => {
    const clean = query.trim()
    if (clean.length < 2) {
      setSearchResult(null)
      setLoadingSearch(false)
      return undefined
    }

    let alive = true
    setLoadingSearch(true)
    const timer = setTimeout(() => {
      searchMovies(clean, member.genres, 8)
        .then((data) => {
          if (alive) setSearchResult(data)
        })
        .catch(() => {
          if (alive) {
            setSearchResult({
              available: false,
              results: [],
              fallback: suggestions.most_rated || [],
              advice: 'Search failed. Pick a highly rated film from the selected favorite genres instead.',
            })
          }
        })
        .finally(() => {
          if (alive) setLoadingSearch(false)
        })
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, genreKey])

  const addMovie = (movie) => {
    if (!canAddMore || selectedIds.has(movie.id)) return
    onAddMovie(movie)
    setQuery('')
    setSearchResult(null)
  }

  const renderMovieRow = (label, movies) => {
    if (!movies || movies.length === 0) return null
    return (
      <div>
        <div className="mb-1.5 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#606060]">
          {label}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {movies.map((movie) => (
            <MovieButton
              key={`${label}-${movie.id}`}
              movie={movie}
              onSelect={addMovie}
              disabled={!canAddMore || selectedIds.has(movie.id)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-black/10 pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="swiss-label">Top 3 favorite films</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[#707070]">
          {(member.favorite_movies || []).length}/3 selected
        </span>
      </div>

      {(member.favorite_movies || []).length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {member.favorite_movies.map((movie) => (
            <span
              key={movie.id}
              className="inline-flex max-w-full items-center gap-1.5 border border-[#EA580C]/35 bg-[#EA580C]/10 px-2 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wide text-[#B84309]"
              title={movie.title}
            >
              <span className="truncate">{movie.title}</span>
              <button
                type="button"
                onClick={() => onRemoveMovie(movie.id)}
                className="text-[#B84309] hover:text-[#1A1A1A]"
                aria-label={`Remove ${movie.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#EA580C]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-black/20 bg-[#FAF9F6] py-2.5 pl-9 pr-3 font-mono text-xs font-bold uppercase tracking-wide outline-none focus:border-[#EA580C]"
          placeholder="Search MovieLens title"
        />
      </div>

      {query.trim().length >= 2 && (
        <div className="mt-3 border border-black/15 bg-[#FAF9F6] p-3">
          {loadingSearch && (
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#707070]">
              Searching catalog...
            </div>
          )}
          {!loadingSearch && searchResult?.results?.length > 0 && (
            <div className="space-y-2">
              {searchResult.note && (
                <div className="flex items-start gap-2 text-[11px] leading-relaxed text-[#707070]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EA580C]" />
                  <span>{searchResult.note}</span>
                </div>
              )}
              {renderMovieRow(
                searchResult.exact ? 'Matches in MovieLens' : 'Closest matches',
                searchResult.results,
              )}
            </div>
          )}
          {!loadingSearch && searchResult && !(searchResult.results?.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 border-l-4 border-[#EA580C] bg-white p-3 text-xs leading-relaxed text-[#505051]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" />
                <span>
                  {searchResult.advice ||
                    'No matching titles found. Pick a highly rated film from the selected genres instead.'}
                </span>
              </div>
              {renderMovieRow('Most-rated in selected genres', searchResult.fallback)}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {renderMovieRow('Most rated for selected genres', suggestions.most_rated)}
        {renderMovieRow('Newest for selected genres', suggestions.newest)}
      </div>
    </div>
  )
}

export default function CustomGroupBuilder({ members, onMembersChange, compact = false }) {
  const [genres, setGenres] = useState(FALLBACK_GENRES)

  useEffect(() => {
    let alive = true
    fetchMovieGenres()
      .then((data) => {
        if (alive && data?.genres?.length) setGenres(data.genres)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const updateMember = (id, patch) => {
    onMembersChange(members.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const addMember = () => {
    if (members.length >= 5) return
    const nextNum = members.length + 1
    onMembersChange([
      ...members,
      { id: Date.now(), name: `Member ${nextNum}`, genres: [], favorite_movies: [] },
    ])
  }

  const removeMember = (id) => {
    if (members.length <= 1) return
    onMembersChange(members.filter((m) => m.id !== id))
  }

  const toggleGenre = (member, genre) => {
    const has = member.genres.includes(genre)
    updateMember(member.id, {
      genres: has ? member.genres.filter((g) => g !== genre) : [...member.genres, genre],
    })
  }

  const addMovie = (member, movie) => {
    const current = member.favorite_movies || []
    if (current.length >= 3 || current.some((m) => m.id === movie.id)) return
    updateMember(member.id, { favorite_movies: [...current, movie] })
  }

  const removeMovie = (member, movieId) => {
    updateMember(member.id, {
      favorite_movies: (member.favorite_movies || []).filter((movie) => movie.id !== movieId),
    })
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {members.map((member, idx) => (
        <div key={member.id} className="border border-black/15 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={member.name}
              onChange={(e) => updateMember(member.id, { name: e.target.value })}
              className="w-full max-w-[260px] border border-black/20 bg-[#FAF9F6] px-3 py-2 font-display text-lg font-extrabold uppercase tracking-tight outline-none focus:border-[#EA580C]"
              placeholder={`Member ${idx + 1}`}
            />
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#707070]">
              Member {idx + 1}
            </span>
            {members.length > 1 && (
              <button
                type="button"
                onClick={() => removeMember(member.id)}
                className="ml-auto inline-flex items-center gap-1 border border-black/25 px-2 py-1 font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#1A1A1A] hover:border-[#EA580C] hover:bg-[#EA580C]/10"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>

          <div className="mt-3">
            <div className="swiss-label mb-1.5">Favorite genres</div>
            <div className="flex flex-wrap gap-1">
              {genres.map((genre) => {
                const active = member.genres.includes(genre)
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(member, genre)}
                    className={`border px-2 py-px font-mono text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      active
                        ? 'border-[#EA580C] bg-[#EA580C] text-white'
                        : 'border-black/15 bg-white text-[#1A1A1A] hover:border-[#EA580C]/60'
                    }`}
                    title={genre}
                  >
                    {genre}
                  </button>
                )
              })}
            </div>
            <div className="mt-1.5 text-[10px] text-[#505050]">
              {member.genres.length > 0
                ? member.genres.join(' · ')
                : 'Choose at least one genre for this member.'}
            </div>
          </div>

          <MoviePicker
            member={member}
            onAddMovie={(movie) => addMovie(member, movie)}
            onRemoveMovie={(movieId) => removeMovie(member, movieId)}
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={addMember}
          disabled={members.length >= 5}
          className="swiss-button-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add member
        </button>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#707070]">
          Max 5 members · 1+ genre each · up to 3 favorite films per member
        </span>
      </div>

      {!customMembersReady(members) && (
        <div className="flex items-start gap-2 border-l-4 border-[#EA580C] bg-white p-3 text-xs leading-relaxed text-[#505051]">
          <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" />
          <span>Select at least one favorite genre for every custom member before running inference.</span>
        </div>
      )}
    </div>
  )
}
