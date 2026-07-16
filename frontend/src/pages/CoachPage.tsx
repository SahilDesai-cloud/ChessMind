import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getCoachStats } from '../api/client'
import { CATEGORY_LABELS, type CoachStatsResponse } from '../api/types'
import './CoachPage.css'

const PHASE_COLORS = {
  opening: '#c9a227',
  middlegame: '#7aaf84',
  endgame: '#6a8cae',
}

export function CoachPage() {
  const [stats, setStats] = useState<CoachStatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'opening' | 'middlegame' | 'endgame'>(
    'all',
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getCoachStats()
        if (!cancelled) setStats(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stats')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const chartData = useMemo(() => {
    if (!stats) return []
    return stats.categories
      .map((c) => {
        const count =
          phaseFilter === 'all' ? c.count : (c.by_phase[phaseFilter] ?? 0)
        return {
          name: CATEGORY_LABELS[c.category] ?? c.category,
          count,
          percentage: c.percentage,
        }
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [phaseFilter, stats])

  const phaseData = useMemo(() => {
    if (!stats) return []
    const totals = { opening: 0, middlegame: 0, endgame: 0 }
    for (const c of stats.categories) {
      for (const [phase, n] of Object.entries(c.by_phase)) {
        if (phase in totals) totals[phase as keyof typeof totals] += n
      }
    }
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [stats])

  return (
    <div className="coach">
      <header className="coach__header">
        <h1>Coach</h1>
        <p>Patterns across every flagged mistake in your analyzed games.</p>
      </header>

      {loading && <p className="coach__muted coach__pulse">Loading stats…</p>}
      {error && <p className="coach__error">{error}</p>}

      {stats && !loading && (
        <>
          <div className="coach__summary">
            <div>
              <strong>{stats.total_games}</strong>
              <span>Games</span>
            </div>
            <div>
              <strong>{stats.total_mistakes}</strong>
              <span>Mistakes</span>
            </div>
            <div>
              <strong>{stats.categories.length}</strong>
              <span>Categories hit</span>
            </div>
          </div>

          {stats.top_insight && <p className="coach__insight">{stats.top_insight}</p>}

          <div className="coach__filters" role="group" aria-label="Filter by phase">
            {(['all', 'opening', 'middlegame', 'endgame'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={phaseFilter === p ? 'is-active' : ''}
                onClick={() => setPhaseFilter(p)}
              >
                {p === 'all' ? 'All phases' : p}
              </button>
            ))}
          </div>

          {chartData.length === 0 ? (
            <p className="coach__muted">
              No mistakes stored yet for this filter. Analyze a game with swings beyond −1.5, with
              Postgres running, to populate this view.
            </p>
          ) : (
            <div className="coach__charts">
              <div className="coach__chart">
                <h2>By category</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                    <CartesianGrid stroke="rgba(242,235,224,0.08)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#9aaf9c', fontSize: 12 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis allowDecimals={false} tick={{ fill: '#9aaf9c', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#14201a',
                        border: '1px solid rgba(244,239,230,0.12)',
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: '#f4efe6' }}
                    />
                    <Bar dataKey="count" fill="#c9a227" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {phaseData.length > 0 && (
                <div className="coach__chart coach__chart--pie">
                  <h2>By phase</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={phaseData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {phaseData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={PHASE_COLORS[entry.name as keyof typeof PHASE_COLORS] ?? '#888'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#14201a',
                          border: '1px solid rgba(244,239,230,0.12)',
                          borderRadius: 8,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="coach__legend">
                    {phaseData.map((p) => (
                      <li key={p.name}>
                        <span
                          style={{
                            background: PHASE_COLORS[p.name as keyof typeof PHASE_COLORS],
                          }}
                        />
                        {p.name} · {p.value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
