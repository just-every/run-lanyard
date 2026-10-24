import { check, icons, intro, section } from '../parts'

// 12 · The weekend move off Deputy: Ana's import review, the totals and Gusto
// checks, and the one line that starts Lanyard on your own computer.
const rows = [
  '<strong>63</strong> people · <strong>3</strong> locations · <strong>5</strong> jobs',
  '<strong>63</strong> availability patterns · <strong>63</strong> California sick-leave balances as of Mon Oct 12',
  'Future shifts: the week of Oct 12, already published in Deputy, carried over · <strong>0</strong> notices sent on import',
  '<strong>43,918</strong> timesheets since Mar 2023 · labeled “From Deputy”',
  '<strong>3</strong> Square locations reconnected · sales back to Mar 2023 for the forecast',
]

const review = `<div class="card import-card"><h3>Import review · from Deputy</h3><p class="import-who">Ana reviewed Sat Oct 10, 4:20 pm</p><ul class="import-rows">${rows.map(row => `<li>${icons.checkCircle}<span>${row}</span></li>`).join('')}<li class="is-skipped">${icons.minusCircle}<span>Listed, not imported: Deputy newsfeed posts</span></li></ul><p class="cutover">Cutover · Mon Oct 12 · 5:00 am · first punch on the North Park kiosk ${check()}</p></div>`

const totals = `<div class="card side-card"><h3>Totals check</h3><p>Checked Mon Oct 12, 4:45 am</p><p>Last Deputy week · Mon Oct 5 – Sun Oct 11</p><p class="side-big">Deputy 2,201.5 hrs = Lanyard 2,201.5 hrs ${check('equal')}</p></div>`
const gusto = `<div class="card side-card"><h3>Gusto match</h3><p>Gusto keeps hires and pay rates</p><p><strong>63</strong> of <strong>63</strong> matched by payroll ID ${check()}</p><p>Dev Shah · hired in Gusto Mon Oct 12, 9:15 am → Kim set Ocean Beach · barista · invited by text 9:40 am ${check()}</p><p class="side-count"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h16m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>64</p></div>`

// The one start line every Run Edit Run page shows, and the alternative for people who already have Node; each word stays whole.
const words = (line: string) => line.split(' ').map(word => `<span>${word}</span>`).join(' ')
const terminal = '<div class="terminal" role="group" aria-label="Start Lanyard on your computer">'
  + `<p class="terminal-line"><code>${words('curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-lanyard')}</code></p>`
  + `<p class="terminal-comment"><code># ${words('installs rer, then gets and starts Lanyard on your computer')}</code></p>`
  + `<p class="terminal-comment"><code># ${words('Already have Node 22 or later? npx -y @runeditrun/rer dev just-every/run-lanyard')}</code></p></div>`

export const movein = () => section('movein', 'tint', `<div class="site-width movein-layout"><div class="movein-copy">${intro('movein', 'Move-in · Sat Oct 10 – Mon Oct 12', 'Moved off Deputy in a weekend.', 'People, cafes, availability, sick-leave balances, future shifts and three and a half years of timesheets, previewed and checked before anything changed.')}</div>${review}<div class="movein-side">${totals}${gusto}</div>${terminal}</div>`)
