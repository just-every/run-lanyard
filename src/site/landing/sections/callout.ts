import { check, icons, intro, section } from '../parts'

// 08 · The page's one failure and recovery, on the dark band: Jess's 6:12 call-out
// to Luis's 6:56 clock-in along a time spine, with the cross-town route inset.
type Side = 'left' | 'right'
const events: { time: string; side: Side; row: number; className?: string; body: string }[] = [
  { time: '6:12', side: 'left', row: 1, className: 'spine-alert', body: '<p class="spine-quote"><strong>Jess Morales:</strong> “I can’t come in this morning.”</p><p>Sat 7:00 am – 3:00 pm · Barista · Ocean Beach · Uncovered · opens in 48 min · reason private to managers</p>' },
  { time: '6:13', side: 'right', row: 1, body: `<p class="spine-head">${icons.sparkle}<span><strong>Coverage agent</strong> · 3 qualified · no overtime</span></p><ul class="shortlist"><li><strong>Luis Ortega</strong> · North Park · 30.0 → 37.5 hrs</li><li><strong>Marisol Peña</strong> · Barrio Logan · 29.0 → 36.5 hrs</li><li><strong>Dev Shah</strong> · Ocean Beach · 24.0 → 31.5 hrs</li></ul><p class="spine-muted">Left out: Andrea Cruz · would reach 43.5 hrs · overtime · Tomas Silva · already on 9:00 – 1:00</p>` },
  { time: '6:14', side: 'right', row: 2, body: '<p><strong>Offers sent by app push</strong> · Luis and Dev in English · Marisol in Spanish: <span lang="es">“Turno abierto · Ocean Beach · hoy 7:00 am – 3:00 pm · Barista”</span></p>' },
  { time: '6:17', side: 'left', row: 2, body: '<p class="spine-quote"><strong>Marisol Peña:</strong> <span lang="es">“No puedo hoy, lo siento.”</span></p><p class="spine-muted">declined</p>' },
  { time: '6:21', side: 'left', row: 3, body: '<p class="spine-quote"><strong>Luis Ortega:</strong> “I can be there by 7.”</p><p class="spine-yes">accepted</p>' },
  { time: '6:23', side: 'right', row: 3, body: `<p>Ana approved from her phone · Dev’s offer closed · Luis, Kim Tran and Jess notified ${check()}</p>` },
  { time: '6:24', side: 'right', row: 4, body: '<p><strong>Payroll draft</strong> · Luis Ortega · 7.5 hrs costed to Ocean Beach · Jess · 7.5 hrs California paid sick leave · balance 24.0 → 16.5 hrs</p>' },
  { time: '6:56', side: 'left', row: 4, body: `<p><strong>Ocean Beach kiosk</strong> · Luis Ortega in 6:56 am · photo ${check()}</p>` },
]

// San Diego, drawn from real positions (x = longitude, y = latitude, same scale):
// Ocean Beach on the coast due west of North Park; Barrio Logan south of North Park
// on the bay's east shore below downtown.
const map = `<figure class="route-map"><svg viewBox="0 0 230 150" role="img" aria-label="Map: Luis's route from North Park west to Ocean Beach; Barrio Logan lies south, on the bay">
<rect width="230" height="150" class="map-water"/>
<path class="map-land" d="M22 0L19 21C30 17 46 16 56 22C47 30 30 30 19 27L18 34L20 50L22 80L26 110L32 136L37 132L39 110L43 90L47 82L62 76L88 62L112 70L120 80L134 98L146 114L162 136L172 150H230V0Z"/>
<path class="map-land" d="M92 150L96 128L100 113L112 104L124 108L128 116L116 122L106 132L101 150Z"/>
<path class="map-route" d="M154 35C120 28 62 28 21 34"/>
<g class="map-pin"><circle cx="154" cy="35" r="5"/><circle cx="21" cy="34" r="5"/><circle cx="137" cy="101" r="5"/></g>
<text x="161" y="39">North Park</text><text x="27" y="52">Ocean Beach</text><text x="144" y="105">Barrio Logan</text><text x="3" y="145" class="map-sea">Pacific</text></svg></figure>`

const spine = events.map(event => `<li class="spine-item spine-${event.side}${event.className ? ` ${event.className}` : ''}" style="--row:${event.row}"><time>${event.time}</time><div class="spine-card">${event.body}</div></li>`).join('')

export const callout = () => section('callout', 'night', `<div class="site-width"><div class="callout-head">${intro('callout', 'Call-out · Sat Oct 24 · Ocean Beach opens 7:00 am', '6:12 call-out. 6:56 clocked in.', 'Jess can’t open. The coverage agent finds three qualified people with no overtime, asks each in their own language and closes the gap only at a clock-in.')}${map}</div><ol class="spine">${spine}</ol><p class="covered">Covered by clock-in ${check('covered')} · 6:56 am · opened on time at 7:00</p></div>`)
