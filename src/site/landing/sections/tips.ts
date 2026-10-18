import { check, intro, section } from '../parts'

// 10 · Saturday's Ocean Beach tip pool as a document, Kim's approval, and Luis's
// own earnings for the week on his phone.
const shares = [['Grace Lee', '6.0 hrs', '$52.80'], ['Luis Ortega (from North Park)', '7.5 hrs', '$66.00'], ['Tomas Silva', '6.0 hrs', '$52.80'], ['10 more baristas and counter staff', '73.0 hrs', '$642.40']]
// Luis's week: four North Park shifts (30.0 hrs) and Saturday's cover at Ocean Beach; tips sum to $318.40.
const days = [['Mon', 'North Park', '$58.20'], ['Tue', 'North Park', '$61.10'], ['Thu', 'North Park', '$64.40'], ['Fri', 'North Park', '$68.70'], ['Sat', 'Ocean Beach', '$66.00']]

const ledger = `<article class="ledger" aria-labelledby="ledger-title"><h3 id="ledger-title">Tip pool · Sat Oct 24 · Ocean Beach</h3><p class="ledger-sum">Card tips from Square · $814.00 · 13 people · 92.5 hrs · $8.80 per hour</p>
<table><thead><tr><th scope="col">Person</th><th scope="col">Hours</th><th scope="col">Share</th></tr></thead><tbody>${shares.map(([name, hours, share]) => `<tr><th scope="row">${name}</th><td>${hours}</td><td>${share}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th><td>92.5 hrs</td><td>$814.00 ${check('totals match')}</td></tr></tfoot></table>
<p class="ledger-note">Not in the pool: Kim Tran, site manager · bakers</p><p class="ledger-approved"><span>Approved by Kim Tran · Sun Oct 25, 9:10 am</span><span class="stamp" aria-hidden="true">Approved</span></p></article>`

const earnings = `<div class="earn-phone"><div class="earn-screen"><p class="earn-title">Luis Ortega · Earnings</p><p class="earn-sub">Week of Oct 19 · 37.5 hrs</p><p class="earn-total"><strong>$712.50 + tips $318.40 = $1,030.90</strong><span>Estimate before taxes · pay date Fri Oct 30</span></p><ul>${days.map(([day, cafe, tips]) => `<li${day === 'Sat' ? ' class="is-cover"' : ''}><span>${day} · ${cafe}</span><span>7.5 hrs · tips ${tips}</span></li>`).join('')}</ul></div></div>`

export const tips = () => section('tips', 'tint', `<div class="site-width tips-layout"><div class="tips-copy">${intro('tips', 'Tip pool · Sat Oct 24 · Ocean Beach', '$814 in tips, split by the hour.', 'Square’s card tips, divided over the hours each barista and counter worker actually clocked. Everyone sees their own share.')}</div>${ledger}${earnings}</div>`)
