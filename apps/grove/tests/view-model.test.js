import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupViews } from '../ui/assets/view-model.js';

test('groups follow the fixed order and omit empty groups', () => {
  const groups = groupViews([
    { id: 'task-manager', status: 'planned' },
    { id: 'session-stats', status: 'on' },
    { id: 'token-stats', status: 'off' },
  ]);

  assert.deepEqual(
    groups.map((group) => group.key),
    ['on', 'off', 'planned'],
  );
  assert.deepEqual(groups[0].views, [{ id: 'session-stats', status: 'on' }]);
  assert.deepEqual(groups[1].views, [{ id: 'token-stats', status: 'off' }]);
  assert.deepEqual(groups[2].views, [{ id: 'task-manager', status: 'planned' }]);

  const allFour = groupViews([
    { id: 'd', status: 'failed' },
    { id: 'c', status: 'planned' },
    { id: 'a', status: 'on' },
    { id: 'b', status: 'off' },
  ]);
  assert.deepEqual(
    allFour.map((group) => group.key),
    ['on', 'off', 'attention', 'planned'],
  );

  assert.deepEqual(groupViews([]), []);
});

test('starting and stopping stay in the enabled group', () => {
  const groups = groupViews([
    { id: 'a', status: 'stopping' },
    { id: 'b', status: 'starting' },
    { id: 'c', status: 'on' },
  ]);

  assert.deepEqual(groups, [
    {
      key: 'on',
      views: [
        { id: 'a', status: 'stopping' },
        { id: 'b', status: 'starting' },
        { id: 'c', status: 'on' },
      ],
    },
  ]);
});

test('failed and blocked go to attention', () => {
  const groups = groupViews([
    { id: 'a', status: 'blocked' },
    { id: 'b', status: 'failed', error: { code: 'ACTIVATION_FAILED', message: 'boom' } },
  ]);

  assert.deepEqual(groups.map((group) => group.key), ['attention']);
  assert.deepEqual(groups[0].views, [
    { id: 'a', status: 'blocked' },
    { id: 'b', status: 'failed', error: { code: 'ACTIVATION_FAILED', message: 'boom' } },
  ]);
});

test('planned only → single planned group', () => {
  const groups = groupViews([
    { id: 'session-stats', status: 'planned' },
    { id: 'token-stats', status: 'planned' },
  ]);

  assert.deepEqual(groups, [
    {
      key: 'planned',
      views: [
        { id: 'session-stats', status: 'planned' },
        { id: 'token-stats', status: 'planned' },
      ],
    },
  ]);
});
