import assert from "node:assert/strict";
import test from "node:test";
import { initializeApiBeforeListen } from "./api-startup";

test("waits for the strength-standard backfill before listening", async () => {
  const calls: string[] = [];
  let finishStrengthBackfill: (() => void) | undefined;
  let serverStarted = false;

  const initialization = initializeApiBeforeListen({
    ensureEmployeeDirectorySeed: async () => {
      calls.push("employee-directory");
    },
    ensureReferenceData: async () => {
      calls.push("reference-data");
    },
    ensureDefaultStrengthStandards: () => {
      calls.push("strength-backfill-start");
      return new Promise<void>((resolve) => {
        finishStrengthBackfill = () => {
          calls.push("strength-backfill-complete");
          resolve();
        };
      });
    },
    startServer: () => {
      calls.push("listen");
      serverStarted = true;
    },
  });

  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(calls, [
    "employee-directory",
    "reference-data",
    "strength-backfill-start",
  ]);
  assert.equal(serverStarted, false);

  finishStrengthBackfill?.();
  await initialization;

  assert.deepEqual(calls, [
    "employee-directory",
    "reference-data",
    "strength-backfill-start",
    "strength-backfill-complete",
    "listen",
  ]);
  assert.equal(serverStarted, true);
});

test("does not listen when the strength-standard backfill fails", async () => {
  let serverStarted = false;

  await assert.rejects(
    initializeApiBeforeListen({
      ensureEmployeeDirectorySeed: async () => {},
      ensureReferenceData: async () => {},
      ensureDefaultStrengthStandards: async () => {
        throw new Error("strength backfill failed");
      },
      startServer: () => {
        serverStarted = true;
      },
    }),
    /strength backfill failed/,
  );

  assert.equal(serverStarted, false);
});
