import { drawings, heroDrawing } from './drawings'
import { includedFeatures } from './included'
import { siteDocument } from './shell'

const actions = () => '<div class="site-actions"><a class="site-button" href="/run">Run Lanyard <span aria-hidden="true">→</span></a><a class="site-button" href="https://demo.run-lanyard.com/">Try the demo</a><a class="site-text-link" href="/docs">Read the docs</a></div>'

const sections: { id: string; eyebrow: string; title: string; body: string; drawing: () => string }[] = [
  { id: 'free', eyebrow: 'Free', title: '100% free, for the whole team.', body: 'Free as in cost and free as in code. MIT licensed, for every person on your roster.', drawing: drawings.free },
  { id: 'payroll', eyebrow: 'Payroll', title: 'Hours your payroll can trust.', body: 'Review the exact CSV, export it once and import it into payroll. A later correction sends only the difference.', drawing: drawings.payroll },
  { id: 'clock', eyebrow: 'Clock', title: 'Clock on from any phone.', body: 'Staff clock in and out with their break. If the signal drops, the time is kept and sent once.', drawing: drawings.clock },
  { id: 'roster', eyebrow: 'Roster', title: 'The roster your staff confirm.', body: 'Build the week from availability and approved leave. Staff see their own shifts and confirm them.', drawing: drawings.roster },
  { id: 'approvals', eyebrow: 'Approvals', title: 'Approve the hours. Keep the history.', body: 'Approve each timesheet revision. A correction keeps the earlier record and is approved on its own.', drawing: drawings.approvals },
  { id: 'agents', eyebrow: 'Agents', title: 'Agents prepare. You publish.', body: 'Give an assistant a 30-day key to draft rosters and timesheets. People publish, approve and export.', drawing: drawings.agents },
  { id: 'move-in', eyebrow: 'Move in', title: 'Bring your team with you.', body: 'Paste a staff CSV, preview it, then apply. New people start inactive until you invite them.', drawing: drawings.move },
]

export function homePageHtml(): string {
  return siteDocument({ title: 'Lanyard — Rosters and hours, sorted', bodyClass: 'landing-page', body: `<main id="main"><section class="site-hero" id="top" aria-labelledby="hero-heading"><div class="hero-copy site-width"><h1 id="hero-heading">Rosters and hours, sorted.</h1><p class="hero-subhead">Publish the roster, let staff clock on by phone, and export approved hours to payroll.</p><p class="hero-alternative">100% free, open source alternative to <strong>Deputy</strong>, <strong>When I Work</strong> and <strong>Homebase</strong></p>${actions()}<p class="hero-small">Free and open source, MIT licensed.</p></div>${heroDrawing()}</section><div class="feature-sections site-width">${sections.map((section, index) => `<section class="feature-section${index % 2 ? ' feature-reverse' : ''}" id="${section.id}" aria-labelledby="${section.id}-heading"><div class="feature-copy"><p class="site-eyebrow">${section.eyebrow}</p><h2 id="${section.id}-heading">${section.title}</h2><p>${section.body}</p></div>${section.drawing()}</section>`).join('')}</div>${includedFeatures()}<section class="site-closing" aria-labelledby="closing-heading"><div class="closing-art" aria-hidden="true"><picture><source media="(max-width: 760px)" srcset="/brand/band.svg#mobile"><img src="/brand/band.svg#closing" alt=""></picture></div><div class="site-width"><h2 id="closing-heading">Rosters and hours, sorted.</h2>${actions()}</div></section></main>` })
}
