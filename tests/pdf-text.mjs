// Read the downloaded document through an independent PDF reader.
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function pdfText(bytes) {
 const document=await getDocument({data:Uint8Array.from(bytes),useSystemFonts:false}).promise
 try {
  const pages=[]
  for(let n=1;n<=document.numPages;n++) {
   const page=await document.getPage(n),content=await page.getTextContent({disableNormalization:true})
   pages.push(content.items.map(item=>item.str+(item.hasEOL?'\n':'')).join(''))
  }
  return pages.join('\n')
 } finally {await document.destroy()}
}
