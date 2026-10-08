import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const routeSource = readFileSync(
  fileURLToPath(new URL("./qc.ts", import.meta.url)),
  "utf8",
);

function routeDefinition(method: string, path: string) {
  const marker = `router.${method}("${path}"`;
  const start = routeSource.indexOf(marker);
  assert.notEqual(start, -1, `Expected to find ${method.toUpperCase()} ${path}`);
  const nextRoute = routeSource.indexOf("\nrouter.", start + marker.length);
  return routeSource.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

for (const path of ["/records", "/records/:id", "/reports/:id"]) {
  test(`GET ${path} does not refresh evaluations for every record`, () => {
    assert.doesNotMatch(
      routeDefinition("get", path),
      /\brefreshRecordEvaluations\s*\(/,
    );
  });
}

test("standard refreshes write saved evaluations in batches", () => {
  const start = routeSource.indexOf("async function refreshRecordEvaluations(");
  assert.notEqual(start, -1, "Expected the evaluation refresh helper");
  const end = routeSource.indexOf("\nfunction detailsValue(", start);
  assert.notEqual(end, -1, "Expected the end of the evaluation refresh helper");
  const refresh = routeSource.slice(start, end);

  assert.match(refresh, /const batchSize = 250/);
  assert.match(refresh, /await db\.execute\(sql`/);
  assert.match(refresh, /UPDATE qc_records AS qc_record/);
  assert.match(refresh, /updated_at = NOW\(\)/);
  assert.doesNotMatch(refresh, /await db\.update\(qcRecordsTable\)/);
});

test("lookups avoid loading the full reference-data payload", () => {
  const route = routeDefinition("get", "/lookups");
  assert.match(route, /listLookupValues\(\)/);
  assert.match(route, /setHeader\("Cache-Control", "no-store"\)/);
  assert.doesNotMatch(route, /listReferenceData\(\)/);

  const start = routeSource.indexOf("async function listLookupValues()");
  const end = routeSource.indexOf("\nasync function getReferenceCategory", start);
  assert.notEqual(start, -1, "Expected the focused lookup query");
  assert.notEqual(end, -1, "Expected the end of the focused lookup query");
  const query = routeSource.slice(start, end);
  assert.match(query, /\.select\(\{\s*categoryKey:/);
  assert.match(query, /\.innerJoin\(/);
  assert.match(query, /\.where\(inArray\(qcReferenceCategoriesTable\.key/);
});

test("reference and shape-factor reads reuse safe initialization", () => {
  const referenceRoute = routeDefinition("get", "/reference-data");
  const shapeFactorRoute = routeDefinition("get", "/shape-factors");
  assert.match(referenceRoute, /listReferenceData\(\)/);
  assert.match(referenceRoute, /setHeader\("Cache-Control", "no-store"\)/);
  assert.match(shapeFactorRoute, /setHeader\("Cache-Control", "no-store"\)/);
  assert.match(shapeFactorRoute, /ensureDefaultShapeFactors\(\)/);
  assert.match(routeSource, /shapeFactorInitializer\.ensure\(\)/);
  assert.match(routeSource, /reportLayoutInitializer\.ensure\(\)/);
  assert.match(routeSource, /if \(!backfillNullShapeFactorDefaults\) continue/);
});
