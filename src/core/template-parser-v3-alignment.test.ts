import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseTemplateInfo } from './template/parser.ts';
import {
  buildBedTemplateData,
  resolveNodeText,
} from './template/data-mapper.ts';

function createBed() {
  return {
    bedCode: '90101',
    bedName: '01',
    deviceCode: 'SN1001',
    position: { x: 0, z: 0 },
    isOccupied: true,
    isOnline: true,
    sickInfo: {
      bedCode: '90101',
      bedName: '01',
      sickName: '床头患者',
      sickSex: '男',
      sickAge: '68',
      sickBirthday: '',
      sickNo: 'A-1',
      sickInTime: '2026-08-01 10:20',
      nursingLevel: '一级护理',
      nursingColor: '#ff0000',
      sickAllergy: '',
      sickIsolation: '',
      sickDiet: '',
      sickSafetyPrecautions: '',
      visitDoctorName: '',
      visitDoctorUserDuty: '',
      visitDoctorUserProfessional: '',
      dutyNurseName: '',
      dutyNurseUserProfessional: '',
      visitDoctorUserRemark: '',
      dutyNurseUserRemark: '',
      visitDoctorUserPic: '',
      dutyNurseUserPic: '',
      areaHeadNurseName: '',
      areaHeadNurseUserPic: '',
    },
  };
}

test('rejects old ParserV3 templates', () => {
  assert.throws(
    () => parseTemplateInfo({
      id: 1,
      analyzeType: '1',
      templateContent: JSON.stringify({
        width: 1024,
        height: 600,
        isNew: false,
        data: [{ type: 'text', left: 10, top: 10, width: 100, height: 30 }],
      }),
    }),
    /暂不支持旧模板/,
  );
});

test('normalizes root pixel coordinates and resolves comma-separated bed paths', () => {
  const parsed = parseTemplateInfo({
    id: 1,
    analyzeType: '1',
    templateContent: JSON.stringify({
      width: 1000,
      height: 500,
      isNew: true,
      data: [{
        id: 'card ',
        type: 'element',
        left: 100,
        top: 50,
        width: 400,
        height: 200,
        children: [{
          id: 'name',
          type: 'text',
          left: 10,
          top: 10,
          width: 50,
          height: 20,
          key: 'bedSickInfoVo,sickName',
        }],
      }],
    }),
  });

  assert.equal(parsed.nodes[0].id, 'card');
  assert.equal(parsed.nodes[0].left, '10.000');
  assert.equal(parsed.nodes[0].top, '10.000');
  const child = Array.isArray(parsed.nodes[0].children)
    ? parsed.nodes[0].children[0]
    : undefined;
  assert.equal(resolveNodeText(child as { key?: string }, buildBedTemplateData(createBed())), '床头患者');
});

test('keeps interactive nodes in the parsed AST for non-bed renderers', () => {
  const parsed = parseTemplateInfo({
    id: 1,
    analyzeType: '1',
    templateContent: JSON.stringify({
      width: 100,
      height: 100,
      isNew: true,
      data: [{
        id: 'button1',
        class: 'button',
        type: 'element',
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      }],
    }),
  });

  assert.equal(parsed.nodes[0].id, 'button1');
});

test('repairs over-escaped inline svg metadata from legacy mock templates', () => {
  const raw = JSON.parse(
    readFileSync(new URL('../mock/bed-template-default.json', import.meta.url), 'utf8'),
  ).templateContent as string;
  const parsed = parseTemplateInfo({
    id: 1,
    analyzeType: '1',
    templateContent: raw,
  });
  assert.ok(parsed.nodes.length > 0);
  assert.ok(parsed.nodes.some(node => node.id === 'qrcode'));
});
