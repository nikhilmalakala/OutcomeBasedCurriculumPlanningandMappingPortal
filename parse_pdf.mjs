import pdfParse from './backend/node_modules/pdf-parse/lib/pdf-parse.js';
import { readFileSync, writeFileSync } from 'fs';

const buf = readFileSync('./backend/uploads/curriculum-books/1781797172925-B.Tech_CSE_ProgramStructure_Syllabus-2-R24.pdf');
const data = await pdfParse(buf);
console.log('NUM_PAGES:', data.numpages);
writeFileSync('./pdf_content.txt', data.text, 'utf8');
console.log('Written to pdf_content.txt — total chars:', data.text.length);
// Print first 20000 chars (covers first ~15 pages)
console.log(data.text.substring(0, 20000));
