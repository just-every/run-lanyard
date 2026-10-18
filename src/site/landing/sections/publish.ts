import { check, icons, intro, section } from '../parts'

// 04 · The published week reaching each person in their own language: Jess in
// English in the app, Rosa in Spanish by text, and the confirmations coming in.
const status = '<span class="phone-status" aria-hidden="true"><span>9:41</span><span class="phone-signal"></span></span>'
const phone = (label: string, content: string, className = '') => `<figure class="phone ${className}"><figcaption>${label}</figcaption><div class="phone-frame"><div class="phone-screen">${status}${content}</div></div></figure>`

const jess = ['Tue Oct 20', 'Thu Oct 22', 'Fri Oct 23', 'Sat Oct 24']
const rosa = [['mar 20', '5:00 am – 1:30 pm', 'Panadera'], ['mié 21', '5:00 am – 1:30 pm'], ['jue 22', '5:00 am – 1:30 pm'], ['vie 23', '5:00 am – 1:30 pm'], ['sáb 24', '5:00 am – 11:30 am']]

const english = phone('Jess Morales · English · app',
  `<p class="app-lockup"><img src="/brand/mark.svg" alt="" width="40" height="31"><span>Lanyard</span></p><div class="week-sheet"><p class="sheet-title">Your week of Oct 19</p><p class="sheet-sub">Ocean Beach · 4 shifts · 30.0 hrs</p><ul class="shift-list">${jess.map(day => `<li><span><strong>${day}</strong><br>7:00 am – 3:00 pm</span><span class="shift-role">Barista ${icons.chevron}</span></li>`).join('')}</ul></div><p class="phone-button"><span>Confirmed 4:41 pm ${check('confirmed')}</span></p>`)

const spanish = phone('Rosa Jimenez · Español · text',
  `<div class="sms" lang="es"><p>Tres Hornos: Tu semana del 19 de octubre · North Park · 5 turnos · 38.0 h</p><p class="sms-link">Ver y confirmar →</p></div><div class="week-sheet" lang="es"><p class="sheet-title">Tu semana <span>· 5 turnos · 38.0 h</span></p><ul class="shift-list shift-list-es">${rosa.map(([day, time, role]) => `<li><strong>${day}</strong><span>${time}</span><span class="shift-role">${role ?? ''}${icons.chevron}</span></li>`).join('')}</ul></div><p class="phone-button" lang="es"><span>Confirmado 5:02 pm ${check('confirmado')}</span></p>`, 'phone-es')

const ring = '<div class="confirm-ring" role="img" aria-label="64 of 64 confirmed"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/></svg><p><strong>64 <small>of</small> 64</strong><span>confirmed</span></p></div>'

const stats = [
  '<strong>37</strong> English · <strong>27</strong> Spanish',
  '<strong>41</strong> by app · <strong>23</strong> by text, phone number only',
  '<strong>62</strong> of <strong>64</strong> by Thu Oct 15, 9:00 am',
  `<strong>2</strong> reminders 9:00 am → <strong>64</strong> of <strong>64</strong> at 11:20 am ${check()}`,
]

export const publish = () => section('publish', 'tint', `<div class="site-width">${intro('publish', 'Publish · Wed Oct 14, 4:30 pm', 'Out in English and Spanish.', 'Each person gets the week on their phone, in their own language, by app or by text, and confirms their shifts.', 'intro-center')}<div class="publish-stage">${english}${ring}${spanish}</div><ul class="stat-cards">${stats.map(stat => `<li class="card"><p>${stat}</p></li>`).join('')}</ul></div>`)
