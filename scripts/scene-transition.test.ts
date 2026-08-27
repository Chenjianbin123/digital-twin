import assert from 'node:assert/strict';
import {
  resolveAreaPhaseTransition,
  resolveSceneSwitchFeedback,
} from '../src/core/scene-transition.ts';

assert.deepEqual(
  resolveAreaPhaseTransition('station', 'corridor'),
  { animate: true, direction: 'enter-corridor' },
);

assert.deepEqual(
  resolveAreaPhaseTransition('corridor', 'station'),
  { animate: true, direction: 'return-station' },
);

assert.deepEqual(
  resolveAreaPhaseTransition('corridor', 'corridor'),
  { animate: false, direction: 'none' },
);

assert.equal(resolveSceneSwitchFeedback('nurse-station', 'ward')?.title, '进入病房走廊');
assert.equal(resolveSceneSwitchFeedback('ward', 'nurse-station')?.title, '返回护士站');
assert.equal(resolveSceneSwitchFeedback('ward', 'ward-interior')?.title, '进入病房内');
assert.equal(resolveSceneSwitchFeedback('ward', 'ward'), null);
