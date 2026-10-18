import { avatar, check, icons, intro, section } from '../parts'

// 03 · Ana's request, the planner agent's draft of the Ocean Beach week against
// the Square forecast, and the person who publishes it.
const tabs = [
  ['North Park · 28 staff · 1,001.0 hrs', false], ['Barrio Logan · 20 · 732.5 hrs', false],
  ['Ocean Beach · 16 · 489.5 hrs', true], ['All three · 64 · 2,223.0 hrs', false],
] as const
const days = ['Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Fri 23', 'Sat 24', 'Sun 25']
const rows = {
  bakers: ['8.0', '8.0', '8.0', '8.0', '16.0', '16.0', '16.0', '80.0'],
  baristas: ['46.0', '44.0', '46.0', '49.0', '62.0', '86.5', '76.0', '409.5'],
  forecast: ['$4,400', '$4,200', '$4,400', '$4,700', '$6,400', '$8,000', '$7,400', '$39,500'],
  cost: ['$1,050.00', '$1,012.00', '$1,050.00', '$1,107.00', '$1,530.00', '$1,995.50', '$1,796.00', '$9,540.50'],
  labor: ['23.9%', '24.1%', '23.9%', '23.6%', '23.9%', '24.9%', '24.3%', '24.2%'],
}
const notes = [
  { who: 'NB', tone: 'pink', name: 'Nia Brooks', text: 'approved leave Mon Oct 19 → Sam Patel takes Barrio Logan 6:30–2:30' },
  { who: 'GL', tone: 'sea', name: 'Grace Lee', text: 'would reach 41.5 hrs → Fri close moved to Dev Shah · no overtime' },
  { who: 'RJ', tone: 'pink', name: 'Rosa Jimenez', text: 'food handler card expires Fri Oct 30 · reminder sent', after: '<span class="note-done">Renewed Mon Oct 19 ' + check() + '</span>' },
] as const

const row = (label: string, values: readonly string[], className = '', mark = (value: string) => value) => `<tr class="${className}"><th scope="row">${label}</th>${values.map((value, index) => `<td class="${index === 5 ? 'sat' : index === 7 ? 'week' : ''}">${mark(value)}</td>`).join('')}</tr>`
const dot = (value: string) => `<span class="labor-dot" aria-hidden="true"></span>${value}`

function builder(): string {
  const table = `<div class="builder-scroll"><table class="builder-table"><caption class="sr-only">Ocean Beach draft, week of Mon Oct 19</caption><thead><tr><td></td>${days.map((day, index) => `<th scope="col" class="${index === 5 ? 'sat' : ''}">${day}</th>`).join('')}<th scope="col" class="week">Week</th></tr></thead><tbody>`
    + row('Bakers · $22.00', rows.bakers) + row('Baristas and counter · $19.00', rows.baristas, 'group-end')
    + row('Square forecast', rows.forecast) + row('Scheduled cost', rows.cost) + row('Labor % · budget 25%', rows.labor, 'labor', dot)
    + `</tbody></table></div>`
  const phone = `<ol class="builder-days" aria-label="Ocean Beach draft by day">${[0, 'mid', 4, 5, 6].map(entry => entry === 'mid'
    ? `<li class="builder-mid">Tue ${rows.labor[1]} · Wed ${rows.labor[2]} · Thu ${rows.labor[3]}</li>`
    : `<li class="builder-day${entry === 5 ? ' is-sat' : ''}"><p class="builder-day-name">${days[entry as number].replace(/(\w+) (\d+)/, '$1 $2').toUpperCase()}</p><p>Bakers ${rows.bakers[entry as number]} · Baristas and counter ${rows.baristas[entry as number]}</p><p>Forecast ${rows.forecast[entry as number]} · Cost ${rows.cost[entry as number]} · ${rows.labor[entry as number]}</p></li>`).join('')}</ol>`
    + `<p class="builder-week">${icons.bars}<span><strong>Week</strong> · 489.5 hrs · forecast $39,500 · cost $9,540.50 · labor 24.2% · budget 25% ${check()}</span></p>`
  return `<div class="builder card"><ul class="builder-tabs" aria-label="Cafes">${tabs.map(([label, current]) => `<li${current ? ' class="is-current" aria-current="true"' : ''}>${label}</li>`).join('')}</ul>${table}${phone}<div class="builder-publish"><p>${check('published')} Published Wed Oct 14 · 4:30 pm</p><span class="publish-button">Publish week</span></div></div>`
}

function rail(): string {
  const request = `<div class="card request"><p class="request-who">${avatar('AR')}<span><strong>Ana Reyes</strong> · Mon Oct 12, 2:10 pm</span></p><blockquote>“Copy last week, use the Square forecast, keep everyone under 40.”</blockquote><p class="request-agent">${icons.sparkle}<span><strong>Planner agent</strong> · drafted 2:12 pm</span></p></div>`
  const list = notes.map(note => `<li class="card note">${avatar(note.who, note.tone)}<p><strong>${note.name}</strong> · ${note.text}${'after' in note ? `<br>${note.after}` : ` ${check()}`}</p></li>`).join('')
  return `<div class="builder-rail">${request}<p class="rail-agent">${icons.sparkle}<span><strong>Planner agent</strong> · drafted 2:12 pm</span></p><ul class="notes">${list}</ul></div>`
}

export const build = () => section('build', 'white', `<div class="site-width">${intro('build', 'Build · Mon Oct 12 – Wed Oct 14', 'Built from what Saturday will sell.', 'Ana asks for last week’s pattern, the Square forecast and nobody over 40 hours. Lanyard drafts the week with each day’s cost against budget.', 'intro-wide')}<div class="builder-layout">${builder()}${rail()}</div></div>`)
