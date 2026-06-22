import React, { useState } from 'react'
import Mode1 from './components/Mode1.jsx'
import Mode2 from './components/Mode2.jsx'
import Mode3 from './components/Mode3.jsx'

const TABS = [
  { id: 'mode1', label: 'Mode 1 · Core Science', desc: 'Measured comparison' },
  { id: 'mode2', label: 'Mode 2 · OTT + Filters', desc: 'Streamable tonight' },
  { id: 'mode3', label: 'Mode 3 · Cold Start', desc: 'Illustrative' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('mode1')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WatchWise 2.0</h1>
              <p className="text-sm text-gray-500">
                Fairness-aware group movie recommender — protecting the member usually ignored
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div>{tab.label}</div>
              <div className={`text-xs mt-0.5 ${activeTab === tab.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                {tab.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'mode1' && <Mode1 />}
        {activeTab === 'mode2' && <Mode2 />}
        {activeTab === 'mode3' && <Mode3 />}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-8 text-center text-xs text-gray-400">
        WatchWise 2.0 — Deep Learning Course Project · Grounded in real MovieLens ratings ·
        Diffusion-generated compromise candidates vs traditional nearest-neighbour retrieval
      </footer>
    </div>
  )
}
