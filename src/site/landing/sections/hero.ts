import { actions, check, icons, picture } from '../parts'

// 01 · The Ocean Beach patio at the Saturday rush (approved hero), its copy and
// five record cards set as HTML over the clean plate.
const cards = [
  { icon: icons.bars, body: 'Square forecast · Sat Oct 24 · $8,900 · +22% on recent Saturdays' },
  { icon: icons.people, body: '+1 barista 9:00–1:00 · 4 hrs × $19.00 = $76.00 · no overtime' },
  { icon: icons.checkCircle, body: 'Open shift picked up · Tomas Silva · Thu Oct 22, 8:14 pm' },
  { icon: icons.warning, body: `<span class="pill pill-warning">Overtime risk</span><span class="hero-card-small">12:40 pm · Grace Lee to 3:30 = 8.5 hrs worked → Tomas stays instead · no daily overtime ${check('no daily overtime')}</span>`, warning: true },
  { icon: icons.pie, body: 'Sat actual $9,140 · labor 23.1% · budget 25%' },
]

export function hero(): string {
  return `<section class="hero" id="top" aria-labelledby="hero-heading">`
    + picture('hero', [768, 1152, 1536], [1536, 552], '100vw', 'Ink-and-watercolor sketch from above of a seaside cafe patio at the Saturday rush: sea-glass and claret umbrellas, servers with trays, a line along the sidewalk, a surfboard rack and the pier over the Pacific.', 'hero-art', 'eager', { name: 'hero-phone', widths: [780, 976], size: [976, 552] })
    + `<div class="hero-copy site-width"><h1 id="hero-heading">A full crew, paid right.</h1><p class="hero-sub">Lanyard builds and fills the schedule, covers call-outs and swaps, clocks time and breaks, watches labor cost and sends approved hours to payroll.</p><p class="hero-alt">100% free, open source alternative to <strong>Deputy</strong>, <strong>When I Work</strong> and <strong>Homebase</strong></p>${actions()}</div>`
    + `<ul class="hero-cards site-width" aria-label="Saturday at Ocean Beach, in Lanyard">${cards.map(card => `<li class="hero-card${card.warning ? ' hero-card-warning' : ''}">${card.icon}<p>${card.body}</p></li>`).join('')}</ul></section>`
}
