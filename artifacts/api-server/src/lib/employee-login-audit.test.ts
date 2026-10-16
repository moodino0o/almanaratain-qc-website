import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeClientIpAddress,
  recordEmployeeLoginAttempt,
} from "./employee-activity";

test("normalizes valid client IPs and rejects forwarded-list strings", () => {
  assert.equal(normalizeClientIpAddress("203.0.113.7"), "203.0.113.7");
  assert.equal(
    normalizeClientIpAddress("::ffff:203.0.113.7"),
    "203.0.113.7",
  );
  assert.equal(
    normalizeClientIpAddress("203.0.113.7, 198.51.100.4"),
    "Unknown",
  );
  assert.equal(normalizeClientIpAddress(undefined), "Unknown");
});

test("login audit rows contain outcome and network metadata, never credentials", async () => {
  const insertedRows: Array<Record<string, unknown>> = [];
  const executor = {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return Promise.resolve();
      },
    }),
  } as never;

  await recordEmployeeLoginAttempt(
    {
      employeeId: "QC-104",
      employeeName: "Test Employee",
      ipAddress: "203.0.113.7",
      outcome: "failure",
    },
    executor,
  );

  assert.equal(insertedRows.length, 1);
  assert.equal(insertedRows[0].employeeId, "QC-104");
  const details = insertedRows[0].details as Record<string, unknown>;
  assert.deepEqual(details, {
    loginAttempt: true,
    outcome: "failure",
    ipAddress: "203.0.113.7",
    location: "Unavailable",
  });
  assert.equal(JSON.stringify(insertedRows).toLowerCase().includes("password"), false);
});