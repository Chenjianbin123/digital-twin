import type { TemplateNode } from '../../types/template.ts';

/** 对齐主项目 EMPTY_TOKEN，Canvas 渲染用 */
const EMPTY_BED_TEMPLATES: Record<'bed1' | 'bed2' | 'bed3', TemplateNode> = {
  bed1: {
    width: '100',
    height: '32',
    background: 'rgba(255,255,255,0.9)',
    type: 'parentObject',
    id: 'emptyBed1',
    borderRadius: '0.5rem',
    children: [
      {
        id: 'bedName',
        type: 'element',
        left: '2',
        top: '7',
        width: '25',
        height: '87',
        background: '#ffffff',
        color: '#666666',
        fontSize: 1.8,
        fontWeight: 'bold',
        key: 'bedDeviceList,bedName',
        justifyContent: 'center',
        alignItems: 'center',
      },
      {
        id: 'sickName',
        type: 'element',
        left: '31',
        top: '29',
        width: '33',
        height: '38',
        color: '#666666',
        fontSize: 1.6,
        text: '空床',
        justifyContent: 'center',
        alignItems: 'center',
      },
    ],
  },
  bed2: {
    width: '100',
    height: '24',
    background: 'rgba(255,255,255,0.9)',
    type: 'parentObject',
    id: 'emptyBed2',
    borderRadius: '0.5rem',
    children: [
      {
        id: 'bedName',
        type: 'element',
        left: '2',
        top: '9',
        width: '22',
        height: '81',
        background: '#ffffff',
        color: '#666666',
        fontSize: 1.5,
        fontWeight: 'bold',
        key: 'bedDeviceList,bedName',
        justifyContent: 'center',
        alignItems: 'center',
      },
      {
        id: 'sickName',
        type: 'element',
        left: '30',
        top: '24',
        width: '32',
        height: '50',
        color: '#666666',
        fontSize: 1.6,
        text: '空床',
        justifyContent: 'center',
        alignItems: 'center',
      },
    ],
  },
  bed3: {
    width: '48',
    height: '30',
    background: 'rgba(255,255,255,0.9)',
    type: 'parentObject',
    id: 'emptyBed3',
    borderRadius: '0.5rem',
    children: [
      {
        id: 'bedName',
        type: 'element',
        left: '4',
        top: '7',
        width: '46',
        height: '52',
        background: '#ffffff',
        color: '#666666',
        fontSize: 1.5,
        fontWeight: 'bold',
        key: 'bedDeviceList,bedName',
        justifyContent: 'center',
        alignItems: 'center',
      },
      {
        id: 'sickName',
        type: 'element',
        left: '22',
        top: '63',
        width: '55',
        height: '31',
        color: '#666666',
        fontSize: 1.2,
        text: '空床',
        justifyContent: 'center',
        alignItems: 'center',
      },
    ],
  },
};

export function getEmptyBedTemplate(slot: 'bed1' | 'bed2' | 'bed3'): TemplateNode {
  return JSON.parse(JSON.stringify(EMPTY_BED_TEMPLATES[slot]));
}

export function pickBedLayoutKey(bedCount: number): 'bed1' | 'bed2' | 'bed3' {
  if (bedCount <= 3)
    return 'bed1';
  if (bedCount === 4)
    return 'bed2';
  return 'bed3';
}

export function pickEmptyBedKey(layoutKey: 'bed1' | 'bed2' | 'bed3'): string {
  return `emptyBed${layoutKey.slice(-1)}`;
}
