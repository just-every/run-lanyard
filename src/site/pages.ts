// Static public pages carry no installation data. The shared Run page remains
// supplied by the pinned foundation; the approved landing is edition-owned.
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { docsPages } from './docs'
import { homePageHtml } from './home'
import run from './run.json'

export function sitePages({ contract }: Partial<SiteContext> = {}): SiteBuild {
  const data: RunData = { ...run, name: identity.product, docs: true }
  return {
    pages: [
      { path: '/', html: homePageHtml() },
      { path: '/run', html: runPageHtml(identity, data, contract) },
      ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, data, contract) }] : []),
      ...docsPages(),
      { path: '/404', html: siteNotFoundHtml(identity, data, contract) },
    ],
    assets: ['rer-theme.css', 'site.css', 'docs.css', 'fonts', 'brand'],
  }
}
