import assert from 'node:assert/strict';
import { preloadDoorTemplates } from '../src/core/door-template-preload.ts';

const events: string[] = [];
const devices = [
  { doorDeviceInfo: { deviceCode: 'DOOR-01', templateId: 796 } },
  { doorDeviceInfo: { deviceCode: 'DOOR-02', templateId: 796 } },
  { doorDeviceInfo: { deviceCode: 'DOOR-03', templateId: 797 } },
];

events.push('details-ready');
const result = await preloadDoorTemplates(devices, async (templateId) => {
  events.push(`template:${templateId}`);
});

assert.deepEqual(result.templateIds, [796, 797]);
assert.deepEqual(result.warnings, []);
assert.deepEqual(events, ['details-ready', 'template:796', 'template:797']);

const partial = await preloadDoorTemplates([
  { doorDeviceInfo: { deviceCode: 'DOOR-04', templateId: 0 } },
  { doorDeviceInfo: { deviceCode: 'DOOR-05', templateId: 798 } },
], async () => {
  throw new Error('模板接口不可用');
});

assert.deepEqual(partial.templateIds, []);
assert.match(partial.warnings.join('\n'), /DOOR-04.*未配置模板/);
assert.match(partial.warnings.join('\n'), /798.*模板接口不可用/);
