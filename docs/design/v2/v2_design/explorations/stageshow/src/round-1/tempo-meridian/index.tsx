import { Play, Search, Ellipsis } from 'lucide-react'
import { Button, Stage, Window } from '../../../kit'
import { DONE, LATER, NEXT, NOW, PLAN, SPAN, hourLabel } from '../../tempo-shared/data'
import './meridian.css'

// D. Meridian: the day as one vertical rail beside the one task.
// Swiss and flat: no panel, no metal, no cards. The rail is the only
// picture of time; the column beside it is type. One deep green means
// "now", and appears in three places only: the now tick, the next block on
// the rail, and Start.
//
// Real strings: the nav, the timer, the date, the task and its line, the
// three verbs, three later rows with their times, and one capacity sentence.

const PX = 0.6 // rail px per minute: 8 am to 8 pm in 432px
const y = (m: number) => Math.round(m * PX)

function Rail() {
  return (
    <div className="mr-rail" aria-hidden>
      <div className="mr-rail__line" style={{ height: y(SPAN) }} />
      {[8, 10, 12, 14, 16, 18, 20].map((h) => (
        <span key={h} className="mr-rail__hour" style={{ top: y((h - 8) * 60) }}>{hourLabel(h)}</span>
      ))}
      {DONE.map((b, i) => <span key={i} className="mr-blk mr-blk--done" style={{ top: y(b.a), height: y(b.b - b.a) }} />)}
      {PLAN.map((b, i) => <span key={i} className={`mr-blk ${b.next ? 'mr-blk--next' : 'mr-blk--plan'}`} style={{ top: y(b.a) + 1, height: Math.max(3, y(b.b - b.a) - 1) }} />)}
      <span className="mr-blk mr-blk--free" style={{ top: y(500), height: y(SPAN - 500) }} />
      <span className="mr-now" style={{ top: y(NOW) }}><b>2:14</b></span>
    </div>
  )
}

export default function Meridian() {
  return (
    <Stage width={1040} height={640} fidelity="realistic" className="tm-mr">
      {() => (
        <Window
          className="mr-win"
          lead={
            <nav className="mr-nav">
              <span className="mr-word">Tempo</span>
              <span data-on>Today</span><span>Plan</span><span>Time</span><span>Everything</span>
            </nav>
          }
          toolbar={
            <div className="mr-tools">
              <span className="mr-timer"><span>CSV export fixes</span><b>41:08</b><span className="mr-timer__stop">Stop</span></span>
              <Search size={15} strokeWidth={1.75} />
              <Ellipsis size={15} strokeWidth={1.75} />
            </div>
          }
        >
          <div className="mr-body">
            <Rail />
            <div className="mr-main">
              <div className="mr-kicker"><span className="mr-dot" />Now <span className="mr-sep">·</span> {NEXT.mins} min</div>
              <div className="mr-title">{NEXT.title}</div>
              <div className="mr-detail">{NEXT.detail}. Fits before 3:00 pm.</div>
              <div className="mr-actions">
                <Button variant="primary" size="large" className="mr-start" icon={<Play size={13} fill="currentColor" strokeWidth={0} />}>Start</Button>
                <Button size="large">Not today</Button>
                <Button variant="ghost" size="large">Open</Button>
              </div>
              <div className="mr-later">
                <div className="mr-later__head">Later today</div>
                {LATER.map((r) => (
                  <div key={r.title} className="mr-row">
                    <span className="mr-row__at">{r.at}</span>
                    <span className="mr-row__title">{r.title}</span>
                    <span className="mr-row__mins">{r.mins} min</span>
                  </div>
                ))}
                <div className="mr-room">Room for about 3 hours more after 4:15.</div>
              </div>
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
