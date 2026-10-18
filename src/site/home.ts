import { tidy } from './landing/parts'
import { build } from './landing/sections/build'
import { callout } from './landing/sections/callout'
import { clock } from './landing/sections/clock'
import { closing } from './landing/sections/closing'
import { hero } from './landing/sections/hero'
import { interlude } from './landing/sections/interlude'
import { movein } from './landing/sections/movein'
import { payroll } from './landing/sections/payroll'
import { publish } from './landing/sections/publish'
import { saturday } from './landing/sections/saturday'
import { swaps } from './landing/sections/swaps'
import { tips } from './landing/sections/tips'
import { week } from './landing/sections/week'
import { siteDocument } from './shell'

// The approved homepage (design desk page-s1, 18 Oct 2026): one week at Tres Hornos
// Bakery, in Ana Reyes's own stages, from the hero to payday.
const sections = [hero, week, build, publish, clock, swaps, interlude, callout, saturday, tips, payroll, movein, closing]

export function homePageHtml(): string {
  return siteDocument({
    title: 'Lanyard — A full crew, paid right',
    description: 'Lanyard builds and fills the schedule, covers call-outs and swaps, clocks time and breaks, watches labor cost and sends approved hours to payroll. 100% free, open source alternative to Deputy, When I Work and Homebase.',
    bodyClass: 'landing-page',
    styles: ['/landing/base.css', '/landing/plan.css', '/landing/floor.css', '/landing/money.css'],
    preload: '<link rel="preload" as="image" type="image/avif" imagesrcset="/site/hero-768.avif 768w, /site/hero-1152.avif 1152w, /site/hero-1536.avif 1536w" imagesizes="100vw" media="(min-width: 761px)">',
    body: `<main id="main" class="landing">${tidy(sections.map(render => render()).join(''))}</main>`,
  })
}
