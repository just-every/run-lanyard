/// <reference types="vite/client" />
import { siteDocument } from './shell'

const markdown = import.meta.glob<string>('../../docs/*.md', { query: '?raw', import: 'default', eager: true })
const repository = 'https://github.com/just-every/run-lanyard'
const guides = [
  { slug: '', file: 'README.md', title: 'The Lanyard guide', group: 'Start here' },
  { slug: 'getting-started', file: 'GETTING-STARTED.md', title: 'Getting started', group: 'Start here' },
  { slug: 'move-in', file: 'MOVE-IN.md', title: 'Move in', group: 'Start here' },
  { slug: 'schedule', file: 'SCHEDULE.md', title: 'Schedule, call-outs and time off', group: 'Run the week' },
  { slug: 'time', file: 'TIME.md', title: 'Clock and timesheets', group: 'Run the week' },
  { slug: 'payroll', file: 'PAYROLL.md', title: 'Payroll exports', group: 'Run the week' },
  { slug: 'backup-restore', file: 'BACKUP-RESTORE.md', title: 'Backup and restore', group: 'Look after Lanyard' },
  { slug: 'holidays', file: 'HOLIDAYS.md', title: 'Holiday calendars and pay inputs', group: 'Reference' },
  { slug: 'workforce', file: 'WORKFORCE.md', title: 'Jobs, qualifications and effective rates', group: 'Reference' },
  { slug: 'staff-import', file: 'STAFF-IMPORT.md', title: 'Staff CSV reference', group: 'Reference' },
  { slug: 'agents-api', file: 'AGENTS-API.md', title: 'Agent API', group: 'Reference' },
  { slug: 'sources', file: 'SOURCES.md', title: 'Source and reuse', group: 'Reference' },
] as const
// Code cards get their Copy button only when script runs; without it the command is still there to select.
const COPY = "document.querySelectorAll('.docs-copy').forEach(b=>{b.hidden=false;b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.closest('.docs-code').querySelector('code').textContent);b.textContent='Copied';setTimeout(()=>{b.textContent='Copy'},1600)}catch{}})})"
const pathFor = (slug: string) => `/docs${slug ? `/${slug}` : ''}`
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

function hrefFor(target: string): string | null {
  const [file, fragment] = target.split('#', 2)
  const guide = guides.find(guide => guide.file === file.replace(/^\.\//, ''))
  if (guide) return pathFor(guide.slug) + (fragment ? `#${fragment}` : '')
  if (file === '../README.md') return `${repository}/blob/main/README.md${fragment ? `#${fragment}` : ''}`
  if (target.startsWith('#') || /^\/(?!\/)/.test(target)) return target
  try {
    const url = new URL(target)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

// Repository Markdown is trusted prose, but raw HTML and arbitrary URL schemes
// are deliberately never emitted. This renderer covers the guides' small syntax:
// paragraphs, headings, lists, fenced code, tables and inline code/links/emphasis.
function inline(source: string): string {
  const tokens = /`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let html = '', cursor = 0
  for (const match of source.matchAll(tokens)) {
    html += escape(source.slice(cursor, match.index))
    // Inline commands wrap only between words, never inside a token such as just-every/run-lanyard.
    if (match[1] !== undefined) html += `<code>${match[1].split(' ').map(token => `<span>${escape(token)}</span>`).join(' ')}</code>`
    else if (match[2] !== undefined) {
      const href = hrefFor(match[3])
      html += href ? `<a href="${escape(href)}">${inline(match[2])}</a>` : inline(match[2])
    } else if (match[4] !== undefined) html += `<strong>${inline(match[4])}</strong>`
    else html += `<em>${inline(match[5])}</em>`
    cursor = match.index! + match[0].length
  }
  return html + escape(source.slice(cursor))
}

const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
const tableRule = (line: string) => /^\s*\|?[\s:|-]+\|\s*$/.test(line) && tableCells(line).every(cell => /^:?-{3,}:?$/.test(cell))
const listItem = (line: string) => /^(?:[-*] |\d+\. )/.test(line)

function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n'), blocks: string[] = []
  const headingIds = new Map<string, number>()
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index++; continue }
    const fence = /^```([a-zA-Z0-9_-]*)\s*$/.exec(line)
    if (fence) {
      const code: string[] = []
      index++
      while (index < lines.length && !/^```\s*$/.test(lines[index])) code.push(lines[index++])
      if (index < lines.length) index++
      blocks.push(`<div class="docs-code"><pre><code${fence[1] ? ` class="language-${escape(fence[1])}"` : ''}>${escape(code.join('\n'))}</code></pre><button class="docs-copy" type="button" hidden>Copy</button></div>`)
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const base = heading[2].toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
      const count = headingIds.get(base) ?? 0
      headingIds.set(base, count + 1)
      const id = count ? `${base}-${count}` : base
      blocks.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`)
      index++
      continue
    }
    if (index + 1 < lines.length && line.includes('|') && tableRule(lines[index + 1])) {
      const headers = tableCells(line)
      index += 2
      const rows: string[] = []
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(`<tr>${tableCells(lines[index++]).map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`)
      }
      blocks.push(`<div class="docs-table" role="region" aria-label="Reference table" tabindex="0"><table><thead><tr>${headers.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`)
      continue
    }
    if (listItem(line)) {
      const ordered = /^\d+\./.test(line), items: string[] = []
      while (index < lines.length && listItem(lines[index]) && /^\d+\./.test(lines[index]) === ordered) {
        items.push(`<li>${inline(lines[index++].replace(/^(?:[-*] |\d+\. )/, ''))}</li>`)
      }
      const tag = ordered ? 'ol' : 'ul'
      blocks.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }
    const paragraph: string[] = [line]
    index++
    while (index < lines.length && lines[index].trim() && !/^(?:#{1,6}\s|```)/.test(lines[index]) && !listItem(lines[index]) && !(lines[index].includes('|') && tableRule(lines[index + 1] ?? ''))) paragraph.push(lines[index++])
    blocks.push(`<p>${inline(paragraph.join(' '))}</p>`)
  }
  return blocks.join('\n')
}

function navigation(current: string): string {
  const groups = [...new Set(guides.map(guide => guide.group))]
  return `<nav class="docs-navigation" aria-label="Documentation">${groups.map(group => `<div class="docs-nav-group"><p>${escape(group)}</p><ul>${guides.filter(guide => guide.group === group).map(guide => `<li><a href="${pathFor(guide.slug)}"${guide.slug === current ? ' aria-current="page"' : ''}>${escape(guide.title)}</a></li>`).join('')}</ul></div>`).join('')}</nav>`
}

export function docsPages(): Array<{ path: string; html: string }> {
  return guides.map((guide, index) => {
    const source = markdown[`../../docs/${guide.file}`]
    if (!source) throw new Error(`Missing documentation source: ${guide.file}`)
    const previous = guides[index - 1], next = guides[index + 1]
    const body = `<main id="main" class="docs-layout"><aside class="docs-sidebar"><a class="docs-overview" href="/docs">Lanyard docs</a><details class="docs-mobile-nav"><summary>Browse the guide</summary>${navigation(guide.slug)}</details><div class="docs-desktop-nav">${navigation(guide.slug)}</div></aside><article class="docs-article"><p class="docs-eyebrow">${escape(guide.group)}</p>${renderMarkdown(source)}<footer class="docs-article-footer"><a href="${repository}/blob/main/docs/${guide.file}">Read this guide on GitHub ↗</a><nav class="docs-pagination" aria-label="Continue reading">${previous ? `<a href="${pathFor(previous.slug)}"><span>Previous</span>${escape(previous.title)}</a>` : '<span></span>'}${next ? `<a href="${pathFor(next.slug)}"><span>Next</span>${escape(next.title)} →</a>` : ''}</nav></footer></article></main>`
    return { path: pathFor(guide.slug), html: siteDocument({ title: `${guide.title} — Lanyard`, description: `Lanyard documentation: ${guide.title.toLowerCase()}. Practical guides for your team, schedule, hours and payroll exports.`, body, styles: ['/docs.css'], bodyClass: 'docs-page', script: COPY }) }
  })
}
