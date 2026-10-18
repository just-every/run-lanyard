import { check, icons, intro, section } from '../parts'

// 02 · One week at Tres Hornos across three cafes: a swim-lane calendar on wide
// screens and day cards on phones, both drawn from the same events.
type Lane = 'NP' | 'BL' | 'OB' | 'All'
const lanes = [
  { key: 'NP', name: 'North Park', staff: '28 staff' },
  { key: 'BL', name: 'Barrio Logan', staff: '20' },
  { key: 'OB', name: 'Ocean Beach', staff: '16' },
] as const
const days = [
  { key: 'before', label: 'Before · Wed Oct 14 – Thu Oct 15', short: 'Before · Wed Oct 14 – Thu Oct 15' },
  { key: 'mon', label: 'Mon Oct 19' }, { key: 'tue', label: 'Tue Oct 20' }, { key: 'wed', label: 'Wed Oct 21' },
  { key: 'thu', label: 'Thu Oct 22' }, { key: 'fri', label: 'Fri Oct 23' }, { key: 'sat', label: 'Sat Oct 24' },
  { key: 'sun', label: 'Sun Oct 25' }, { key: 'after', label: 'After · Mon Oct 26 – Tue Oct 27' },
] as const
type Day = typeof days[number]['key']
const events: { day: Day; lane: Lane; text: string; alert?: true }[] = [
  { day: 'before', lane: 'All', text: '4:30 pm · week published · English and Spanish' },
  { day: 'before', lane: 'All', text: '64 of 64 confirmed · Thu 11:20 am' },
  { day: 'mon', lane: 'BL', text: 'Nia on leave → Sam Patel 6:30–2:30' },
  { day: 'tue', lane: 'NP', text: '5:01 am · Rosa Jimenez in · photo' },
  { day: 'tue', lane: 'BL', text: 'Swap · Nia Brooks ⇄ Sam Patel for Sun' },
  { day: 'wed', lane: 'NP', text: 'Ben Carter’s late meal → $19.00 premium' },
  { day: 'thu', lane: 'OB', text: '8:14 pm · Tomas Silva picks up Sat 9–1' },
  { day: 'sat', lane: 'OB', text: '6:12 am · Jess Morales calls out → Luis Ortega in 6:56', alert: true },
  { day: 'sat', lane: 'OB', text: '12:40 pm · Tomas stays · no overtime' },
  { day: 'sat', lane: 'OB', text: '$9,140 · labor 23.1% · tips $814.00' },
  { day: 'sun', lane: 'BL', text: 'Marisol Peña’s missing clock-out → fixed Mon 8:20' },
  { day: 'after', lane: 'All', text: 'Mon · 11:40 am · 64 of 64 timesheets approved' },
  { day: 'after', lane: 'All', text: 'Tue · 9:00 am · Gusto read back' },
]
const footer = 'Scheduled 2,223.0 hrs · worked 2,229.0 + paid sick 7.5 = 2,236.5 hrs to Gusto · overtime 0.0'

const chip = (event: typeof events[number]) => event.alert
  ? `<li class="chip chip-alert">${event.text} ${check('covered')}</li>`
  : `<li class="chip">${event.text} ${check()}</li>`
// Luis's cross-town route runs down the Saturday column from North Park to the call-out at Ocean Beach.
const route = '<div class="week-route" aria-hidden="true"><span class="route-label"><span class="route-dot"></span>Luis · North Park → Ocean Beach</span><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M14 4 C 30 30, 46 52, 44 96" fill="none" vector-effect="non-scaling-stroke"/></svg><span class="route-head"></span></div>'

function grid(): string {
  const head = days.map(day => `<div class="week-day week-day-${day.key}" role="columnheader">${day.label}</div>`).join('')
  const bookend = (key: 'before' | 'after') => `<div class="week-cell week-bookend week-${key}" role="cell"><ul>${events.filter(event => event.day === key).map(chip).join('')}</ul></div>`
  const rows = lanes.map((lane, row) => days.filter(day => day.key !== 'before' && day.key !== 'after').map((day, column) => {
    const here = events.filter(event => event.day === day.key && event.lane === lane.key)
    const label = column === 0 ? `<p class="lane-label">${icons.pin}<span><strong>${lane.name}</strong>&nbsp;· ${lane.staff}</span></p>` : ''
    return `<div class="week-cell week-${day.key} lane-${lane.key}" style="grid-area:${row + 2} / ${column + 2}" role="cell">${label}${here.length ? `<ul>${here.map(chip).join('')}</ul>` : ''}</div>`
  }).join('')).join('')
  return `<div class="week-grid" role="table" aria-label="Tres Hornos Bakery, week of Mon Oct 19, by cafe and day">${head}${bookend('before')}${rows}${bookend('after')}${route}<p class="week-footer"><span>${footer} ${check()}</span></p></div>`
}

function dayCards(): string {
  const legend = `<ul class="week-legend" aria-label="Cafes">${lanes.map(lane => `<li>${icons.pin}${lane.name}&nbsp;· ${lane.staff.replace(' staff', '')}</li>`).join('')}</ul>`
  const cards = days.filter(day => events.some(event => event.day === day.key)).map(day => {
    const list = events.filter(event => event.day === day.key).map(event => event.alert
      ? `<li class="day-alert"><span class="lane-pill">${event.lane}</span><span>${event.text} ${check('covered')}</span></li><li class="day-route"><span>Luis · North Park → Ocean Beach</span></li>`
      : `<li><span class="lane-pill">${event.lane}</span><span>${event.text}</span> ${check()}</li>`).join('')
    return `<li class="day-card"><p class="day-title">${'short' in day ? day.short : day.label}</p><ul>${list}</ul></li>`
  }).join('')
  return `<div class="week-days">${legend}<ol class="day-cards" aria-label="The week, day by day">${cards}</ol><p class="week-footer-card"><span>${footer} ${check()}</span></p></div>`
}

export const week = () => section('week', 'tint', `<div class="site-width">${intro('week', 'Tres Hornos Bakery · Week of Mon Oct 19', 'One week, three cafes, 64 people.', 'Ana Reyes runs operations for three San Diego bakery-cafes. Follow her week, from the schedule going out to the hours landing in Gusto.', 'intro-split')}<div class="week-card">${grid()}${dayCards()}</div></div>`)
