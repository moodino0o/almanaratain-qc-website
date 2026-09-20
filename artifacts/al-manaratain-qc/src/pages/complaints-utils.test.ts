import test from "node:test";
import assert from "node:assert/strict";
import { complaintCategory } from "./complaints-utils";

test("classifies OPC and SRC materials as Ready Mix", () => {
  assert.equal(complaintCategory("35N OPC"), "Ready Mix");
  assert.equal(complaintCategory("45N SRC"), "Ready Mix");
});

test("classifies inch-sized materials as Block", () => {
  assert.equal(complaintCategory('8" PLAIN'), "Block");
  assert.equal(complaintCategory("6 inch lined blocks"), "Block");
  assert.equal(complaintCategory("4″ block"), "Block");
});

test("classifies 60mm and 80mm materials as Paving", () => {
  assert.equal(complaintCategory("SEBAGO 60MM BUFF EDGE"), "Paving");
  assert.equal(complaintCategory("80 mm Grey"), "Paving");
  assert.equal(complaintCategory("Buff paving edge"), "Paving");
});

test("classifies materials containing sand as Sand", () => {
  assert.equal(complaintCategory("Double Washed Sand"), "Sand");
  assert.equal(complaintCategory("Fine SAND"), "Sand");
});

test("leaves unmatched materials as Other", () => {
  assert.equal(complaintCategory("Crusher Dust"), "Other");
});