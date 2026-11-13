import { CalendarArrowUp, CalendarDays, Check, Ellipsis, Hash, PencilLine, Play, Timer } from 'lucide-react'
import { Button, Kbd, Stage, Window } from '../../kit'
import { TopBar } from '../tempo-shared/TopBar'
import { AFTERNOON, ANYTIME, DONE_BLOCKS, FILTERS, JUST_DONE, NOW, PARSED, TYPED, hourLabel, type Task } from '../tempo-shared/dash'
import './docket.css'

// G. Docket, round 3. The command bar sits beside a large date, with a
// two-way switch (Add or Find) and the parse preview under it. The list gets
// the working states a real day has: a filter row, a task finished a moment
// ago with its Undo, the selected task carrying Start, and the row under the
// pointer showing its quick actions. The day card opens on one stacked bar
// (done, planned, free) above the hour column.

const ICON = { when: <CalendarDays size={13} strokeWidth={1.75} />, mins: <Timer size={13} strokeWidth={1.75} />, project: <Hash size={13} strokeWidth={1.75} /> }

function TaskRow({ t, state }: { t: Task; state?: 'selected' | 'hover' | 'done' }) {
  return (
    <div className="dk-row" data-state={state}>
      <span className="dk-row__at">{t.at ?? ''}</span>
      <span className="dk-check">{state === 'done' && <Check size={11} strokeWidth={3} />}</span>
      <span className="dk-row__title">{t.title}</span>
      {state === 'selected' ? (
        <span className="dk-row__act">
          <Button variant="primary" size="small" className="dk-start" icon={<Play size={11} fill="currentColor" strokeWidth={0} />}>Start</Button>
          <Button variant="ghost" size="small">Not today</Button>
        </span>
      ) : state === 'hover' ? (
        <span className="dk-row__tools">
          <span title="Tomorrow"><CalendarArrowUp size={15} strokeWidth={1.75} /></span>
          <span title="Edit"><PencilLine size={15} strokeWidth={1.75} /></span>
          <span title="More"><Ellipsis size={15} strokeWidth={1.75} /></span>
        </span>
      ) : (
        <span className="dk-row__meta"><span className={`dk-proj dk-proj--${t.tone}`}>{t.project}</span><span className="dk-row__mins">{t.mins}m</span></span>
      )}
    </div>
  )
}

const START = 300 // 1 pm
const END = 660 // 7 pm
const PX = 1.0
const y = (m: number) => Math.round((m - START) * PX)

function DayCard() {
  const plan = AFTERNOON.map((t) => ({ a: t.start!, b: t.start! + t.mins, title: t.title, tone: t.tone, next: t.start === 375 }))
  const total = 160 + 85 + 180
  return (
    <div className="dk-day">
      <div className="dk-day__head"><span>Your day</span><span className="dk-muted">8 am to 8 pm</span></div>
      <div className="dk-cap" aria-hidden>
        <span className="dk-cap__done" style={{ flex: 160 / total }} />
        <span className="dk-cap__plan" style={{ flex: 85 / total }} />
        <span className="dk-cap__free" style={{ flex: 180 / total }} />
      </div>
      <div className="dk-legend">
        <span><i className="dk-cap__done" />2h 40m done</span>
        <span><i className="dk-cap__plan" />1h 25m</span>
        <span><i className="dk-cap__free" />3h free</span>
      </div>
      <div className="dk-day__grid" style={{ height: y(END) }}>
        {Array.from({ length: 7 }, (_, i) => START + i * 60).filter((m) => Math.abs(m - NOW) > 25).map((m) => (
          <span key={m} className="dk-hour" style={{ top: y(m) }}><b>{hourLabel(8 + m / 60)}</b></span>
        ))}
        {DONE_BLOCKS.filter((b) => b.a >= START).map((b) => (
          <span key={b.a} className="dk-blk dk-blk--done" style={{ top: y(b.a) + 1, height: y(b.b) - y(b.a) - 2 }}>{b.title}</span>
        ))}
        {plan.map((b) => (
          <span key={b.a} className={`dk-blk ${b.next ? 'dk-blk--next' : 'dk-blk--plan'} dk-tone--${b.tone}`} style={{ top: y(b.a) + 1, height: Math.max(8, y(b.b) - y(b.a) - 2) }}>{y(b.b) - y(b.a) > 16 ? b.title : ''}</span>
        ))}
        <span className="dk-free" style={{ top: y(500), height: y(END) - y(500) - 2 }} />
        <span className="dk-now" style={{ top: y(NOW) }}><b>2:14</b></span>
      </div>
    </div>
  )
}

export default function Docket() {
  return (
    <Stage width={1040} height={680} fidelity="realistic" className="tm-tb tm-dk">
      {() => (
        <Window className="dk-win" barSize="tall" lead={<span />} toolbar={<TopBar />}>
          <div className="dk-body">
            <header className="dk-top">
              <div className="dk-date">
                <span className="dk-date__day">Thursday</span>
                <span className="dk-date__sub">12 November, 6 tasks left</span>
              </div>
              <div className="dk-capture">
                <div className="dk-field">
                  <span className="dk-mode"><span data-on>Add</span><span>Find</span></span>
                  <span className="dk-field__text">
                    {TYPED.filter((p) => p.text.trim()).map((p) => (p.token ? p : { ...p, text: 'Call the bank about the card' })).map((p, i) => <span key={i} className={p.token ? `dk-tok dk-tok--${p.token}` : undefined}>{p.text.trim()}</span>)}
                    <span className="dk-caret" />
                  </span>
                  <Kbd keys={['↵']} className="dk-enter" />
                </div>
                <div className="dk-parse">
                  {PARSED.map((c) => <span key={c.kind} className={`dk-chip dk-chip--${c.kind}`}>{ICON[c.kind as keyof typeof ICON]}{c.label}</span>)}
                </div>
              </div>
            </header>
            <div className="dk-grid">
              <div className="dk-list">
                <div className="dk-filters">
                  {FILTERS.map((f, i) => (
                    <span key={f.label} className={`dk-filter${'tone' in f ? ` dk-proj--${f.tone}` : ''}`} data-on={i === 0 || undefined}>
                      {'tone' in f && <i />}{f.label}<b>{f.n}</b>
                    </span>
                  ))}
                </div>
                <div className="dk-group"><span>This afternoon</span><span className="dk-muted">1h 25m</span></div>
                <TaskRow t={JUST_DONE} state="done" />
                {AFTERNOON.map((t, i) => <TaskRow key={t.title} t={t} state={i === 0 ? 'selected' : i === 1 ? 'hover' : undefined} />)}
                <div className="dk-group dk-group--gap"><span>Any time today</span><span className="dk-muted">15m</span></div>
                {ANYTIME.map((t) => <TaskRow key={t.title} t={t} />)}
              </div>
              <DayCard />
            </div>
            <div className="dk-toast" role="status">
              <span className="dk-toast__ok"><Check size={12} strokeWidth={3} /></span>
              <span className="dk-toast__msg">Done: Draft the April retainer email</span>
              <span className="dk-toast__undo">Undo <Kbd keys={['⌘', 'Z']} plain /></span>
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
