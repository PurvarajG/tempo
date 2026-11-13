import { CalendarArrowUp, Check, CornerDownLeft, Play, Plus } from 'lucide-react'
import { Button, Kbd, Stage, Window } from '../../kit'
import { TopBar } from '../tempo-shared/TopBar'
import { AFTERNOON, ANYTIME, DONE_BLOCKS, JUST_DONE, NOW, TYPED, hourLabel, type Task } from '../tempo-shared/dash'
import './ledger.css'

// H. Ledger, round 3. The day tape across the top now reads as a ruler you
// live on: the past is shaded, each hour has its rule, the blocks carry
// their names where they fit, and now is a capsule riding the line. The
// table's input row fills its own columns as you type. The selected row
// opens one line deeper: what the task is about, its verbs, and the keys
// that do them.

const SPAN = 720
const pct = (m: number) => `${(m / SPAN) * 100}%`

function Tape() {
  const plan = AFTERNOON.map((t) => ({ a: t.start!, b: t.start! + t.mins, tone: t.tone, next: t.start === 375 }))
  return (
    <div className="lg-strip" aria-hidden>
      <div className="lg-tape">
        <span className="lg-past" style={{ width: pct(NOW) }} />
        {Array.from({ length: 13 }, (_, h) => (
          <span key={h} className="lg-hr" style={{ left: pct(h * 60) }}>{h % 2 === 0 && <b>{hourLabel(8 + h)}</b>}</span>
        ))}
        {DONE_BLOCKS.map((b) => <span key={b.a} className="lg-blk lg-blk--done" style={{ left: pct(b.a), width: pct(b.b - b.a) }}>{b.b - b.a > 70 ? b.title : ''}</span>)}
        {plan.map((b) => <span key={b.a} className={`lg-blk ${b.next ? 'lg-blk--next' : 'lg-blk--plan'} lg-tone--${b.tone}`} style={{ left: pct(b.a), width: pct(b.b - b.a) }} />)}
        <span className="lg-room" style={{ left: pct(505), width: pct(SPAN - 505) }}>Room for about 3 hours</span>
        <span className="lg-now" style={{ left: pct(NOW) }}><b>2:14</b></span>
      </div>
    </div>
  )
}

function Rec({ t, done }: { t: Task; done?: boolean }) {
  return (
    <div className="lg-tr" data-done={done || undefined}>
      <span className="lg-box">{done && <Check size={11} strokeWidth={3} />}</span>
      <span className="lg-title">{t.title}</span>
      <span className="lg-cell"><span className={`lg-proj lg-proj--${t.tone}`}>{t.project}</span></span>
      <span className="lg-cell lg-num">{t.at ?? 'Any time'}</span>
      <span className="lg-cell lg-num lg-right">{t.mins}m</span>
    </div>
  )
}

function Selected({ t }: { t: Task }) {
  return (
    <div className="lg-sel">
      <div className="lg-tr lg-tr--bare">
        <span className="lg-box" />
        <span className="lg-title">{t.title}</span>
        <span className="lg-cell"><span className={`lg-proj lg-proj--${t.tone}`}>{t.project}</span></span>
        <span className="lg-cell lg-num">{t.at}</span>
        <span className="lg-cell lg-num lg-right">{t.mins}m</span>
      </div>
      <div className="lg-sel__more">
        <span className="lg-sel__note">Invoice #0142 for £1,860.00, sent 3 November</span>
        <span className="lg-sel__act">
          <Button variant="primary" size="small" className="lg-start" icon={<Play size={11} fill="currentColor" strokeWidth={0} />}>Start</Button>
          <Button size="small" className="lg-quiet" icon={<CalendarArrowUp size={12} strokeWidth={2} />}>Tomorrow</Button>
          <Button variant="ghost" size="small">Not today</Button>
        </span>
        <span className="lg-keys"><span><Kbd keys={['Space']} />start</span><span><Kbd keys={['T']} />tomorrow</span><span><Kbd keys={['N']} />not today</span></span>
      </div>
    </div>
  )
}

export default function Ledger() {
  return (
    <Stage width={1040} height={680} fidelity="realistic" className="tm-tb tm-lg">
      {() => (
        <Window className="lg-win" barSize="tall" lead={<span />} toolbar={<TopBar />}>
          <Tape />
          <div className="lg-table">
            <div className="lg-th"><span /><span>Task</span><span>Project</span><span>When</span><span className="lg-right">Est.</span></div>
            <div className="lg-tr lg-input">
              <Plus size={15} strokeWidth={2} className="lg-plus" />
              <span className="lg-typed">
                {TYPED.filter((p) => p.text.trim()).map((p, i) => <span key={i} className={p.token ? 'lg-tok' : undefined}>{p.text.trim()}</span>)}
                <span className="lg-caret" />
              </span>
              <span className="lg-cell lg-ghost"><span className="lg-proj lg-proj--home">Home</span></span>
              <span className="lg-cell lg-num lg-ghost">Tomorrow 10:00</span>
              <span className="lg-cell lg-num lg-ghost lg-right">15m<CornerDownLeft size={12} strokeWidth={2} className="lg-enter" /></span>
            </div>
            <div className="lg-group"><span>This afternoon</span><span className="lg-num">1h 25m</span></div>
            <Rec t={JUST_DONE} done />
            <Selected t={AFTERNOON[0]} />
            {AFTERNOON.slice(1).map((t) => <Rec key={t.title} t={t} />)}
            <div className="lg-group"><span>Any time today</span><span className="lg-num">15m</span></div>
            {ANYTIME.map((t) => <Rec key={t.title} t={t} />)}
          </div>
        </Window>
      )}
    </Stage>
  )
}
