import { Play, Undo2 } from 'lucide-react'
import { Button, Stage, Window } from '../../../kit'
import { DONE, LATER, NEXT, NOW, PLAN } from '../../tempo-shared/data'
import './station.css'

// F. Station: Tempo as a half-screen companion. The working day, 8 to 8, is
// exactly twelve hours, so the day is drawn on a clock face: what's done is a
// solid arc, what's planned an outlined one, the next task the one black arc,
// and now is a single red hand. Aluminium and black otherwise; the red hand
// is the only colour on the screen. It also shows the one feedback pattern
// every action uses: a toast with Undo at the foot of the window.
//
// Real strings: the nav, the timer, the task and its line, the verbs, two
// later rows, the toast.

const C = 104 // dial centre
const R = 84 // ring radius
const deg = (m: number) => (((8 + m / 60) % 12) * 30 * Math.PI) / 180
const pt = (m: number, r: number) => [C + r * Math.sin(deg(m)), C - r * Math.cos(deg(m))]
function arc(a: number, b: number, r = R) {
  const [x1, y1] = pt(a, r)
  const [x2, y2] = pt(b, r)
  const large = b - a > 360 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

function Dial() {
  const [hx, hy] = pt(NOW, R + 14)
  const [tx, ty] = pt(NOW, -12)
  return (
    <svg className="st-dial" viewBox="0 0 208 208" width={208} height={208} aria-hidden>
      <circle cx={C} cy={C} r={R} className="st-track" />
      {Array.from({ length: 48 }, (_, i) => {
        const m = i * 15
        const major = i % 4 === 0
        const [x1, y1] = pt(m, R + 10)
        const [x2, y2] = pt(m, R + (major ? 18 : 14))
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'st-tick st-tick--major' : 'st-tick'} />
      })}
      {DONE.map((b, i) => <path key={i} d={arc(b.a + 1, b.b - 1)} className="st-arc st-arc--done" />)}
      {PLAN.map((b, i) => <path key={i} d={arc(b.a + 1.5, b.b - 1.5)} className={`st-arc ${b.next ? 'st-arc--next' : 'st-arc--plan'}`} />)}
      {[0, 3, 6, 9].map((h) => {
        const m = ((h - 8 + 12) % 12) * 60
        const [x, y] = pt(m, R - 22)
        return <text key={h} x={x} y={y} className="st-num" textAnchor="middle" dominantBaseline="central">{h === 0 ? 12 : h}</text>
      })}
      <line x1={tx} y1={ty} x2={hx} y2={hy} className="st-hand" />
      <circle cx={C} cy={C} r={4} className="st-cap" />
    </svg>
  )
}

export default function Station() {
  return (
    <Stage width={880} height={700} fidelity="realistic" className="tm-st">
      {() => (
        <Window
          className="st-win"
          lead={
            <nav className="st-nav">
              <span data-on>Today</span><span>Plan</span><span>Time</span><span>Everything</span>
            </nav>
          }
          toolbar={<span className="st-timer"><b>41:08</b><span className="st-timer__stop" /></span>}
        >
          <div className="st-body">
            <div className="st-top">
              <Dial />
              <div className="st-legend">
                <div className="st-date">Thursday 12 November</div>
                <div className="st-time">2:14<span>pm</span></div>
                <div className="st-room">Room for about 3 hours more today.</div>
              </div>
            </div>
            <div className="st-next">
              <div className="st-kicker">Next · {NEXT.mins} min · until 2:40</div>
              <div className="st-title">{NEXT.title}</div>
              <div className="st-detail">{NEXT.detail}</div>
              <div className="st-actions">
                <Button variant="primary" size="large" className="st-start" icon={<Play size={13} fill="currentColor" strokeWidth={0} />}>Start</Button>
                <Button size="large" className="st-quiet">Not today</Button>
              </div>
            </div>
            <div className="st-later">
              {LATER.slice(0, 1).map((r) => (
                <div key={r.title} className="st-row"><span className="st-row__at">{r.at}</span><span className="st-row__title">{r.title}</span></div>
              ))}
            </div>
            <div className="st-toast" role="status">
              <span>Moved “Book a dentist slot” to tomorrow</span>
              <span className="st-toast__undo"><Undo2 size={13} strokeWidth={2} />Undo</span>
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
