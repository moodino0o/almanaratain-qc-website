import assert from "node:assert/strict";
import test from "node:test";
import { createInvalidatableInitializer } from "./async-initializer";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("shares concurrent initialization and skips completed work", async () => {
  let runs = 0;
  const initializer = createInvalidatableInitializer(async () => {
    runs += 1;
    await Promise.resolve();
  });

  await Promise.all([initializer.ensure(), initializer.ensure()]);
  await initializer.ensure();

  assert.equal(runs, 1);
});

test("retries after invalidation, including invalidation during a run", async () => {
  const firstRun = deferred();
  let runs = 0;
  const initializer = createInvalidatableInitializer(async () => {
    runs += 1;
    if (runs === 1) await firstRun.promise;
  });

  const initialEnsure = initializer.ensure();
  initializer.invalidate();
  firstRun.resolve();
  await initialEnsure;
  await initializer.ensure();

  assert.equal(runs, 2);
});

test("retries initialization after a failure", async () => {
  let runs = 0;
  const initializer = createInvalidatableInitializer(async () => {
    runs += 1;
    if (runs === 1) throw new Error("temporary failure");
  });

  await assert.rejects(initializer.ensure(), /temporary failure/);
  await initializer.ensure();

  assert.equal(runs, 2);
});
