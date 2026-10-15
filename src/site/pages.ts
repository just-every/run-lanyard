// Static public pages carry no installation data. The shared Run page remains
// supplied by the pinned foundation; the approved landing is edition-owned.
import { runPageHtml, siteNotFoundHtml, type RunData, type SiteBuild } from '../base/run-site'
import { identity } from '../identity'
import { docsPages } from './docs'
import { homePageHtml } from './home'
import run from './run.json'

export function sitePages(): SiteBuild {
  const data: RunData = { ...run, name: identity.product, docs: true }
  return {
    pages: [
      { path: '/', html: homePageHtml() },
      { path: '/run', html: runPageHtml(identity, data) },
      ...docsPages(),
      { path: '/404', html: siteNotFoundHtml(identity, data) },
    ],
    assets: ['rer-theme.css', 'site.css', 'docs.css', 'fonts', 'brand'],
  }
}
