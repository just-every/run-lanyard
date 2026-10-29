// This deliberately inventories the native staff journey, not the unfinished full product catalog.
import ts from 'typescript'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import '../public/staff-language.js'
const root=resolve(process.argv.includes('--root')?process.argv[process.argv.indexOf('--root')+1]:'.')
const inventory={
 'src/lanyard/localization.ts':['punchFlag','captureName'],
 "src/lanyard/ui/cases.ts":["attest", "myRequestsCard"],
 "src/lanyard/ui/review.ts":["reviewNote", "returnedCard"],
 "src/lanyard/ui/periods.ts":["range", "signoffCard"],
 "src/lanyard/ui/rounding.ts":["paidNote"],
 "src/lanyard/ui/differentials.ts":["differentialNote"],
 "src/lanyard/ui/earnings.ts":["earningsCard"],
 "src/lanyard/ui/feedback.ts":["myFeedbackCard"],
 "src/lanyard/ui/journal.ts":["sharedNotesCard"],
 "src/lanyard/ui/closerules.ts":["confirmForm", "reminderCard"],
 "src/lanyard/ui/askbar.ts":["askbar"],
 "src/lanyard/ui/shiftwork.ts":["response", "shiftworkCard", "segmentTime"],
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
 'public/punch-photo.js':null,'public/punch-location.js':null,
 'public/kiosk.js':null,'public/clock-outbox.js':null,'public/mobile-workflows.js':null,'public/lanyard.js':null,
}
const catalog=JSON.parse(await readFile(resolve(root,'src/lanyard/staff-catalog.json'),'utf8')),missing=new Set(),unmarked=[]
const check=key=>{if(typeof catalog[key]!=='string'||!catalog[key].trim())missing.add(key);else{
 const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',')
 if(placeholders(key)!==placeholders(catalog[key]))throw new Error('Spanish placeholders differ: '+key)
}}
for(const key of Object.keys(catalog))check(key)
// Consent notices are literal source text imported by the renderer. Inventory them
// separately so changing either notice cannot bypass the same Spanish gate.
for(const [path,name] of [['src/lanyard/domain/photos.ts','PHOTO_NOTICE'],['src/lanyard/domain/geofence.ts','LOCATION_NOTICE']]){
 const source=await readFile(resolve(root,path),'utf8'),file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true)
 let found=false
 const visit=node=>{
  if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name){
   found=true
   if(!node.initializer||!ts.isStringLiteral(node.initializer)&&!ts.isNoSubstitutionTemplateLiteral(node.initializer))throw new Error('Consent notice must have inventoried literal wording: '+name)
   check(node.initializer.text)
  }
  ts.forEachChild(node,visit)
 }
 visit(file)
 if(!found)throw new Error('Inventoried consent notice is missing: '+name)
}
const labelArguments={field:[1],textarea:[1],utc:[1],card:[0],empty:[0],disclosure:[0],form:[3]}
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
   if(ts.isCallExpression(node)&&/^(t|tr)$/.test(node.expression.getText(file))){
    const index=path.startsWith('public/')?0:1,arg=node.arguments[index]
    const literalKeys=value=>{
     if(!value)return
     if(ts.isStringLiteral(value)||ts.isNoSubstitutionTemplateLiteral(value))check(value.text)
     else if(ts.isConditionalExpression(value)){literalKeys(value.whenTrue);literalKeys(value.whenFalse)}
     else if(ts.isElementAccessExpression(value)&&ts.isArrayLiteralExpression(value.expression))value.expression.elements.forEach(literalKeys)
    }
    literalKeys(arg)
   }
   if(ts.isCallExpression(node)&&!path.startsWith('public/'))for(const index of labelArguments[node.expression.getText(file)]??[]){
    const label=node.arguments[index]
    if(label&&ts.isStringLiteral(label)&&label.text.trim()){
     check(label.text)
     unmarked.push(path+':'+(file.getLineAndCharacterOfPosition(label.getStart(file)).line+1))
    }
   }
   // Client catalog lookups also use small label maps. Check their literal values,
   // while selectors, class names and command identifiers remain program data.
   if(path.startsWith('public/')&&ts.isStringLiteral(node)&&/[A-Za-z] [A-Za-z]|[A-Za-z][.!?…]$/.test(node.text)
      &&! /^(?:[.#[<]|(?:button|input|form|details|template|select)[.#[:])/.test(node.text)
      &&!['secondary small'].includes(node.text))check(node.text)
   if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateExpression(node))&&/<[a-z][^>]*>/i.test(node.getText(file))&&!(node.parent&&ts.isTaggedTemplateExpression(node.parent)))unmarked.push(path+':'+(file.getLineAndCharacterOfPosition(node.getStart(file)).line+1))
  }
  ts.forEachChild(node,n=>visit(n,scope))
 }visit(file)
}
if(missing.size||unmarked.length){console.error('Staff journey Spanish catalog check failed');for(const key of missing)console.error('Missing Spanish: '+JSON.stringify(key));for(const at of unmarked)console.error('Unmarked staff markup: '+at);process.exitCode=1}
else console.log('Staff journey Spanish catalog check passed')
