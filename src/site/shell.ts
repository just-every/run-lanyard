import { identity } from '../identity'
import { iconHead } from '../base/icon-head'
import run from './run.json'

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))


const lockup = (size: number) => `<a class="site-brand" href="/"><img src="/brand/mark.svg" alt="" width="${size}" height="${Math.round(size * 418 / 544)}"><span>Lanyard</span></a>`

export function siteHeader(): string {
  return `<header class="site-header"><div class="site-width site-header-row">${lockup(52)}<nav aria-label="Main navigation"><a href="/docs">Docs</a><a href="/contract">Contract</a><a href="${escapeHtml(run.repository)}">Source</a></nav></div></header>`
}

export function siteFooter(): string {
  return `<footer class="site-footer"><div class="site-width site-footer-row">${lockup(46)}<p>Free, open source scheduling and time clock</p><nav aria-label="Footer navigation"><a href="/docs">Docs</a><a href="${escapeHtml(run.repository)}">Source</a><a href="${escapeHtml(run.repository)}/blob/main/LICENSE">MIT licensed</a></nav></div></footer>`
}

interface SiteDocument { title: string; description?: string; body: string; styles?: string[]; bodyClass?: string; preload?: string; script?: string }

const SHARE_IMAGE = `${identity.runSite}/site/share.jpg`

export function siteDocument({ title, description = identity.tagline, body, styles = [], bodyClass = '', preload = '', script = '' }: SiteDocument): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">`
    + `<meta name="theme-color" content="#ffffff"><meta property="og:type" content="website"><meta property="og:site_name" content="Lanyard"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${SHARE_IMAGE}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`
    + `${iconHead}<link rel="preload" href="/fonts/inter/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/source-serif-4/source-serif-4-latin-opsz-italic.woff2" as="font" type="font/woff2" crossorigin>${preload}`
    + `<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/site.css">${styles.map(style => `<link rel="stylesheet" href="${escapeHtml(style)}">`).join('')}</head>`
    + `<body class="${escapeHtml(bodyClass)}"><a class="skip-link" href="#main">Skip to content</a>${siteHeader()}${body}${siteFooter()}${script ? `<script>${script}</script>` : ''}</body></html>`
}
