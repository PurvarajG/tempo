// One content set for every direction, the same day as directions.html's
// Fader: Thursday 12 November, 2:14 pm. Minutes are after 8:00 am.
export const NOW = 374
export const SPAN = 720 // 8 am to 8 pm

export const NEXT = {
  title: 'Send the overdue invoice reminder to Halden Studio',
  detail: 'Invoice #0142 for £1,860.00',
  mins: 25,
  start: 375,
}

export const LATER = [
  { title: 'Review Mira’s pull request on the CSV export', mins: 40, start: 420, at: '3:00' },
  { title: 'Book a dentist slot for next week', mins: 5, start: 465, at: '3:45' },
  { title: 'Plan Sunday’s 14 km long run', mins: 15, start: 480, at: '4:00' },
]

// What the day already holds: two done blocks, the timer that just ended,
// then the plan.
export const DONE = [
  { a: 60, b: 150 },
  { a: 180, b: 255 },
  { a: 333, b: 372 },
]

export const PLAN = [
  { a: 375, b: 400, next: true },
  { a: 420, b: 460 },
  { a: 465, b: 470 },
  { a: 480, b: 495 },
]

export const hourLabel = (h: number) => (h === 12 ? '12' : String(h > 12 ? h - 12 : h))
