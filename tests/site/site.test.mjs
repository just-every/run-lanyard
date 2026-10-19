// The run site (run-lanyard.com) as `rer build --site` writes it: a visitor reaches /run from the homepage's
// primary action, every page's links and files resolve inside the site, no page links an instance-only route,
// and the homepage carries no local addresses or rer output.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../..', import.meta.url).pathname
const site = join(root, 'dist/site')
const pages = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : [])
const served = path => [path, `${path}.html`, join(path, 'index.html')].some(candidate => existsSync(join(site, candidate)) && !candidate.endsWith('/'))
const attrs = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map(match => match[1].replaceAll('&amp;', '&'))

test('PUBLIC-001: the run site builds, its primary action opens /run, it leads to owner guides built from the repository Markdown, and every link and file it names resolves', () => {
  execFileSync(join(root, 'node_modules/.bin/rer'), ['build', '--site'], { cwd: root, stdio: 'pipe' })
  const home = readFileSync(join(site, 'index.html'), 'utf8')
  assert.match(home, /<a class="run-button" href="\/run">Run Lanyard/, 'the homepage leads with Run Lanyard to /run')
  assert.doesNotMatch(home, /localhost|127\.0\.0\.1|RER_[A-Z]/, 'the homepage shows no local addresses or rer output')
  assert.ok(served('run') && served('docs'), '/run and /docs are built')
  assert.ok(attrs(home, 'href').includes('/docs'), 'the homepage leads to the owner guides at /docs')
  const project = JSON.parse(readFileSync(join(root, 'rer-project.json'), 'utf8')).projectId
  assert.ok(readFileSync(join(site, 'run.html'), 'utf8').includes(`rer dev ${project}`), '/run installs this repository with rer')
  // Each guide under docs/ is built into /docs with its Markdown title as the page heading.
  const text = html => html.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"')
  for (const file of readdirSync(join(root, 'docs')).filter(name => name.endsWith('.md'))) {
    const title = readFileSync(join(root, 'docs', file), 'utf8').match(/^# (.+)$/m)[1], page = file === 'README.md' ? 'docs.html' : `docs/${file.slice(0, -3).toLowerCase()}.html`
    assert.equal(text(readFileSync(join(site, page), 'utf8').match(/<h1[^>]*>(.*?)<\/h1>/s)[1]), title, `${file} is built at ${page}`)
  }
  const all = pages(site)
  assert.ok(all.length > 3, 'the homepage, /run, the docs and the not-found page')
  for (const file of all) {
    const html = readFileSync(file, 'utf8'), where = relative(site, file)
    const refs = [...attrs(html, 'href'), ...attrs(html, 'src'), ...attrs(html, 'srcset').flatMap(set => set.split(',').map(part => part.trim().split(/\s+/)[0]))]
    for (const ref of refs.filter(ref => ref.startsWith('/') && !ref.startsWith('//'))) {
      const path = decodeURIComponent(ref.split(/[?#]/)[0])
      assert.doesNotMatch(path, /^\/(signin|login|sign-in|setup|app|auth)(\/|$)/, `${where} links the instance-only ${path}`)
      if (path !== '/') assert.ok(served(path), `${where} names ${path}, which the site does not serve`)
    }
  }
})
