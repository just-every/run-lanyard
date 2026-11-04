// PUBLIC-001: retain the installation/docs visitor journey without pinning
// static copy, generated file inventories or every guide at both viewports.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

import {createServer} from 'node:http'
import {chromium} from '@playwright/test'
import {harness} from '../harness.mjs'

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
  const native=await harness()
  const key=await native.cmd('agent.create',{label:'synthetic-lanyard-1'})
  const catalogue=async(...parts)=>{
    const method=parts.join('/')
    const response=await native.send('/mcp',{jsonrpc:'2.0',id:'docs-catalogue',method,params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}},'',{authorization:'Bearer '+key.token,'mcp-protocol-version':'2026-07-28','mcp-method':method})
    assert.equal(response.status,200);assert.ok(response.value.result)
    return response.value.result
  }
  const publicTools=(await catalogue('tools','list')).tools,publicResources=(await catalogue('resources','templates','list')).resourceTemplates,publicPrompts=(await catalogue('prompts','list')).prompts
  let browser
  try {
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
    for(const width of [1440,390]){
      const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[]
      page.on('pageerror',e=>errors.push(e.message))
      await page.goto(`http://127.0.0.1:${server.address().port}/docs/workforce`,{waitUntil:'networkidle'})
      assert.equal(await page.locator('article').isVisible(),true,'the owner guide is readable through public HTTP')
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'PEOPLE-002 guide fits viewport')
      if(process.env.WORKFORCE_SCREENS){mkdirSync(process.env.WORKFORCE_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.WORKFORCE_SCREENS,`guide-${width}.png`),fullPage:true})}
      await page.goto(`http://127.0.0.1:${server.address().port}/docs`,{waitUntil:'networkidle'})
      if(width===390)await page.getByText('Browse the guide',{exact:true}).click()
      await page.getByRole('navigation',{name:'Documentation',exact:true}).filter({visible:true}).getByRole('link',{name:'Agent API',exact:true}).click()
      assert.equal(new URL(page.url()).pathname,'/docs/agents','the guide navigation exposes the contracted agent route')
      if(width===1440){
        const jobs=await page.locator('article h4').evaluateAll(headings=>headings.map(h=>({name:h.nextElementSibling.textContent})))
        assert.deepEqual(jobs.map(j=>j.name),publicTools.map(t=>t.name),'the built public catalogue exactly matches the authenticated MCP listing')
        for(const tool of publicTools){
          const heading=page.getByRole('heading',{level:4,name:tool.title,exact:true})
          const section=await heading.evaluate(h=>{let text='';for(let p=h.nextElementSibling;p&&p.tagName!=='H4'&&p.tagName!=='H3';p=p.nextElementSibling)text+=p.textContent+' ';return text})
          assert.ok(section.includes(tool._meta['com.runeditrun/scope']))
          for(const cls of tool._meta['com.runeditrun/classes'])assert.ok(section.includes(cls))
          const capacities=(schema,path='')=>{
            if(!schema||typeof schema!=='object')return []
            const bounds=Object.entries(schema).filter(([key])=>['minimum','maximum','minItems','maxItems','minLength','maxLength'].includes(key))
            return [...(bounds.length?[[path,bounds]]:[]),...Object.entries(schema.properties??{}).flatMap(([name,child])=>capacities(child,path?path+'.'+name:name)),...(schema.items&&!Array.isArray(schema.items)?capacities(schema.items,path+'[]'):[])]
          }
          for(const [path,bounds] of capacities(tool.inputSchema)){
            assert.ok(section.includes('Input capacity for '+path+':'),'nested input capacity is documented for '+tool.name+' '+path)
            for(const [key,value] of bounds)assert.ok(section.includes(key+' '+value))
          }
          assert.ok(section.includes('agent-surface.json'),'each computed class names its conformance fixture evidence')
        }
        const resourceText=await page.locator('#resource-templates-and-events').evaluate(h=>{let text='';for(let p=h.nextElementSibling;p&&p.tagName!=='H3';p=p.nextElementSibling)text+=p.textContent+' ';return text})
        const documentedTemplates=[...resourceText.matchAll(/lanyard:\/\/[^\s]+/g)].map(m=>m[0])
        assert.deepEqual(documentedTemplates,publicResources.map(r=>r.uriTemplate))
        for(const prompt of publicPrompts)assert.ok((await page.locator('article').innerText()).includes(prompt.name))
        const article=await page.locator('article').innerText()
        assert.equal(article.includes(native.auth.OWNER_EMAIL),false,'the public guide contains no installation identity')
        const alias=await context.request.get(`http://127.0.0.1:${server.address().port}/docs/agents-api`)
        assert.equal(alias.status(),200,'existing guide bookmarks remain usable')
      }
      assert.equal(await page.locator('article').isVisible(),true)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'the generated catalogue fits the viewport')
      if(process.env.WORKFORCE_SCREENS){await page.locator('#public-mcp-catalogue').scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.WORKFORCE_SCREENS,`agents-${width}.png`)})}
      assert.deepEqual(errors,[])
      await context.close()
    }
  } finally {if(browser)await browser.close();await native.close();await new Promise(r=>server.close(r))}
})
