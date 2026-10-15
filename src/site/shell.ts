import { identity } from '../identity'
import run from './run.json'

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

export function siteHeader(): string {
  return `<header class="site-header site-width"><a class="site-brand" href="/"><img src="/brand/mark.svg" alt="" width="28" height="32"><span>Lanyard</span></a><nav aria-label="Main navigation"><a href="/docs">Docs</a><a href="${escapeHtml(run.repository)}">Source</a></nav></header>`
}

export function siteFooter(): string {
  return `<footer class="site-footer site-width"><a class="site-brand" href="/"><img src="/brand/mark.svg" alt="" width="28" height="32"><span>Lanyard</span></a><nav aria-label="Footer navigation"><a href="/docs">Docs</a><a href="${escapeHtml(run.repository)}">Source</a><a href="${escapeHtml(run.repository)}/blob/main/LICENSE">MIT licence</a></nav></footer>`
}

interface SiteDocument { title: string; description?: string; body: string; styles?: string[]; bodyClass?: string }

export function siteDocument({ title, description = identity.tagline, body, styles = [], bodyClass = '' }: SiteDocument): string {
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="icon" href="/brand/mark.svg"><link rel="stylesheet" href="/rer-theme.css"><link rel="stylesheet" href="/site.css">${styles.map(style => `<link rel="stylesheet" href="${escapeHtml(style)}">`).join('')}</head><body class="${escapeHtml(bodyClass)}"><a class="skip-link" href="#main">Skip to content</a>${siteHeader()}${body}${siteFooter()}</body></html>`
}
