export type FormulaResolver = (fieldKey: string) => unknown;

type Token =
  | { kind: "number"; value: number }
  | { kind: "field"; value: string }
  | { kind: "name"; value: string }
  | { kind: "operator"; value: string }
  | { kind: "punctuation"; value: "(" | ")" | "," };

const supportedFunctions = new Set(["SUM", "AVERAGE", "MIN", "MAX", "ROUND", "ABS"]);

function numericFieldValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().replace(/,/g, "").match(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    const remaining = source.slice(index);
    const field = remaining.match(/^\{\{([A-Za-z_][A-Za-z0-9_.]*)\}\}/);
    if (field) {
      tokens.push({ kind: "field", value: field[1] });
      index += field[0].length;
      continue;
    }
    const number = remaining.match(/^(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i);
    if (number) {
      tokens.push({ kind: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const name = remaining.match(/^[A-Za-z]+/);
    if (name) {
      const normalized = name[0].toUpperCase();
      if (!supportedFunctions.has(normalized)) throw new Error(`Unsupported function: ${name[0]}`);
      tokens.push({ kind: "name", value: normalized });
      index += name[0].length;
      continue;
    }
    const character = source[index];
    if ("+-*/%".includes(character)) {
      tokens.push({ kind: "operator", value: character });
      index += 1;
      continue;
    }
    if (character === "(" || character === ")" || character === ",") {
      tokens.push({ kind: "punctuation", value: character });
      index += 1;
      continue;
    }
    throw new Error(`Invalid formula character: ${character}`);
  }
  return tokens;
}

class FormulaParser {
  private position = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly resolve: FormulaResolver,
  ) {}

  parse() {
    const result = this.expression();
    if (this.position !== this.tokens.length) throw new Error("Unexpected formula input.");
    if (!Number.isFinite(result)) throw new Error("Formula result is not finite.");
    return result;
  }

  private peek() {
    return this.tokens[this.position];
  }

  private take() {
    return this.tokens[this.position++];
  }

  private expression(minimumPrecedence = 0): number {
    let left = this.primary();
    while (this.peek()?.kind === "operator") {
      const operator = this.peek() as Extract<Token, { kind: "operator" }>;
      const precedence = operator.value === "+" || operator.value === "-" ? 1 : 2;
      if (precedence < minimumPrecedence) break;
      this.take();
      const right = this.expression(precedence + 1);
      if (operator.value === "+") left += right;
      else if (operator.value === "-") left -= right;
      else if (operator.value === "*") left *= right;
      else if (operator.value === "/") {
        if (right === 0) throw new Error("Division by zero.");
        left /= right;
      } else {
        if (right === 0) throw new Error("Division by zero.");
        left %= right;
      }
    }
    return left;
  }

  private primary(): number {
    const token = this.take();
    if (!token) throw new Error("Formula ended unexpectedly.");
    if (token.kind === "number") return token.value;
    if (token.kind === "field") {
      const value = numericFieldValue(this.resolve(token.value));
      if (value === null) throw new Error(`Field ${token.value} is not numeric.`);
      return value;
    }
    if (token.kind === "operator" && (token.value === "+" || token.value === "-")) {
      const value = this.primary();
      return token.value === "-" ? -value : value;
    }
    if (token.kind === "punctuation" && token.value === "(") {
      const value = this.expression();
      const closing = this.take();
      if (closing?.kind !== "punctuation" || closing.value !== ")") {
        throw new Error("Formula is missing a closing parenthesis.");
      }
      return value;
    }
    if (token.kind === "name") return this.call(token.value);
    throw new Error("Expected a number, field, or function.");
  }

  private call(name: string) {
    const opening = this.take();
    if (opening?.kind !== "punctuation" || opening.value !== "(") {
      throw new Error(`${name} must be followed by parentheses.`);
    }
    const args: number[] = [];
    if (this.peek()?.kind !== "punctuation" || this.peek()?.value !== ")") {
      while (true) {
        args.push(this.expression());
        if (this.peek()?.kind !== "punctuation" || this.peek()?.value !== ",") break;
        this.take();
      }
    }
    const closing = this.take();
    if (closing?.kind !== "punctuation" || closing.value !== ")") {
      throw new Error(`${name} is missing a closing parenthesis.`);
    }
    if (!args.length) throw new Error(`${name} requires at least one value.`);
    switch (name) {
      case "SUM": return args.reduce((total, value) => total + value, 0);
      case "AVERAGE": return args.reduce((total, value) => total + value, 0) / args.length;
      case "MIN": return Math.min(...args);
      case "MAX": return Math.max(...args);
      case "ROUND": {
        if (args.length > 2) throw new Error("ROUND accepts one or two values.");
        const precision = args[1] ?? 0;
        const factor = 10 ** precision;
        return Math.round((args[0] + Number.EPSILON) * factor) / factor;
      }
      case "ABS":
        if (args.length !== 1) throw new Error("ABS accepts one value.");
        return Math.abs(args[0]);
      default:
        throw new Error(`Unsupported function: ${name}`);
    }
  }
}

export function evaluateReportFormula(formula: string, resolve: FormulaResolver) {
  const source = formula.trim().replace(/^=/, "");
  if (!source) throw new Error("Formula is empty.");
  return new FormulaParser(tokenize(source), resolve).parse();
}
