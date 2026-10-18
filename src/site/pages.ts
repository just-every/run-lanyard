// Static public pages carry no installation data. The shared Run page remains
// supplied by the pinned foundation; the approved landing is edition-owned.
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { docsPages } from './docs'
import { homePageHtml } from './home'
import run from './run.json'

// Base's shared pages print British "licence"; Lanyard's heads add the site's stylesheet, in US English.
// Their tab icons are the small ones seedIcons() freezes into every Base head.
const lanyardHead = (html: string) => html
  .replace(`<link rel="stylesheet" href="${identity.theme}">`, `<link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="${identity.theme}">`)
  .replace(`${run.licence} licence<`, `${run.licence} license<`)

export function sitePages({ contract }: Partial<SiteContext> = {}): SiteBuild {
  const data: RunData = { ...run, name: identity.product }
  return {
    pages: [
      { path: '/', html: homePageHtml() },
      { path: '/run', html: lanyardHead(runPageHtml(identity, data, contract)) },
      ...(contract ? [{ path: '/contract', html: lanyardHead(contractPageHtml(identity, data, contract)) }] : []),
      ...docsPages(),
      { path: '/404', html: lanyardHead(siteNotFoundHtml(identity, data, contract)) },
    ],
    assets: ['rer-theme.css', 'site.css', 'landing', 'docs.css', 'fonts', 'brand', 'site', 'favicon.ico', 'favicon-32.svg', 'favicon-16.svg', 'apple-touch-icon.png'],
  }
}
