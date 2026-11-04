// US Letter landscape, with deterministic embedded Unicode glyph subsets.
import {embedFonts,stream} from './pdf-font'
export type Cell=[x:number,text:string]
export type Line={cells:Cell[];size?:number;bold?:boolean;gap?:number}

export function pdf(lines:Line[]):Uint8Array<ArrayBuffer> {
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','']
 const font=embedFonts(lines,objects)
 const W=792,H=612,M=48,pages:string[]=[];let y=H-M,body=''
 for(const l of lines) {
  const size=l.size??10,step=size*1.45+(l.gap??0)
  if(y-step<M){pages.push(body);body='';y=H-M}
  y-=step
  for(const [x,t] of l.cells) {
   body+=`BT 1 0 0 1 ${M+x} ${y.toFixed(2)} Tm ${font.text(t,size,l.bold)}ET\n`
  }
 }
 pages.push(body)
 const kids:number[]=[]
 for(const content of pages) {
  objects.push(stream(content))
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << ${font.resources} >> >> /Contents ${objects.length} 0 R >>`)
  kids.push(objects.length)
 }
 objects[1]=`<< /Type /Pages /Kids [${kids.map(k=>`${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
 let out='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';const offsets:number[]=[]
 objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`})
 const xref=out.length
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return Uint8Array.from(out,c=>c.charCodeAt(0))
}
