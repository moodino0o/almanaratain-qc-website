import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReportFormula } from "./report-template-formulas";

test("evaluates arithmetic with field references and precedence", () => {
  const result = evaluateReportFormula(
    "=({{details.amountPassing}} / {{details.totalAmount}}) * 100",
    (key) => key === "details.amountPassing" ? "850 g" : "1000",
  );
  assert.equal(result, 85);
});

test("evaluates the supported aggregate and rounding functions", () => {
  assert.equal(evaluateReportFormula("=ROUND(AVERAGE(10, 12, 14), 1)", () => null), 12);
  assert.equal(evaluateReportFormula("=SUM(2, 3, ABS(-4))", () => null), 9);
});

test("rejects unknown functions, nonnumeric fields, and division by zero", () => {
  assert.throws(() => evaluateReportFormula("=GLOBAL(1)", () => null), /Unsupported function/);
  assert.throws(() => evaluateReportFormula("={{details.remark}} + 1", () => "sand"), /not numeric/);
  assert.throws(() => evaluateReportFormula("=10 / 0", () => null), /Division by zero/);
});