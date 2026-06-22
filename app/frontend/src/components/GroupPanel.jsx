import React from 'react'

export default function GroupPanel({ group }) {
  if (!group) return null

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Group #{group.gid}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          group.kind === 'divergent' ? 'bg-red-100 text-red-700' :
          group.kind === 'similar' ? 'bg-green-100 text-green-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {group.kind}-taste
        </span>
        <span className="text-xs text-gray-500">{group.num_members} members</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {group.members.map((m) => (
          <div key={m.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm shrink-0">
              M{m.id}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900">Member {m.id}</div>
              <div className="text-xs text-gray-500 truncate">Likes: {m.top_genres}</div>
              {m.fav_movie && (
                <div className="text-xs text-gray-400 truncate mt-0.5">Fav: {m.fav_movie}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
