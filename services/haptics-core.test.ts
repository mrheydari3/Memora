import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAPTIC_PRESETS,
  createHapticsEngine,
  isHapticsAllowed,
  type AndroidHaptic,
  type HapticEvent,
  type HapticsDriver,
  type ImpactStyle,
  type NotificationType,
} from './haptics-core';

type Recorder = {
  driver: HapticsDriver;
  calls: string[];
};

/** A native-shaped driver: selection/impact/notification, no Android path. */
function nativeDriver(): Recorder {
  const calls: string[] = [];
  return {
    calls,
    driver: {
      selection: () => calls.push('selection'),
      impact: (style: ImpactStyle) => calls.push(`impact:${style}`),
      notification: (type: NotificationType) => calls.push(`notification:${type}`),
    },
  };
}

/** An Android-shaped driver: the semantic engine takes precedence. */
function androidDriver(): Recorder {
  const { driver, calls } = nativeDriver();
  return {
    calls,
    driver: {
      ...driver,
      android: (type: AndroidHaptic) => calls.push(`android:${type}`),
    },
  };
}

const EVENTS = Object.keys(HAPTIC_PRESETS) as HapticEvent[];

test('every semantic event has a preset', () => {
  assert.ok(EVENTS.length >= 24);
  for (const event of EVENTS) {
    const preset = HAPTIC_PRESETS[event];
    assert.ok(preset.web !== undefined, `${event} needs a web pattern`);
    assert.ok(preset.native !== undefined, `${event} needs a native plan`);
    assert.ok(preset.cooldown > 0, `${event} needs a cooldown`);
  }
});

test('native routing: selection, impacts and notifications are distinct', () => {
  const { driver, calls } = nativeDriver();
  const engine = createHapticsEngine({ driver });

  engine.play('selection');
  engine.play('light');
  engine.play('medium');
  engine.play('heavy');
  engine.play('success');
  engine.play('error');
  engine.play('warning');

  assert.deepEqual(calls, [
    'selection',
    'impact:light',
    'impact:medium',
    'impact:heavy',
    'notification:success',
    'notification:error',
    'notification:warning',
  ]);
});

test('the four review ratings have distinguishable native weights', () => {
  const { driver, calls } = nativeDriver();
  const engine = createHapticsEngine({ driver });

  engine.play('reviewAgain');
  engine.play('reviewHard');
  engine.play('reviewGood');
  engine.play('reviewEasy');

  assert.deepEqual(calls, ['impact:rigid', 'impact:soft', 'impact:light', 'impact:medium']);
});

test('toggle and navigation presets are light, never a heavy buzz', () => {
  const { driver, calls } = nativeDriver();
  let clock = 0;
  const engine = createHapticsEngine({ driver, now: () => clock });

  engine.play('toggleOn');
  engine.play('toggleOff');
  engine.play('navigation');
  clock += 100;
  engine.play('modalOpen');
  clock += 100;
  engine.play('modalClose');

  assert.deepEqual(calls, ['selection', 'selection', 'selection', 'impact:light', 'selection']);
});

test('Android prefers the semantic haptics engine', () => {
  const { driver, calls } = androidDriver();
  const engine = createHapticsEngine({ driver });

  engine.play('toggleOn');
  engine.play('success');
  engine.play('gameOver');
  engine.play('dragStart');

  assert.deepEqual(calls, ['android:Toggle_On', 'android:Confirm', 'android:Reject', 'android:Drag_Start']);
});

test('web uses the vibration patterns instead of native methods', () => {
  const calls: Array<number | number[]> = [];
  const engine = createHapticsEngine({
    driver: {
      vibrate: (pattern) => calls.push(pattern),
      selection: () => assert.fail('native selection must not run on web'),
    },
  });

  engine.play('selection');
  engine.play('success');

  assert.deepEqual(calls, [HAPTIC_PRESETS.selection.web, HAPTIC_PRESETS.success.web]);
});

test('the global preference gates dispatch, including the default-on legacy value', () => {
  assert.equal(isHapticsAllowed(undefined), true);
  assert.equal(isHapticsAllowed({}), true);
  assert.equal(isHapticsAllowed({ hapticsEnabled: true }), true);
  assert.equal(isHapticsAllowed({ hapticsEnabled: false }), false);

  const { driver, calls } = nativeDriver();
  let enabled = true;
  const engine = createHapticsEngine({ driver, isEnabled: () => enabled });

  assert.equal(engine.play('selection'), true);
  enabled = false;
  assert.equal(engine.play('selection'), false);
  enabled = true;
  // The cooldown still applies, so use a different event to prove it resumes.
  assert.equal(engine.play('success'), true);
  assert.deepEqual(calls, ['selection', 'notification:success']);
});

test('dedupe suppresses a repeated event inside its cooldown and allows it after', () => {
  const { driver, calls } = nativeDriver();
  let clock = 0;
  const engine = createHapticsEngine({ driver, now: () => clock });

  assert.equal(engine.play('navigation'), true);
  clock = 20;
  assert.equal(engine.play('navigation'), false, 'inside the 80ms navigation cooldown');
  clock = 81;
  assert.equal(engine.play('navigation'), true, 'after the cooldown');
  assert.deepEqual(calls, ['selection', 'selection']);
});

test('distinct events are not suppressed by each other', () => {
  const { driver, calls } = nativeDriver();
  let clock = 0;
  const engine = createHapticsEngine({ driver, now: () => clock });

  assert.equal(engine.play('selection'), true);
  assert.equal(engine.play('success'), true, 'a confirmation is meaningful on its own');
  clock = 5;
  assert.equal(engine.play('reviewGood'), true, 'a rating key may follow a tab tick');

  assert.equal(calls.length, 3);
});

test('a custom key dedupes siblings without silencing their own events', () => {
  const { driver, calls } = nativeDriver();
  let clock = 0;
  const engine = createHapticsEngine({ driver, now: () => clock });

  assert.equal(engine.play('selection', { key: 'tab:home' }), true);
  clock = 10;
  assert.equal(engine.play('selection', { key: 'tab:game' }), true);
  clock = 20;
  assert.equal(engine.play('selection', { key: 'tab:home' }), false);
  assert.deepEqual(calls, ['selection', 'selection']);
});

test('a rejected hardware promise never escapes the engine', async () => {
  const engine = createHapticsEngine({
    driver: {
      selection: () => Promise.reject(new Error('no taptic engine')),
      impact: () => Promise.reject(new Error('no vibrator')),
      notification: () => Promise.reject(new Error('low power mode')),
    },
  });

  assert.doesNotThrow(() => {
    engine.play('selection');
    engine.play('light');
    engine.play('success');
  });

  // Let the rejection handlers run; an unhandled rejection would fail the run.
  await new Promise((resolve) => setImmediate(resolve));
});

test('a synchronously throwing driver is swallowed', () => {
  const engine = createHapticsEngine({
    driver: {
      selection: () => {
        throw new Error('hardware absent');
      },
    },
  });

  assert.doesNotThrow(() => engine.play('selection'));
});

test('a menu arrival collapses into the tap that opened it', () => {
  const { driver, calls } = nativeDriver();
  let clock = 0;
  const engine = createHapticsEngine({ driver, now: () => clock });

  assert.equal(engine.play('selection'), true, 'the trigger ticks');
  clock = 10;
  assert.equal(engine.play('modalOpen'), false, 'the arrival would be a double buzz');
  clock = 61;
  assert.equal(engine.play('modalOpen'), true, 'a later open gets its own cue');
  clock = 70;
  assert.equal(engine.play('modalClose'), false, 'closing right after opening stays quiet');
  assert.deepEqual(calls, ['selection', 'impact:light']);
});

test('reset clears cooldowns for tests and re-armed flows', () => {
  const { driver, calls } = nativeDriver();
  let clock = 0;
  const engine = createHapticsEngine({ driver, now: () => clock });

  engine.play('selection');
  clock = 5;
  engine.reset();
  engine.play('selection');

  assert.deepEqual(calls, ['selection', 'selection']);
});
