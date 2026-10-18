import { check, intro, section } from '../parts'

// 09 · Labor cost against real sales: Ocean Beach's Square sales by hour, the
// 12:40 overtime-risk card pinned to the 12 pm bar, and the three cafes' close.
const hours = [['7 am', 520], ['8 am', 780], ['9 am', 1060], ['10 am', 1340], ['11 am', 1420], ['12 pm', 1380], ['1 pm', 1180], ['2 pm', 860], ['3 pm', 600]] as const
const money = (value: number) => `$${value.toLocaleString('en-US')}`
const cafes = [
  ['Ocean Beach', '$9,140', '$2,109.50', '23.1%', '25%'], ['North Park', '$7,880', '$1,985.00', '25.2%', '26%'],
  ['Barrio Logan', '$6,420', '$1,592.00', '24.8%', '26%'],
] as const

const bars = hours.map(([label, value], index) => `<li class="bar${index === 5 ? ' bar-peak' : ''}" style="--v:${value / 1500}">${index === 5 ? '<span class="bar-note">10 on the clock · <br>$138 per labor hour</span><span class="bar-pin" aria-hidden="true"></span>' : ''}<span class="bar-value">${money(value)}</span><span class="bar-fill" aria-hidden="true"></span><span class="bar-label">${label}</span></li>`).join('')

const risk = `<div class="risk-card"><p class="pill pill-warning">Overtime risk</p><p><strong>12:40 pm</strong> · line past 20 · keep one more barista to 3:30</p><p><strong>Grace Lee</strong> to 3:30 = 8.5 hrs worked → 0.5 hr daily overtime</p><p>Tomas stays instead · 1:00 → 3:30 · meal 1:00 – 1:30 · 6.0 hrs worked · week 34.0 · no daily overtime ${check()}</p><p>Kim Tran approved 12:41 pm · +$38.00</p></div>`

const table = `<div class="card cafe-table"><table><caption class="sr-only">Saturday Oct 24 close by cafe</caption><thead><tr><th scope="col">Sat Oct 24</th><th scope="col">Square sales</th><th scope="col">Labor</th><th scope="col">Labor %</th><th scope="col">Budget</th></tr></thead><tbody>${cafes.map(([name, sales, labor, pct, budget], index) => `<tr${index === 0 ? ' class="is-here"' : ''}><th scope="row">${name}</th><td>${sales}</td><td>${labor}</td><td>${check('under budget')}${pct}</td><td>${budget}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">All three</th><td>$23,440</td><td>$5,686.50</td><td>${check('under budget')}24.3%</td><td></td></tr></tfoot></table></div>`

export const saturday = () => section('saturday', 'white', `<div class="site-width">${intro('saturday', 'Labor cost · Sat Oct 24 · Ocean Beach', 'The rush, staffed to the forecast.', 'When the line runs long, Lanyard finds the extra hours that cost no overtime. Saturday closes under budget at all three cafes.', 'intro-split')}<div class="card sales-card"><p class="sales-head"><span><strong>Ocean Beach</strong> · Square sales by hour · open 7:00 am – 4:00 pm</span><strong class="sales-total">$9,140</strong></p><div class="sales-plot">${risk}<ol class="bars" aria-label="Square sales by hour">${bars}</ol></div></div>${table}</div>`)
