import { CornerDownLeft, Play, Plus } from 'lucide-react'
import { Button, Stage, Window } from '../../../kit'
import { TopBar } from '../../tempo-shared/TopBar'
import { AFTERNOON, ANYTIME, DONE_BLOCKS, NOW, TYPED, hourLabel, type Task } from '../../tempo-shared/dash'
import './ledger.css'

// H. Ledger: Today as one table. The day runs across the top as a strip;
// the input is the table's first row, and as you type, the parser fills the
// row's own columns (project, when, estimate) in a quieter ink, so you see
// exactly where the task will land before Return. The selected row carries
// Start; the rest are plain records. Stone paper, black ink, one oxblood.

const SPAN = 720
const pct = (m: number) => `${(m / SPAN) * 100}%`

function Strip() {
  const plan = AFTERNOON.map((t) => ({ a: t.start!, b: t.start! + t.mins, next: t.start === 375 }))
  return (
    <div className="lg-strip" aria-hidden>
      <div className="lg-strip__hours">
        {Array.from({ length: 7 }, (_, i) => i * 2).map((h) => <span key={h} style={{ left: pct(h * 60) }}>{hourLabel(8 + h)}</span>)}
      </div>
      <div className="lg-strip__track">
        {DONE_BLOCKS.map((b) => <span key={b.a} className="lg-blk lg-blk--done" style={{ left: pct(b.a), width: pct(b.b - b.a) }}>{b.b - b.a > 70 ? b.title : ''}</span>)}
        {plan.map((b) => <span key={b.a} className={`lg-blk ${b.next ? 'lg-blk--next' : 'lg-blk--plan'}`} style={{ left: pct(b.a), width: pct(b.b - b.a) }} />)}
        <span className="lg-now" style={{ left: pct(NOW) }}><b>2:14</b></span>
        <span className="lg-room" style={{ left: pct(510) }}>Room for about 3 hours</span>
      </div>
    </div>
  )
}

function Rec({ t, selected }: { t: Task; selected?: boolean }) {
  return (
    <div className="lg-tr" data-selected={selected || undefined}>
      <span className="lg-box" />
      <span className="lg-title">{t.title}</span>
      <span className="lg-cell">{selected ? (
        <span className="lg-act">
          <Button variant="primary" size="small" className="lg-start" icon={<Play size={11} fill="currentColor" strokeWidth={0} />}>Start</Button>
          <Button variant="ghost" size="small">Not today</Button>
        </span>
      ) : <span className={`lg-proj lg-proj--${t.tone}`}>{t.project}</span>}</span>
      <span className="lg-cell lg-num">{t.at ?? 'Any time'}</span>
      <span className="lg-cell lg-num lg-right">{t.mins}m</span>
    </div>
  )
}

export default function Ledger() {
  return (
    <Stage width={1040} height={660} fidelity="realistic" className="tm-tb tm-lg">
      {() => (
        <Window className="lg-win" barSize="tall" lead={<span />} toolbar={<TopBar />}>
          <Strip />
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
            <div className="lg-group">This afternoon</div>
            {AFTERNOON.map((t, i) => <Rec key={t.title} t={t} selected={i === 0} />)}
            <div className="lg-group">Any time today</div>
            {ANYTIME.map((t) => <Rec key={t.title} t={t} />)}
          </div>
        </Window>
      )}
    </Stage>
  )
}
