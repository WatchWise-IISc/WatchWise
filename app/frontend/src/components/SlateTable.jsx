import React from 'react'

export default function SlateTable({ slate, showFilters = false }) {
  if (!slate || slate.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-4 text-center">
        No movies matched the filters — try relaxing constraints.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600">#</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Title</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Genres</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Pred Rating</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Best For</th>
            {showFilters && (
              <>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Lang</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Runtime</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Cert</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {slate.map((movie, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{i + 1}</td>
              <td className="py-2.5 px-3 font-medium text-gray-900">{movie.title}</td>
              <td className="py-2.5 px-3 text-gray-600">
                <div className="flex flex-wrap gap-1">
                  {movie.genres.split(', ').map((g) => (
                    <span key={g} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {g}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-2.5 px-3 text-right font-mono">{movie.group_pred}</td>
              <td className="py-2.5 px-3">
                {movie.best_for.length > 0 ? (
                  <div className="flex gap-1">
                    {movie.best_for.map((m) => (
                      <span key={m} className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              {showFilters && (
                <>
                  <td className="py-2.5 px-3 text-gray-600">{movie.language || '—'}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">
                    {movie.runtime ? `${movie.runtime}m` : '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      {movie.cert || '—'}
                    </span>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
