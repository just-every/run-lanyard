import { avatar, check, icons, intro, section } from '../parts'

// 06 · Staff self-service with the rules checked first: Saturday's forecast
// change becomes an open shift Tomas picks up, and Nia and Sam swap Sunday.
const pickup = `<div class="pickup-phone"><p class="pp-title">Open shift</p><p>Ocean Beach<br>Sat Oct 24<br>9:00 am – 1:00 pm<br>Barista<br>$19.00/hr</p><p class="pp-done">Picked up · Thu Oct 22, 8:14 pm ${check()}</p><p class="pp-week">Your week: 32.0 hrs</p></div>`

const open = `<ol class="open-chain">
<li class="card chain-card">${icons.bars}<div><p class="chain-meta">Thu Oct 22 · 5:45 pm · Square forecast · Sat Oct 24</p><p class="chain-big">$8,000 → $8,900</p><p>+22% on recent Saturdays</p></div></li>
<li class="card chain-card">${icons.people}<div><p class="chain-strong">+1 barista 9:00 – 1:00 · 4 hrs × $19.00 = $76.00 · no overtime</p><p class="chain-muted">Posted by Kim Tran 6:02 pm · offered first to part-timers who want more hours</p></div></li>
<li class="card chain-card chain-pickup">${pickup}<div class="pickup-who">${avatar('TS')}<div><p class="chain-name">Tomas Silva</p><p class="chain-muted">Ocean Beach · barista · part-time</p><p>Week 28.0 → 32.0 hrs · no overtime ${check()}</p></div></div></li></ol>
<p class="chain-foot">Ocean Beach Saturday now $2,071.50 of $8,900 · 23.3% · budget 25%</p>`

const person = (who: string, tone: 'sea' | 'pink', name: string, time: string) => `<div class="card swap-card"><p class="swap-who">${avatar(who, tone)}<span><strong>${name}</strong><br>Barrio Logan · Sun Oct 25</span></p><p class="swap-time">${time}</p></div>`
const checks = ['Both barista-trained', 'Nia 32.0 hrs, Sam 30.0 hrs, unchanged', 'No overtime', 'Rest between shifts']

const swap = `<div class="swap"><svg class="swap-arc" viewBox="0 0 200 60" aria-hidden="true"><path d="M16 52 C 60 6, 140 6, 184 52"/><path d="M4 40 L16 54 L30 46"/><path d="M196 40 L184 54 L170 46"/></svg>
<div class="swap-pair">${person('NB', 'sea', 'Nia Brooks', '10:00 am – 6:00 pm')}${person('SP', 'pink', 'Sam Patel', '6:30 am – 2:30 pm')}</div>
<p class="swap-asked">Asked Tue Oct 20, 7:12 pm · Sam accepted 7:40 pm</p>
<ul class="swap-checks">${checks.map(text => `<li class="card">${icons.checkCircle}<span>${text}</span></li>`).join('')}</ul>
<p class="card swap-approved">${avatar('HV')}<span><strong>Hector Vega</strong> approved Wed Oct 21, 8:40 am · both phones updated ${check()}</span></p></div>`

export const swaps = () => section('swaps', 'tint', `<div class="site-width">${intro('swaps', 'Swaps and open shifts · Tue Oct 20 – Thu Oct 22', 'Swapped and picked up from their phones.', 'Staff trade shifts and take open ones from their phones. Lanyard checks skills, hours and overtime first.', 'intro-wide')}<div class="swaps-layout"><div class="swaps-open">${open}</div><div class="swaps-swap">${swap}</div></div></div>`)
