import { Play, Search, Ellipsis } from 'lucide-react'
import { Button, Stage, Window } from '../../../kit'
import { DONE, LATER, NEXT, NOW, PLAN, SPAN, hourLabel } from '../../tempo-shared/data'
import './folio.css'

// E. Folio: Today as a printed page. A ruler runs the width of the window
// under the title bar, so the day is the first thing the eye crosses; under
// it, a 12-column page: the one task set large on the left, an index of what
// comes after on the right. One ink blue, used like a fountain pen: the now
// line, the next block, Start.
//
// Real strings: the nav, the timer, the task and its line, the verbs, three
// numbered rows, one capacity sentence.

const pct = (m: number) => `${(m / SPAN) * 100}%`

function Ruler() {
  const hours = Array.from({ length: 13 }, (_, i) => i)
  return (
    <div className="fo-ruler" aria-hidden>
      <div className="fo-ruler__track">
        {Array.from({ length: 25 }, (_, i) => <span key={i} className={`fo-tick${i % 2 ? '' : ' fo-tick--hour'}`} style={{ left: pct(i * 30) }} />)}
        {hours.filter((h) => h % 2 === 0).map((h) => <span key={h} className="fo-hour" style={{ left: pct(h * 60) }}>{hourLabel(h + 8)}</span>)}
        {DONE.map((b, i) => <span key={i} className="fo-blk fo-blk--done" style={{ left: pct(b.a), width: pct(b.b - b.a) }} />)}
        {PLAN.map((b, i) => <span key={i} className={`fo-blk ${b.next ? 'fo-blk--next' : 'fo-blk--plan'}`} style={{ left: pct(b.a), width: pct(b.b - b.a) }} />)}
        <span className="fo-now" style={{ left: pct(NOW) }}><b>2:14</b></span>
      </div>
    </div>
  )
}

export default function Folio() {
  return (
    <Stage width={1040} height={580} fidelity="realistic" className="tm-fo">
      {() => (
        <Window
          className="fo-win"
          lead={
            <nav className="fo-nav">
              <span className="fo-word">Tempo</span>
              <span data-on>Today</span><span>Plan</span><span>Time</span><span>Everything</span>
            </nav>
          }
          toolbar={
            <div className="fo-tools">
              <span className="fo-timer"><span className="fo-timer__dot" /><span>CSV export fixes</span><b>41:08</b></span>
              <Search size={15} strokeWidth={1.75} />
              <Ellipsis size={15} strokeWidth={1.75} />
            </div>
          }
        >
          <Ruler />
          <div className="fo-page">
            <div className="fo-lead">
              <div className="fo-kicker">Next, about {NEXT.mins} minutes</div>
              <div className="fo-title">{NEXT.title}</div>
              <div className="fo-detail">{NEXT.detail}. It fits before 3:00 pm.</div>
              <div className="fo-actions">
                <Button variant="primary" size="large" className="fo-start" icon={<Play size={13} fill="currentColor" strokeWidth={0} />}>Start</Button>
                <Button size="large" className="fo-ghostline">Not today</Button>
                <span className="fo-link">Open</span>
              </div>
            </div>
            <aside className="fo-index">
              <div className="fo-index__head">After that</div>
              {LATER.map((r, i) => (
                <div key={r.title} className="fo-item">
                  <span className="fo-item__n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="fo-item__body">
                    <span className="fo-item__title">{r.title}</span>
                    <span className="fo-item__meta">{r.at} · {r.mins} min</span>
                  </span>
                </div>
              ))}
              <div className="fo-room">Then room for about 3 hours.</div>
            </aside>
          </div>
        </Window>
      )}
    </Stage>
  )
}
