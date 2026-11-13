import { CalendarDays, Check, GripVertical, Hash, Play, Plus, Timer } from 'lucide-react'
import { Button, Stage, Window } from '../../kit'
import { TopBar } from '../tempo-shared/TopBar'
import { AFTERNOON, ANYTIME, DONE_BLOCKS, NOW, WEEK, hourLabel, type Task } from '../tempo-shared/dash'
import './planner.css'

// I. Planner, round 3. The day is the page. The header pairs a large date
// with the week, each day carrying a bar for how full it is, so moving work
// to a lighter day is one glance away. The still is caught mid-plan: a task
// lifted out of Not scheduled, carried over the day, and the slot it will
// land in drawn under it with its times. The composer at the foot turns
// what it recognises into chips inside the field.

const START = 300 // 1 pm
const END = 570 // 5:30 pm
const PX = 1.35
const y = (m: number) => Math.round((m - START) * PX)

const CARRIED: Task = ANYTIME[0]
const WAITING: Task[] = [ANYTIME[1], { title: 'Order new running shoes before Sunday', mins: 15, project: 'Running', tone: 'run' }]

function Block({ t }: { t: Task }) {
  const h = Math.max(20, y(t.start! + t.mins) - y(t.start!) - 3)
  const next = t.start === 375
  return (
    <div className={`pl-blk pl-tone--${t.tone}${next ? ' pl-blk--next' : ''}`} style={{ top: y(t.start!) + 1, height: h }} data-short={h < 30 || undefined}>
      <span className="pl-blk__title">{t.title}</span>
      {next ? (
        <Button variant="primary" size="small" className="pl-start" icon={<Play size={10} fill="currentColor" strokeWidth={0} />}>Start</Button>
      ) : <span className="pl-blk__meta">{t.mins}m</span>}
    </div>
  )
}

function Card({ t, carried }: { t: Task; carried?: boolean }) {
  return (
    <div className="pl-card" data-carried={carried || undefined} data-target={carried ? 'carried' : undefined}>
      <GripVertical size={14} strokeWidth={1.75} className="pl-grip" />
      <span className="pl-card__body">
        <span className="pl-card__title">{t.title}</span>
        <span className="pl-card__meta"><span className={`pl-proj pl-proj--${t.tone}`}>{t.project}</span><span>{t.mins}m</span></span>
      </span>
    </div>
  )
}

export default function Planner() {
  return (
    <Stage width={1040} height={700} fidelity="realistic" className="tm-tb tm-pl" cursor={{ at: { at: 'carried', x: 0.82, y: 0.74 }, kind: 'grab', still: true, idle: false }}>
      {() => (
        <Window className="pl-win" barSize="tall" lead={<span />} toolbar={<TopBar />}>
          <div className="pl-body">
            <aside className="pl-side">
              <div className="pl-head"><span>Not scheduled</span><span className="pl-muted">3</span></div>
              <div className="pl-slot" />
              {WAITING.map((t) => <Card key={t.title} t={t} />)}
              <div className="pl-head pl-head--gap"><span>Done today</span><span className="pl-muted">2h 40m</span></div>
              {[...DONE_BLOCKS].reverse().slice(0, 2).map((b) => (
                <div key={b.a} className="pl-done"><Check size={13} strokeWidth={2.25} /><span>{b.title}</span></div>
              ))}
            </aside>
            <section className="pl-day">
              <header className="pl-dayhead">
                <div className="pl-date"><b>Thursday 12</b><span>2h 40m done, room for about 3 hours</span></div>
                <div className="pl-week" aria-label="This week">
                  {WEEK.map((d) => (
                    <span key={d.d} className="pl-wd" data-today={d.today || undefined}>
                      <span className="pl-wd__bar"><i style={{ height: `${Math.round(d.load * 100)}%` }} /></span>
                      <span className="pl-wd__d">{d.d}</span>
                    </span>
                  ))}
                </div>
              </header>
              <div className="pl-grid" style={{ height: y(END) }}>
                {Array.from({ length: 5 }, (_, i) => START + i * 60).map((m) => (
                  <span key={m} className="pl-hour" style={{ top: y(m) }}><b>{hourLabel(8 + m / 60)}{m === 300 ? ' pm' : ''}</b></span>
                ))}
                {DONE_BLOCKS.filter((b) => b.b > START).map((b) => (
                  <div key={b.a} className="pl-blk pl-blk--done" style={{ top: y(b.a) + 1, height: y(b.b) - y(b.a) - 3 }}><span className="pl-blk__title">{b.title}</span><span className="pl-blk__meta">Done</span></div>
                ))}
                {AFTERNOON.map((t) => <Block key={t.title} t={t} />)}
                <div className="pl-free" style={{ top: y(497), height: y(END) - y(497) }} />
                <div className="pl-ghost" style={{ top: y(510) }}><span>4:30 to 4:40</span></div>
                <div className="pl-carry" style={{ top: y(497) + 6 }}><Card t={CARRIED} carried /></div>
                <span className="pl-now" style={{ top: y(NOW) }}><b>2:14</b></span>
              </div>
            </section>
            <div className="pl-composer">
              <Plus size={16} strokeWidth={1.75} className="pl-composer__plus" />
              <span className="pl-composer__text">
                Call the bank about the new card
                <span className="pl-chip"><CalendarDays size={12} strokeWidth={2} />Tomorrow 10:00</span>
                <span className="pl-chip"><Timer size={12} strokeWidth={2} />15m</span>
                <span className="pl-chip"><Hash size={12} strokeWidth={2} />Home</span>
                <span className="pl-caret" />
              </span>
              <Button variant="primary" className="pl-plan">Plan</Button>
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
