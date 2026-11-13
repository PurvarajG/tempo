// Round 2: Today as a dashboard of tasks, input and day. Same day as the
// Fader mock: Thursday 12 November, 2:14 pm. Minutes are after 8:00 am.
export type Task = { title: string; mins: number; project: string; tone: 'studio' | 'tempo' | 'personal' | 'run' | 'home'; at?: string; start?: number }

export const AFTERNOON: Task[] = [
  { title: 'Send the overdue invoice reminder to Halden Studio', mins: 25, project: 'Studio', tone: 'studio', at: '2:15', start: 375 },
  { title: 'Review Mira’s pull request on the CSV export', mins: 40, project: 'Tempo', tone: 'tempo', at: '3:00', start: 420 },
  { title: 'Book a dentist slot for next week', mins: 5, project: 'Personal', tone: 'personal', at: '3:45', start: 465 },
  { title: 'Plan Sunday’s 14 km long run', mins: 15, project: 'Running', tone: 'run', at: '4:00', start: 480 },
]

export const ANYTIME: Task[] = [
  { title: 'Reply to Mr Okafor about the boiler service', mins: 10, project: 'Home', tone: 'home' },
  { title: 'Renew the domain for halden.studio', mins: 5, project: 'Studio', tone: 'studio' },
]

export const DONE_BLOCKS = [
  { a: 60, b: 150, title: 'Client call prep' },
  { a: 180, b: 255, title: 'Studio site copy' },
  { a: 333, b: 372, title: 'CSV export fixes' },
]

// What's being typed into the input, split into the words and the tokens
// the parser recognised.
export const TYPED: { text: string; token?: string }[] = [
  { text: 'Call the bank about the new card ' },
  { text: 'tomorrow 10am', token: 'when' },
  { text: ' ' },
  { text: '15m', token: 'mins' },
  { text: ' ' },
  { text: '#home', token: 'project' },
]

export const PARSED = [
  { label: 'Tomorrow, 10:00 am', kind: 'when' },
  { label: '15 min', kind: 'mins' },
  { label: 'Home', kind: 'project' },
]

export const NOW = 374
export const hourLabel = (h: number) => (h === 12 ? '12' : String(h > 12 ? h - 12 : h))

// Round 3: a task finished a moment ago, still on screen with its undo.
export const JUST_DONE: Task = { title: 'Draft the April retainer email', mins: 20, project: 'Studio', tone: 'studio', at: '1:40' }

export const FILTERS = [
  { label: 'All', n: 6 },
  { label: 'Studio', n: 2, tone: 'studio' },
  { label: 'Tempo', n: 1, tone: 'tempo' },
  { label: 'Personal', n: 1, tone: 'personal' },
  { label: 'Running', n: 1, tone: 'run' },
  { label: 'Home', n: 1, tone: 'home' },
] as const

export const WEEK = [
  { d: 'Mon', n: 9, load: 0.7 },
  { d: 'Tue', n: 10, load: 0.9 },
  { d: 'Wed', n: 11, load: 0.55 },
  { d: 'Thu', n: 12, load: 0.6, today: true },
  { d: 'Fri', n: 13, load: 0.35 },
  { d: 'Sat', n: 14, load: 0.1 },
  { d: 'Sun', n: 15, load: 0.25 },
]
