import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import './Layout.css'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="ChessMind home">
          <span className="brand__name">ChessMind</span>
          <span className="brand__tag">Move explainer</span>
        </NavLink>
        <nav className="nav" aria-label="Primary">
          <NavLink to="/" end>
            Analyze
          </NavLink>
          <NavLink to="/play">Play</NavLink>
          <NavLink to="/coach">Coach</NavLink>
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  )
}
