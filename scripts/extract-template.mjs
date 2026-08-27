import fs from 'fs';

const src = 'e:/projects/4.6.1/medical-device-v2/src/api-client/src/mock/bed/template-list.ts';
const text = fs.readFileSync(src, 'utf8');
const match = text.match(/id: 1,[\s\S]*?templateContent:\s*'([\s\S]*?)',\s*templateFormat/);
if (!match) {
  console.error('template not found');
  process.exit(1);
}
const content = match[1].replace(/\\'/g, "'");
const out = 'e:/projects/4.6.1/ward-digital-twin/src/mock/bed-template-default.json';
fs.writeFileSync(out, JSON.stringify({ id: 1, templateContent: content }));
console.log('ok', fs.statSync(out).size);
