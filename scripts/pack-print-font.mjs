// Repackage the licensed glyph source for binary search in the Worker.
// Usage: node scripts/pack-print-font.mjs path-to-unifont_all.hex.gz
import {readFileSync,writeFileSync} from 'node:fs'
import {gzipSync,gunzipSync} from 'node:zlib'

const source=gunzipSync(readFileSync(process.argv[2])).toString('utf8').trim().split('\n')
const records=source.map(line=>{
 const [code,hex]=line.trim().split(':'),glyph=Buffer.from(hex,'hex')
 if(![16,32].includes(glyph.length))throw Error(`Unsupported glyph width at ${code}`)
 const record=Buffer.alloc(36)
 record.writeUInt32BE(parseInt(code,16)+(glyph.length===16?0x80000000:0))
 // Keep all rows at two bytes so the runtime only needs fixed record offsets.
 if(glyph.length===16)for(let y=0;y<16;y++)record[4+y*2]=glyph[y]
 else glyph.copy(record,4)
 return {code:parseInt(code,16),record}
}).sort((a,b)=>a.code-b.code)
const encoded=gzipSync(Buffer.concat(records.map(r=>r.record)),{level:9,mtime:0}).toString('base64')
writeFileSync('src/lanyard/fonts/unifont/glyphs.json',JSON.stringify(encoded.match(/.{1,120}/g),null,1)+'\n')
