// Lanyard Print: an embedded subset of the OFL Unifont glyphs, with Unicode text.
import {gunzipSync} from 'fflate'
import packed from './fonts/unifont/glyphs.json'

type Glyph={char:string;width:number;outline:string}
let source:DataView|undefined
function glyph(char:string):Glyph {
 source??=new DataView(gunzipSync(Uint8Array.from(atob(packed.join('')),c=>c.charCodeAt(0))).buffer)
 const code=char.codePointAt(0)!
 let lo=0,hi=source.byteLength/36
 while(lo<hi){const mid=(lo+hi)>>>1;if((source.getUint32(mid*36)&0x7fffffff)<code)lo=mid+1;else hi=mid}
 const offset=lo*36
 if(offset===source.byteLength||(source.getUint32(offset)&0x7fffffff)!==code)throw Error(`Print font has no glyph for U+${code.toString(16).toUpperCase()}`)
 const width=source.getUint32(offset)&0x80000000?8:16,mark=/\p{Mark}/u.test(char)
 let outline=''
 for(let y=0;y<16;y++) {
  const row=source.getUint16(offset+4+y*2)
  for(let x=0;x<width;x++)if(row&(0x8000>>>x)) {
   const start=x
   while(x+1<width&&(row&(0x8000>>>(x+1))))x++
   outline+=`${start-(mark?width:0)} ${13-y} ${x-start+1} 1 re\n`
  }
 }
 return {char,width:mark?0:width,outline}
}
const hex=(n:number)=>n.toString(16).padStart(2,'0')
const unicode=(s:string)=>Array.from({length:s.length},(_,i)=>s.charCodeAt(i).toString(16).padStart(4,'0')).join('')
export const stream=(content:string)=>`<< /Length ${content.length} >>\nstream\n${content}endstream`

export function embedFonts(lines:{cells:[number,string][]}[],objects:string[]) {
 const chars=[...new Set(lines.flatMap(l=>l.cells.flatMap(([,t])=>[...t])))].sort((a,b)=>a.codePointAt(0)!-b.codePointAt(0)!)
 const codes=new Map<string,{font:string;code:string}>(),resources:string[]=[]
 const add=(value:string)=>{objects.push(value);return objects.length}
 // Simple fonts have 256 slots; another subset handles each further 255 glyphs.
 for(let start=0;start<chars.length;start+=255) {
  const subset=chars.slice(start,start+255).map(glyph),font=`F${start/255+1}`
  const cmap=add(stream(`/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Lanyard) /Ordering (Unicode) /Supplement 0 >> def\n/CMapName /LanyardPrint def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n${Array.from({length:Math.ceil(subset.length/100)},(_,chunk)=>{const group=subset.slice(chunk*100,chunk*100+100);return `${group.length} beginbfchar\n${group.map((g,i)=>`<${hex(chunk*100+i+1)}> <${unicode(g.char)}>`).join('\n')}\nendbfchar\n`}).join('')}endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`))
  for(const bold of [false,true]) {
   const procs=subset.map((g,i)=>`/g${i+1} ${add(stream(`${g.width} 0 ${g.width===0?-16:0} -2 17 15 d1\n${g.outline}${bold?'0.25 w B':'f'}\n`))} 0 R`).join(' ')
   const id=add(`<< /Type /Font /Subtype /Type3 /Name /LanyardPrint /FontBBox [-16 -2 17 15] /FontMatrix [0.0625 0 0 0.0625 0 0] /CharProcs << ${procs} >> /Encoding << /Type /Encoding /Differences [1 ${subset.map((_,i)=>`/g${i+1}`).join(' ')}] >> /FirstChar 1 /LastChar ${subset.length} /Widths [${subset.map(g=>g.width).join(' ')}] /Resources << >> /ToUnicode ${cmap} 0 R >>`)
   resources.push(`/${font}${bold?'B':''} ${id} 0 R`)
  }
  subset.forEach((g,i)=>codes.set(g.char,{font,code:hex(i+1)}))
 }
 return {resources:resources.join(' '),text:(value:string,size:number,bold=false)=>{
  let result='',font='',encoded=''
  const flush=()=>{if(encoded)result+=`/${font}${bold?'B':''} ${size} Tf <${encoded}> Tj\n`;encoded=''}
  for(const char of value){const next=codes.get(char)!;if(font!==next.font){flush();font=next.font}encoded+=next.code}
  flush();return result
 }}
}
