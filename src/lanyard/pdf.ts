// A plain-text PDF: US Letter landscape pages of Helvetica text placed at fixed columns,
// written byte for byte (WinAnsi), so the same rows always give the same file.
export type Cell=[x:number,text:string]
export type Line={cells:Cell[];size?:number;bold?:boolean;gap?:number}

const WIN:Record<string,number>={'–':0x96,'—':0x97,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'…':0x85}
function encode(text:string) {
 let out='';for(const ch of text){const c=WIN[ch]??ch.codePointAt(0)!;out+=c<=0xff&&(c>=0x20||c===0x09)?String.fromCharCode(c):'?'}
 return out.replace(/[\\()]/g,m=>'\\'+m)
}
export function pdf(lines:Line[]):Uint8Array<ArrayBuffer> {
 const W=792,H=612,M=48,pages:string[]=[];let y=H-M,body=''
 for(const l of lines) {
  const size=l.size??10,step=size*1.45+(l.gap??0)
  if(y-step<M){pages.push(body);body='';y=H-M}
  y-=step
  for(const [x,t] of l.cells)body+=`BT /${l.bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${M+x} ${y.toFixed(2)} Tm (${encode(t)}) Tj ET\n`
 }
 pages.push(body)
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']
 const kids:number[]=[]
 for(const content of pages) {
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`)
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length} 0 R >>`)
  kids.push(objects.length)
 }
 objects[1]=`<< /Type /Pages /Kids [${kids.map(k=>`${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
 let out='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';const offsets:number[]=[]
 objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`})
 const xref=out.length
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return Uint8Array.from(out,c=>c.charCodeAt(0))
}
