import { CalendarDays, Hash, Play, Plus, Timer } from 'lucide-react'
import { Button, Kbd, Stage, Window } from '../../../kit'
import { TopBar } from '../../tempo-shared/TopBar'
import { AFTERNOON, ANYTIME, DONE_BLOCKS, NOW, PARSED, TYPED, hourLabel, type Task } from '../../tempo-shared/dash'
import './docket.css'

// G. Docket: one command bar at the top of Today. You type a task in plain
// words and the parser shows what it understood as chips before you press
// Return, so a typo never silently becomes a project. Under it, the day's
// list in two groups and a day column on the right. The first task is
// selected, not enlarged: its row shows Start and Not today, the rest show
// their project and estimate. Porcelain and forest green.

const ICON = { when: <CalendarDays size={13} strokeWidth={1.75} />, mins: <Timer size={13} strokeWidth={1.75} />, project: <Hash size={13} strokeWidth={1.75} /> }

function TaskRow({ t, selected }: { t: Task; selected?: boolean }) {
  return (
    <div className="dk-row" data-selected={selected || undefined}>
      <span className="dk-row__at">{t.at ?? ''}</span>
      <span className="dk-check" />
      <span className="dk-row__title">{t.title}</span>
      {selected ? (
        <span className="dk-row__act">
          <Button variant="primary" size="small" className="dk-start" icon={<Play size={11} fill="currentColor" strokeWidth={0} />}>Start</Button>
          <Button variant="ghost" size="small">Not today</Button>
        </span>
      ) : (
        <span className="dk-row__meta"><span className={`dk-proj dk-proj--${t.tone}`}>{t.project}</span><span className="dk-row__mins">{t.mins}m</span></span>
      )}
    </div>
  )
}

const START = 240 // 12 pm
const END = 660 // 7 pm
const PX = 0.86
const y = (m: number) => Math.round((m - START) * PX)

function DayColumn() {
  const plan = AFTERNOON.map((t) => ({ a: t.start!, b: t.start! + t.mins, title: t.title, next: t.start === 375 }))
  return (
    <div className="dk-day">
      <div className="dk-day__head"><span>Your day</span><span className="dk-muted">About 3h free</span></div>
      <div className="dk-day__grid" style={{ height: y(END) }}>
        {Array.from({ length: 8 }, (_, i) => START + i * 60).filter((m) => Math.abs(m - NOW) > 25).map((m) => (
          <span key={m} className="dk-hour" style={{ top: y(m) }}><b>{hourLabel(8 + m / 60)}</b></span>
        ))}
        {DONE_BLOCKS.filter((b) => b.b > START).map((b) => (
          <span key={b.a} className="dk-blk dk-blk--done" style={{ top: y(Math.max(b.a, START)) + 1, height: y(b.b) - y(Math.max(b.a, START)) - 2 }}>{y(b.b) - y(b.a) > 18 ? b.title : ''}</span>
        ))}
        {plan.map((b) => (
          <span key={b.a} className={`dk-blk ${b.next ? 'dk-blk--next' : 'dk-blk--plan'}`} style={{ top: y(b.a) + 1, height: Math.max(8, y(b.b) - y(b.a) - 2) }}>{y(b.b) - y(b.a) > 16 ? b.title : ''}</span>
        ))}
        <span className="dk-free" style={{ top: y(500), height: y(END) - y(500) - 2 }} />
        <span className="dk-now" style={{ top: y(NOW) }}><b>2:14</b></span>
      </div>
    </div>
  )
}

export default function Docket() {
  return (
    <Stage width={1040} height={660} fidelity="realistic" className="tm-tb tm-dk">
      {() => (
        <Window className="dk-win" barSize="tall" lead={<span />} toolbar={<TopBar />}>
          <div className="dk-body">
            <div className="dk-capture">
              <div className="dk-field">
                <Plus size={16} strokeWidth={1.75} className="dk-field__plus" />
                <span className="dk-field__text">
                  {TYPED.map((p, i) => p.token ? <span key={i} className={`dk-tok dk-tok--${p.token}`}>{p.text}</span> : <span key={i}>{p.text}</span>)}
                  <span className="dk-caret" />
                </span>
                <Kbd keys={['↵']} className="dk-enter" />
              </div>
              <div className="dk-parse">
                <span className="dk-muted">Adds</span>
                {PARSED.map((c) => <span key={c.kind} className={`dk-chip dk-chip--${c.kind}`}>{ICON[c.kind as keyof typeof ICON]}{c.label}</span>)}
              </div>
            </div>
            <div className="dk-grid">
              <div className="dk-list">
                <div className="dk-group"><span>This afternoon</span><span className="dk-muted">4 tasks, 1h 25m</span></div>
                {AFTERNOON.map((t, i) => <TaskRow key={t.title} t={t} selected={i === 0} />)}
                <div className="dk-group dk-group--gap"><span>Any time today</span><span className="dk-muted">2 tasks</span></div>
                {ANYTIME.map((t) => <TaskRow key={t.title} t={t} />)}
              </div>
              <DayColumn />
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
