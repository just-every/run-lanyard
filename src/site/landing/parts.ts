// Small pieces every homepage section draws with: icons, checks, avatars,
// pills, section headings and the responsive pictures of the painted plates.
const svg = (body: string, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"${extra}>${body}</svg>`

export const icons = {
  bars: svg('<rect x="3" y="13" width="4.5" height="8" rx="1"/><rect x="9.75" y="8" width="4.5" height="13" rx="1"/><rect x="16.5" y="3" width="4.5" height="18" rx="1"/>', ' class="icon icon-fill"'),
  people: svg('<circle cx="8.5" cy="7.5" r="3.6"/><circle cx="16.5" cy="8.5" r="3.1"/><path d="M1.5 20.5c0-4.2 3.1-7 7-7s7 2.8 7 7v.5h-14Z"/><path d="M16.8 13.6c3.3.1 5.7 2.6 5.7 6.4v1h-5.2v-1c0-2.4-.6-4.6-2.1-6.1.5-.2 1-.3 1.6-.3Z"/>', ' class="icon icon-fill"'),
  checkCircle: svg('<circle cx="12" cy="12" r="11"/><path d="m6.8 12.3 3.5 3.5 6.9-7.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', ' class="icon icon-fill icon-check-circle"'),
  warning: svg('<path d="M10.3 2.9a2 2 0 0 1 3.4 0l9.2 16.1a2 2 0 0 1-1.7 3H2.8a2 2 0 0 1-1.7-3Z"/><path d="M12 8.5v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18" r="1.4" fill="#fff"/>', ' class="icon icon-fill icon-warning"'),
  pie: svg('<path d="M11 2.05V13h10.95A11 11 0 1 1 11 2.05Z"/><path d="M13 1.05A10.5 10.5 0 0 1 22.95 11H13Z"/>', ' class="icon icon-fill"'),
  pin: svg('<path d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 13.5 7.5 13.5S19.5 14.4 19.5 9A7.5 7.5 0 0 0 12 1.5Zm0 10.2A2.7 2.7 0 1 1 12 6.3a2.7 2.7 0 0 1 0 5.4Z"/>', ' class="icon icon-fill icon-pin"'),
  sparkle: svg('<path d="M9 2c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/><path d="M18 13c.35 2.3 1.4 3.35 3.7 3.7-2.3.35-3.35 1.4-3.7 3.7-.35-2.3-1.4-3.35-3.7-3.7 2.3-.35 3.35-1.4 3.7-3.7Z"/>', ' class="icon icon-fill icon-sparkle"'),
  chevron: svg('<path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', ' class="icon icon-chevron"'),
  person: svg('<circle cx="12" cy="8" r="4.6"/><path d="M3 22c0-5 4-8.6 9-8.6s9 3.6 9 8.6Z"/>', ' class="icon icon-fill"'),
  minusCircle: svg('<circle cx="12" cy="12" r="11"/><path d="M7 12h10" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>', ' class="icon icon-fill icon-minus-circle"'),
}

/** The trailing sea-glass check of a done row. */
export const check = (label = 'done') => `<svg class="tick" viewBox="0 0 20 20" role="img" aria-label="${label}"><path d="m3.5 10.5 4.2 4.2L16.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

export const arrow = '<span class="arrow" aria-hidden="true">→</span>'

export const avatar = (initials: string, tone: 'sea' | 'pink' = 'sea') => `<span class="avatar avatar-${tone}" aria-hidden="true">${initials}</span>`

export const eyebrow = (text: string) => `<p class="eyebrow">${text}</p>`

export const heading = (id: string, text: string) => `<h2 id="${id}-heading">${text}</h2>`

/** One stage of the week: eyebrow, H2 and the body line, as every section opens. */
export const intro = (id: string, stage: string, title: string, body: string, className = '') => `<div class="section-intro ${className}">${eyebrow(stage)}${heading(id, title)}<p class="lede">${body}</p></div>`

export const section = (id: string, tone: 'white' | 'tint' | 'night' | 'art', content: string, className = '') => `<section class="band band-${tone} ${className}" id="${id}" aria-labelledby="${id}-heading">${content}</section>`

/** A painted plate as AVIF and WebP at the widths that exist in public/site. */
export function picture(name: string, widths: number[], size: [number, number], sizes: string, alt: string, className = '', loading: 'lazy' | 'eager' = 'lazy', phone?: { name: string; widths: number[]; size: [number, number] }) {
  const set = (base: string, list: number[], type: string) => list.map(width => `/site/${base}-${width}.${type} ${width}w`).join(', ')
  const phoneSources = phone ? `<source media="(max-width: 760px)" type="image/avif" srcset="${set(phone.name, phone.widths, 'avif')}" sizes="100vw" width="${phone.size[0]}" height="${phone.size[1]}"><source media="(max-width: 760px)" type="image/webp" srcset="${set(phone.name, phone.widths, 'webp')}" sizes="100vw" width="${phone.size[0]}" height="${phone.size[1]}">` : ''
  return `<picture class="${className}">${phoneSources}<source type="image/avif" srcset="${set(name, widths, 'avif')}" sizes="${sizes}"><img src="/site/${name}-${widths.at(-1)}.webp" srcset="${set(name, widths, 'webp')}" sizes="${sizes}" width="${size[0]}" height="${size[1]}" alt="${alt}" loading="${loading}" decoding="async"${loading === 'eager' ? ' fetchpriority="high"' : ''}></picture>`
}

export const actions = (demo = true) => `<div class="site-actions"><a class="run-button" href="/run">Run Lanyard ${arrow}</a><div class="site-links">${demo ? '<a href="https://demo.run-lanyard.com/">Try the demo</a>' : ''}<a href="/docs">Read the docs</a></div></div>`

/** Line breaks never start a line with a separator, arrow or operator, and never split a time range. */
export const tidy = (html: string) => html.replace(/>([^<]+)</g, (_, text: string) => `>${text
  .replace(/ (·|→|⇄|=|×|\+|–)(?= |$)/g, '&nbsp;$1')
  .replace(/(\d)–(\d)/g, '$1&#8288;–&#8288;$2')
  .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Oct|Nov|Mar) (?=\d)/g, '$1&nbsp;')
  .replace(/(\d) (am|pm|hrs|h|min)\b/g, '$1&nbsp;$2')}<`)
  // A trailing check stays on the line with the word before it.
  .replace(/([^\s<>;]+) (<svg class="tick"[^]*?<\/svg>)/g, '<span class="nowrap">$1&nbsp;$2</span>')
