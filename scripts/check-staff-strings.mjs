// This deliberately inventories the native staff journey, not the unfinished full product catalog.
import ts from 'typescript'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import '../public/staff-language.js'
const root=resolve(process.argv.includes('--root')?process.argv[process.argv.indexOf('--root')+1]:'.')
const inventory={
 'src/lanyard/ui/shell.ts':null,'src/lanyard/ui/schedule.ts':null,'src/lanyard/ui/grid.ts':null,
 'src/lanyard/ui/swaps.ts':null,'src/lanyard/ui/openshifts.ts':null,'src/lanyard/ui/time.ts':null,
 'src/lanyard/ui/history.ts':null,'src/lanyard/ui/transfers.ts':null,'src/lanyard/ui/offline.ts':null,
 'src/lanyard/ui/language.ts':null,
 'src/lanyard/ui/questions.ts':['clockQuestions','answersNote','safetyCard'],
 'src/lanyard/ui/mealrules.ts':['mealQuestion','mealNote'],
 'src/lanyard/ui/breaks.ts':['describe','breakButtons','clockBreaks','breakQuestions','breakNote'],
 'src/lanyard/ui/photos.ts':['photoFields','photoReview'],
 'src/lanyard/ui/geofence.ts':['locationFields','locationReview'],
 'src/lanyard/ui/notices.ts':['noticeInbox'],
 'public/kiosk.js':null,'public/clock-outbox.js':null,'public/mobile-workflows.js':null,'public/lanyard.js':null,
}
const catalog=JSON.parse(await readFile(resolve(root,'src/lanyard/staff-catalog.json'),'utf8')),missing=new Set(),unmarked=[]
const check=key=>{if(typeof catalog[key]!=='string'||!catalog[key].trim())missing.add(key);else{
 const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',')
 if(placeholders(key)!==placeholders(catalog[key]))throw new Error('Spanish placeholders differ: '+key)
}}
for(const [path,selected]of Object.entries(inventory)){
 const source=await readFile(resolve(root,path),'utf8'),file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true)
 function visit(node,scope){
  if(ts.isFunctionDeclaration(node))scope=node.name?.text
  if(ts.isVariableDeclaration(node)&&node.initializer&&(ts.isArrowFunction(node.initializer)||ts.isFunctionExpression(node.initializer))&&!scope)scope=node.name.text
  if(!selected||selected.includes(scope)){
   if(ts.isTaggedTemplateExpression(node)&&/^(html\(s\)|text)$/.test(node.tag.getText(file))){
    const tpl=node.template,strings=ts.isTemplateExpression(tpl)?[tpl.head.text,...tpl.templateSpans.map(x=>x.literal.text)]:[tpl.text],values=ts.isTemplateExpression(tpl)?tpl.templateSpans.map(()=>0):[]
    LanyardI18n.template(catalog,'en',strings,values,check)
   }
   if(ts.isCallExpression(node)&&node.expression.getText(file)==='t'){
    const index=path.startsWith('public/')?0:1,arg=node.arguments[index]
    if(arg&&ts.isStringLiteral(arg))check(arg.text)
   }
   if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateExpression(node))&&/<[a-z][^>]*>/i.test(node.getText(file))&&!(node.parent&&ts.isTaggedTemplateExpression(node.parent)))unmarked.push(path+':'+(file.getLineAndCharacterOfPosition(node.getStart(file)).line+1))
  }
  ts.forEachChild(node,n=>visit(n,scope))
 }visit(file)
}
if(missing.size||unmarked.length){console.error('Staff journey Spanish catalog check failed');for(const key of missing)console.error('Missing Spanish: '+JSON.stringify(key));for(const at of unmarked)console.error('Unmarked staff markup: '+at);process.exitCode=1}
else console.log('Staff journey Spanish catalog check passed')
