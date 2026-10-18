// Static public pages carry no installation data. The shared Run page remains
// supplied by the pinned foundation; the approved landing is edition-owned.
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { docsPages } from './docs'
import { homePageHtml } from './home'
import { iconLinks } from './shell'
import run from './run.json'

// Base's shared pages link the full mark as their tab icon and print British
// "licence"; Lanyard's heads carry its small icons and the site's stylesheet, in US English.
const lanyardHead = (html: string) => html
  .replace(`<link rel="icon" href="${identity.mark}">`, `${iconLinks}<link rel="stylesheet" href="/site.css">`)
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
