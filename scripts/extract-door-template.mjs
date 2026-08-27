import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
  path.resolve(__dirname, '../../medical-device-v2/src/api-client/src/mock/door/template-list.ts'),
  'utf8',
);
const m = src.match(/templateContent:\s*[\r\n]+\s*'(\{)/);
if (!m)
  throw new Error('templateContent not found');
const jsonStart = m.index + m[0].length - 1;
const jsonEnd = src.indexOf("',\r\n    templateFormat", jsonStart);
const jsonEnd2 = jsonEnd < 0 ? src.indexOf("',\n    templateFormat", jsonStart) : jsonEnd;
if (jsonEnd2 < 0)
  throw new Error('templateContent end not found');
const json = JSON.parse(src.slice(jsonStart, jsonEnd2));
const out = { id: 796, templateContent: JSON.stringify(json) };
fs.writeFileSync(path.resolve(__dirname, '../src/mock/door-template-main.json'), JSON.stringify(out));
console.log('exported', json.width, json.height, 'nodes', json.data?.length);
