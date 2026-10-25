// PUBLIC-001: retain the installation/docs visitor journey without pinning
// static copy, generated file inventories or every guide at both viewports.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

import {createServer} from 'node:http'
import {chromium} from '@playwright/test'

const root = new URL('../..', import.meta.url).pathname
const site = join(root, 'dist/site')
const served = path => [path, `${path}.html`, join(path, 'index.html')].some(candidate => existsSync(join(site, candidate)) && !candidate.endsWith('/'))
const attrs = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map(match => match[1].replaceAll('&amp;', '&'))

test('PUBLIC-001: the run site leads to installation and readable owner guides at 1440 and 390', async () => {
  execFileSync(join(root, 'node_modules/.bin/rer'), ['build', '--site'], { cwd: root, stdio: 'pipe' })
  const home = readFileSync(join(site, 'index.html'), 'utf8')
  assert.ok(attrs(home, 'href').includes('/run'), 'the homepage leads to installation at /run')
  assert.doesNotMatch(home, /localhost|127\.0\.0\.1|RER_[A-Z]/, 'the homepage shows no local addresses or rer output')
  assert.ok(served('run') && served('docs'), '/run and /docs are built')
  assert.ok(attrs(home, 'href').includes('/docs'), 'the homepage leads to the owner guides at /docs')
  const server=createServer((request,response)=>{
    let file=resolve(site,'.'+decodeURIComponent(new URL(request.url,'http://local').pathname))
    if(!file.startsWith(resolve(site)+'/')){response.writeHead(404).end();return}
    if(!extname(file))file+='.html'
    if(!existsSync(file)){response.writeHead(404).end();return}
    const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'}
    response.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream'});response.end(readFileSync(file))
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  let browser
  try {
    browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
    for(const width of [1440,390]){
      const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[]
      page.on('pageerror',e=>errors.push(e.message))
      await page.goto(`http://127.0.0.1:${server.address().port}/docs/workforce`,{waitUntil:'networkidle'})
      assert.equal(await page.locator('article').isVisible(),true,'the owner guide is readable through public HTTP')
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'PEOPLE-002 guide fits viewport')
      if(process.env.WORKFORCE_SCREENS){mkdirSync(process.env.WORKFORCE_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.WORKFORCE_SCREENS,`guide-${width}.png`),fullPage:true})}
      assert.deepEqual(errors,[])
      await context.close()
    }
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r))}
})
