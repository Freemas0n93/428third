import { NavLink, Navigate, Route, Routes } from 'react-router'
import Space from './pages/Space'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Resources from './pages/Resources'

const NAV = [
  { to: '/space', label: 'Space', glyph: '◳' },
  { to: '/tasks', label: 'Tasks', glyph: '☑' },
  { to: '/calendar', label: 'Calendar', glyph: '▦' },
  { to: '/resources', label: 'Resources', glyph: '▤' },
]

export default function App() {
  return (
    <div className="flex h-full w-full flex-col md:flex-row">
      {/* Rail: left on desktop, bottom on phone */}
      <nav className="order-last flex shrink-0 items-center justify-around border-t border-[var(--line)] bg-[var(--panel)] px-2 py-1 md:order-first md:w-[72px] md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:py-3">
        <div className="hidden pb-3 text-center text-[11px] font-semibold tracking-widest text-[var(--muted)] md:block">
          428
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex w-16 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] transition md:w-14 ${
                isActive
                  ? 'bg-[var(--panel-2)] text-[var(--text)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`
            }
          >
            <span className="text-lg leading-none">{n.glyph}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="relative min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/space" replace />} />
          <Route path="/space" element={<Space />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="*" element={<Navigate to="/space" replace />} />
        </Routes>
      </main>
    </div>
  )
}
