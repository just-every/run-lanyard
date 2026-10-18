import { check, icons, intro, picture, section } from '../parts'

// 05 · The North Park back door in ink and wash, the kiosk's screen set as HTML,
// the punch strip with Ben's late meal turned into a premium, and Dev's phone punch.
const kiosk = `<div class="kiosk-screen" lang="es"><span class="kiosk-lang">Español</span><span class="kiosk-photo">${icons.person}</span><p class="kiosk-hello">Hola, Rosa</p><p>Entrada 5:01 am</p><p class="kiosk-foto">Foto ${icons.checkCircle}</p><p class="kiosk-pin" aria-label="PIN entered"><span></span><span></span><span></span><span></span></p></div>`

const strip = `<div class="punch-card"><div class="punch-strip"><section aria-label="Rosa Jimenez, Tuesday"><h3>Tue Oct 20 · Rosa Jimenez · baker</h3><ul>
<li>In 5:01 am · photo ${check()}</li><li>Meal 9:45 – 10:15 am · 30 min · on time ${check()}</li><li>Out 1:31 pm · 8.0 hrs</li></ul></section>
<section aria-label="Ben Carter, Wednesday"><h3>Wed Oct 21 · Ben Carter · barista</h3><ul>
<li>In 6:30 am · photo ${check()}</li><li class="punch-late">${icons.warning}Meal 12:10 – 12:40 pm · started at 5 hrs 40 min</li>
<li class="punch-fixed">${icons.checkCircle}<span>California meal premium · 1 hr × $19.00 = $19.00 added · Ben confirmed at clock-out 3:00 pm ${check()}</span></li><li>Out 3:00 pm · 8.0 hrs</li></ul></section></div></div>`

const dev = `<div class="mini-phone"><span class="mini-notch" aria-hidden="true"></span><span class="mini-pin">${icons.pin}</span><p><strong>Dev Shah · Ocean Beach</strong></p><p class="mini-line">In 2:58 pm · inside the geofence ${check()}</p><p class="mini-note">Location at punch only</p></div>`

export const clock = () => section('clock', 'white', `<div class="site-width clock-layout"><figure class="clock-art"><div class="clock-plate">${picture('clock', [644], [644, 710], '(max-width: 760px) 190vw, 600px', 'Ink-and-wash sketch of a bakery back door: green, claret and pink aprons on hooks beside the door and a time-clock kiosk on the wall.')}${kiosk}</div></figure><div class="clock-copy">${intro('clock', 'Clock · Tue Oct 20 – Wed Oct 21', 'Clocked in at the back door.', 'A PIN and a photo at the kiosk, meals timed against California’s rules, and a premium added the day a meal comes late.')}<div class="clock-records">${strip}${dev}</div></div></div>`)
