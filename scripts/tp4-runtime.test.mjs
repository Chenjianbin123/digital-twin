import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createSnapshotDocument } from '../src/core/template/tp4-parser.ts';
import { parseTemplateInfo } from '../src/core/template/parser.ts';
import { buildBedRuntimeData, buildDoorRuntimeData } from '../src/core/template/runtime-data.ts';
import { makeTP4, makeBed, makeLegacyV3 } from './fixtures/tp4-runtime-fixtures.mjs';

const parse = document => parseTemplateInfo({ id: 42, templateContent: JSON.stringify(document) });

test('TP4 uses official parser and retains absolute bounds without percentage conversion', () => {
  const input = makeTP4();
  const output = parse(input);
  assert.equal(output.document.schemaVersion, 4);
  assert.equal(output.width, 800);
  assert.deepEqual(output.document.pages[0].regions[0].editor.bounds, input.pages[0].regions[0].editor.bounds);
  assert.equal(output.nodes.length, 0);
});
test('TP4 portrait uses frame dimensions and skips editor-only pages', () => {
  const input = makeTP4('door', true);
  input.pages.unshift({ ...input.pages[0], key: 'editor', role: 'patientOverviewEditor' });
  const output = parse(input);
  assert.equal(output.height, 800);
  assert.equal(output.document.pages[0].key, 'main');
  assert.equal(output.document.pages.length, 1);
});
test('invalid, empty and future templates fail instead of producing blank screens', () => {
  for (const mutate of [
    d => { d.schemaVersion = 5; }, d => { d.meta.frame.width = 0; },
    d => { d.meta.frame.height = 100000; }, d => { d.pages = []; },
    d => { d.pages[0].regions = []; }, d => { d.pages[0].regions[0].grid = {}; },
  ]) { const input = makeTP4(); mutate(input); assert.throws(() => parse(input)); }
  assert.throws(() => parse({ bundleVersion: 1 }));
});
test('TP4 rejects supplied bounds with missing coordinates, invalid types or non-positive dimensions', () => {
  const valid = { x: 0, y: 0, w: 100, h: 60 };
  const missing = Object.keys(valid).map(key => {
    const bounds = { ...valid }; delete bounds[key]; return bounds;
  });
  const invalid = [
    {}, null, [], 10, false, '100x60', ...missing,
    { ...valid, x: '0' }, { ...valid, y: null }, { ...valid, w: '100' },
    { ...valid, x: Infinity }, { ...valid, h: NaN },
    { ...valid, w: 0 }, { ...valid, h: 0 }, { ...valid, w: -1 }, { ...valid, h: -1 },
  ];
  for (const bounds of invalid) {
    const input = makeTP4(); input.pages[0].regions[0].editor.bounds = bounds;
    assert.throws(() => parse(input), /TP4 模板区域尺寸无效/, JSON.stringify(bounds));
  }
});

test('TP4 accepts grid-only regions and finite pixel bounds including negative offsets', () => {
  const gridOnly = makeTP4(); delete gridOnly.pages[0].regions[0].editor;
  const region = parse(gridOnly).document.pages[0].regions[0];
  assert.equal(region.editor, undefined);
  assert.deepEqual(region.grid, gridOnly.pages[0].regions[0].grid);
  for (const bounds of [{ x: 0, y: 0, w: 100, h: 60 }, { x: -20, y: -10, w: 20.5, h: 0.1 }]) {
    const input = makeTP4(); input.pages[0].regions[0].editor.bounds = bounds;
    assert.deepEqual(parse(input).document.pages[0].regions[0].editor.bounds, bounds);
  }
});

test('all three stored legacy templates are migrated by the official parser', () => {
  for (const name of ['bed-template-default', 'door-template-default', 'door-template-main']) {
    const input = JSON.parse(readFileSync(new URL(`../src/mock/${name}.json`, import.meta.url), 'utf8'));
    const output = parseTemplateInfo({
      id: 1, templateName: name, templateContent: input.templateContent,
      systemType: 'android', templateType: name.startsWith('bed') ? 'bed' : 'door',
    });
    assert.equal(output.document.schemaVersion, 4);
    assert.equal(output.document.meta.migratedFrom, 'v2');
    assert.equal(output.document.meta.id, '1');
    assert.equal(output.document.meta.name, name);
    assert.ok(output.document.pages[0].regions.length > 0);
    assert.equal(output.nodes.length, 0);
  }
});

test('legacy migration receives platform and device metadata without analyzeType routing', () => {
  const templateContent = JSON.stringify({ width: 800, height: 480, data: [
    { id: 'name', type: 'text', left: 20, top: 20, width: 400, height: 60, fontSize: 2, key: 'bedSickInfoVo,sickName' },
  ] });
  for (const [linuxCode, androidCode] of [[1, 2], ['1', '2']]) {
    const linux = parseTemplateInfo({ id: 1, templateContent, systemType: linuxCode, templateType: '1', analyzeType: '1' }).document;
    const android = parseTemplateInfo({ id: 1, templateContent, systemType: androidCode, templateType: '2', analyzeType: '2' }).document;
    assert.equal(linux.meta.systemType, 'linux');
    assert.equal(android.meta.systemType, 'android');
    assert.equal(android.meta.templateType, 'door');
    assert.equal(linux.pages[0].regions[0].widget.style.fontSize, '2px');
    assert.equal(android.pages[0].regions[0].widget.style.fontSize, '2rem');
  }
});

test('TP4 uses its own platform metadata without requiring external systemType', () => {
  const input = makeTP4();
  for (const systemType of [undefined, 2, '2']) {
    const output = parseTemplateInfo({ id: 1, templateContent: JSON.stringify(input), systemType }).document;
    assert.equal(output.meta.systemType, input.meta.systemType);
    assert.equal(output.meta.rootFontSize, input.meta.rootFontSize);
    assert.equal(output.pages[0].regions[0].widget.style.fontSize, input.pages[0].regions[0].widget.style.fontSize);
  }
});

test('unsupported valid JSON and malformed JSON fail without legacy parser fallback', () => {
  for (const templateContent of ['{}', '{"isNew":true,"data":[]}', '{broken json'])
    assert.throws(() => parseTemplateInfo({ id: 1, templateContent }));
  const input = makeTP4();
  input.pages[0].regions[0].widget.content.static = '含转义字符 \\" 的文本';
  assert.equal(parse(input).document.pages[0].regions[0].widget.content.static,
    input.pages[0].regions[0].widget.content.static);
});

test('multi-page V3 without schemaVersion is migrated by the same entry point', () => {
  const input = makeLegacyV3();
  assert.equal(input.schemaVersion, undefined);
  const output = parse(input).document;
  assert.equal(output.schemaVersion, 4);
  assert.equal(output.meta.migratedFrom, 'v3');
  assert.equal(output.pages.length, 2);
  assert.equal(output.pages[0].regions[0].widget.content.path, 'bedSickInfoVo,sickName');
});
test('empty bed excludes stale patient, nursing and infusion data without mutating the bed', () => {
  const bed = { ...makeBed(), isOccupied: false, nursingLabels: [{ name: '旧标签' }], statusBarInfo: { status: '300' } };
  const data = buildBedRuntimeData(bed);
  assert.deepEqual(data.bedSickInfoVo, { bedName: '01床', bedCode: '01' });
  assert.deepEqual(data.bedSickNursingLabelList, []);
  assert.deepEqual(data.statusBarInfo, { status: '', text: '' });
  assert.equal(bed.sickInfo.sickName, '测试甲');
});
test('bed runtime data is isolated and follows the latest patient snapshot', () => {
  const a = buildBedRuntimeData(makeBed('01', '甲'));
  const b = buildBedRuntimeData(makeBed('02', '乙'));
  assert.equal(a.bedSickInfoVo.sickName, '甲');
  assert.equal(b.bedSickInfoVo.sickName, '乙');
  assert.equal(buildBedRuntimeData(makeBed('01', '丙')).bedSickInfoVo.sickName, '丙');
});
test('door runtime retains all physical beds and clears empty-bed infusion', () => {
  const beds = [makeBed('01'), { ...makeBed('02'), isOccupied: false }];
  const data = { bedNum: '01床-02床', bedDeviceList: beds.map(bed => ({ ...bed, statusBarInfo: { status: '300' } })) };
  const result = buildDoorRuntimeData({ beds, doorStaff: { areaHeadNurseName: '合成护士' } }, data);
  assert.equal(result.bedDeviceList.length, 2);
  assert.equal(result.bedDeviceList[1].statusBarInfo, undefined);
  assert.equal(result.doorMainDoctorAndNurseVo.areaHeadNurseName, '合成护士');
});

test('snapshot freezes nested and shared swipers without modifying the cached document', () => {
  const input = makeTP4();
  input.pages[0].regions[0].widget = { id: 'swiper', kind: 'container.swiper', autoplayMs: 10, initialSlide: 1, children: [] };
  input.shared = { widgets: { nested: { id: 'nested', kind: 'container.swiper', autoplayMs: 20, initialSlide: 0 } } };
  const copy = createSnapshotDocument(input);
  assert.equal(copy.pages[0].regions[0].widget.autoplayMs, 0);
  assert.equal(copy.pages[0].regions[0].widget.initialSlide, 1);
  assert.equal(copy.shared.widgets.nested.autoplayMs, 0);
  assert.equal(input.pages[0].regions[0].widget.autoplayMs, 10);
});
