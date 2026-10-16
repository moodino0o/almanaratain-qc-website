/**
 * Standalone, editable PowerPoint generator for the QC management presentation.
 * Run: pnpm --filter @workspace/scripts run generate:qc-presentation
 * Presentation-only: never connects to, writes to, or changes the QC application.
 */
import type Pptx from "pptxgenjs";
import { createRequire } from "node:module";
import { mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".local/outputs/Al-Manaratain-QC-Application-Management-Presentation.pptx");
const texture = path.join(root, "presentation-assets/qc-material-texture.png");
const liveUrl = "https://al-manaratain-qc-system.replit.app";
const C = { navy: "0A1628", gold: "B8A58A", bg: "FBFCFE", muted: "4A5568", line: "E2E8F0", soft: "F7FAFC" };
// PptxGenJS's ESM entry is not consistently unwrapped by tsx on Node 24.
// Use its documented CommonJS export while retaining the package's TypeScript types.
const PptxGenJS = createRequire(import.meta.url)("pptxgenjs") as typeof Pptx;
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Al Manaratain";
pptx.company = "Al Manaratain";
pptx.subject = "Quality Control Testing & Reporting Web Application";
pptx.title = "Al Manaratain Quality Control — Digital Testing & Reporting Application";
pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };

type Slide = ReturnType<Pptx["addSlide"]>;
type Column = { label: string; title: string; lines: string[] };
type Page = { section: string; title: string; columns: Column[]; note?: string; dark?: boolean; flow?: string[] };

function text(s: Slide, value: string, x: number, y: number, w: number, h: number, size = 20, color = C.navy, bold = false) {
  s.addText(value, { x, y, w, h, fontFace: "Arial", fontSize: size, color, bold, margin: 0, valign: "top", breakLine: false });
}
function rect(s: Slide, x: number, y: number, w: number, h: number, fill: string, line = C.line) {
  s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: fill }, line: { color: line, width: 0.8 } });
}
function frame(s: Slide, page: number, section: string, title: string, dark = false) {
  const fg = dark ? "FFFFFF" : C.navy;
  s.background = { color: dark ? C.navy : C.bg };
  text(s, "AL MANARATAIN", 0.55, 0.30, 4.5, 0.24, 13, fg, true);
  text(s, `${section.toUpperCase()} / ${String(page).padStart(2, "0")} / 25`, 7.0, 0.30, 5.75, 0.25, 11, dark ? "CBD5E1" : C.muted);
  text(s, title, 0.55, 0.90, 12.2, 0.90, 30, fg, true);
  s.addShape(pptx.ShapeType.line, { x: 0.55, y: 6.98, w: 12.2, h: 0, line: { color: dark ? "67778D" : C.line, width: 0.8 } });
  text(s, "AL MANARATAIN / QUALITY & CONTROL", 0.55, 7.12, 10.5, 0.20, 10, dark ? "CBD5E1" : C.muted);
  text(s, String(page).padStart(2, "0"), 12.25, 7.09, 0.5, 0.25, 12, fg, true);
}
function flow(s: Slide, values: string[], y: number, dark = false) {
  const gap = 0.28;
  const w = (12.2 - gap * (values.length - 1)) / values.length;
  values.forEach((value, index) => {
    const x = 0.55 + index * (w + gap);
    rect(s, x, y, w, 0.70, dark ? C.navy : C.soft, dark ? "67778D" : C.line);
    text(s, value, x + 0.10, y + 0.17, w - 0.20, 0.38, 16, dark ? "FFFFFF" : C.navy, true);
    if (index < values.length - 1) text(s, "→", x + w + 0.03, y + 0.21, gap - 0.04, 0.30, 17, C.gold, true);
  });
}
function columns(s: Slide, data: Column[], dark = false, hasFlow = false) {
  const gap = 0.20;
  const w = (12.2 - gap * (data.length - 1)) / data.length;
  const top = 1.90;
  const height = hasFlow ? 3.60 : 4.40;
  data.forEach((col, index) => {
    const x = 0.55 + index * (w + gap);
    rect(s, x, top, w, height, dark ? C.navy : index % 2 === 1 ? C.soft : "FFFFFF", dark ? "67778D" : C.line);
    text(s, col.label.toUpperCase(), x + 0.18, top + 0.18, w - 0.36, 0.30, 11, dark ? "CBD5E1" : C.muted);
    text(s, col.title, x + 0.18, top + 0.62, w - 0.36, 0.70, data.length > 3 ? 21 : 24, dark ? "FFFFFF" : C.navy, true);
    const rowH = (height - 1.60) / Math.max(col.lines.length, 1);
    col.lines.forEach((line, n) => {
      text(s, line, x + 0.18, top + 1.50 + n * rowH, w - 0.36, rowH - 0.10, data.length > 3 ? 16 : data.length > 2 ? 18 : 19, dark ? "E2E8F0" : C.muted);
    });
  });
}

// These are illustrative input values, not a measured sample or acceptance limit.
// Equations copied from the app's current calculateDammamBlockResults implementation.
const example = { length: 400, width: 200, face: 30, web: 30, holes: 3, load: 200 };
const holeWidth = (example.width - 2 * example.face - (example.holes - 1) * example.web) / example.holes;
const holeLength = (example.length - 2 * example.face - (example.holes - 1) * example.web) / example.holes;
const grossArea = example.width * example.length;
const netArea = grossArea - example.holes * holeWidth * holeLength;
const grossStrength = example.load * 1000 / grossArea;
const netStrength = example.load * 1000 / netArea;

const pages: Page[] = [
  { section: "Executive summary", title: "A digital path from test data to QC reporting", columns: [
    { label: "Capture", title: "Structured records", lines: ["Test type, sample details, plant and material.", "Test-specific measurements stored together."] },
    { label: "Calculate", title: "Application rules", lines: ["Derived test results and configurable criteria.", "Plant-specific calculation branches."] },
    { label: "Report", title: "Consistent outputs", lines: ["Print-ready report views.", "Daily results spreadsheet and historical lookup."] },
  ], note: "Designed to reduce repeated calculation and report preparation; measured savings have not been established." },
  { section: "Operating context", title: "The operational problem it targets", columns: [
    { label: "Manual-process risks", title: "Where friction can occur", lines: ["Repeated entry across forms and spreadsheets.", "Formula and formatting differences.", "Manual report assembly; scattered historical files."] },
    { label: "Digital capabilities", title: "What the app centralizes", lines: ["Structured records and calculations.", "Consistent report views and configurable standards.", "Stored history, reference data and document archive."] },
  ], note: "Design goals, not quantified before-and-after results.", flow: ["MANUAL HANDLING", "STRUCTURED QC", "REPORT OUTPUT"] },
  { section: "Product overview", title: "What the application does", columns: [
    { label: "01", title: "Employee", lines: ["Active employee login."] }, { label: "02", title: "QC record", lines: ["Test type and sample information."] },
    { label: "03", title: "Assessment", lines: ["Validation, calculations and applicable criteria."] }, { label: "04", title: "Report", lines: ["Review, print or spreadsheet export."] },
  ], note: "Current scope also includes dashboards, complaints, archive, reference data and employee access." },
  { section: "Workflow", title: "A repeatable workflow from sample to report", columns: [
    { label: "Capture", title: "Record the context", lines: ["01  Select the QC test type.", "02  Enter date, location and material.", "03  Add specimen data and measurements."] },
    { label: "Assess", title: "Check and calculate", lines: ["04  Validate entered values.", "05  Calculate derived results.", "06  Apply relevant configured criteria."] },
    { label: "Review and report", title: "Close the record", lines: ["07  Review calculated results.", "08  Record tester / reviewer information.", "09  Print or export the report."] },
  ], flow: ["SAMPLE", "MEASURE", "ASSESS", "REPORT"] },
  { section: "Data entry", title: "Structured inputs, tailored to each test", columns: [
    { label: "Record header", title: "Shared context", lines: ["Record number, test type, sample date.", "Location, material, status, tester, reviewer and remarks."] },
    { label: "Specimen", title: "Dimensions and load", lines: ["Length, width, height, failure load.", "Wet / dry weight; Dammam face and web thickness."] },
    { label: "Materials", title: "Test-specific values", lines: ["Sieve sizes and retained amounts.", "Moisture, silt, chloride, sulphate and water-related fields."] },
  ], note: "Inputs differ by test workflow; no field is assumed to exist in every test." },
  { section: "Calculations", title: "Calculations use the selected test workflow", columns: [
    { label: "Cube / Block basis", title: "Load-derived strength", lines: ["Load (kN) × 1,000 ÷ [Length × Width]", "Result in N/mm², with dimensions in mm."] },
    { label: "Paving", title: "Splitting strength", lines: ["0.637 × Load × 1,000 ÷ [Length × Height]", "Apply the size correction factor when available."] },
    { label: "Water absorption", title: "Percentage change", lines: ["(Wet − Dry) ÷ Dry × 100", "Incomplete / invalid inputs remain blank."] },
  ], note: "Block air-dry factor: 1.2 outside Dammam, 1.0 at Dammam. Optional normalized strength uses the configured shape factor. Rounding is field-specific." },
  { section: "Dammam Block logic", title: "Dammam: gross area and net area", columns: [
    { label: "Implemented model", title: "Void area is deducted", lines: ["Gross Area = Width × Length", "Hole W = [W − 2F − (n − 1)Web] ÷ n", "Hole L = [L − 2F − (n − 1)Web] ÷ n", "Net Area = Gross Area − n × Hole W × Hole L"] },
    { label: "Geometry configuration", title: "App defaults", lines: ["100 / 150 mm width → 2 holes; 200 mm → 3 holes.", "Face default: 30 mm.", "Web: 25 mm at 100/150 mm width; otherwise 30 mm.", "Thickness defaults are editable."] },
  ], note: "Implemented calculation model. Confirm it against approved block geometry / standards before acceptance decisions." },
  { section: "Dammam Block logic", title: "Dammam: strength on gross and net basis", columns: [
    { label: "Area basis", title: "Same load, different area", lines: ["Gross Strength = Load × 1,000 ÷ Gross Area", "Net Strength = Load × 1,000 ÷ Net Area", "The net-area strength is higher for the same load."] },
    { label: "Illustrative only", title: "Example from actual equations", lines: ["8-inch selection: 400 × 200 mm; 3 holes; face / web 30 mm; load 200 kN.", `Gross Area = ${grossArea.toLocaleString("en-GB")} mm²; Net Area ≈ ${netArea.toFixed(2)} mm².`, `Gross Strength = ${grossStrength.toFixed(2)} N/mm²; Net Strength ≈ ${netStrength.toFixed(2)} N/mm².`] },
  ], note: "Mathematical illustration, not a tested sample, standard or acceptance result." },
  { section: "Reporting", title: "Results move into a report-ready view", columns: [
    { label: "Report content", title: "Test-specific result view", lines: ["Sample / record context and measurements.", "Calculated results and applicable criteria.", "Dammam Block reports use the net-area basis."] },
    { label: "Available outputs", title: "Review and share", lines: ["Test-specific printable reports.", "Browser print flow; Print to PDF where available.", "Daily QC results spreadsheet (.xlsx).", "Configurable report layouts and templates."] },
  ], note: "Authenticated report screenshots were unavailable. Diagrams and report illustrations are not captured app screens." },
  { section: "Plant logic", title: "Plant-specific rules stay scoped to their workflow", columns: [
    { label: "Hidd", title: "Existing Block workflow", lines: ["Existing non-Dammam air-dry basis and configured standards."] },
    { label: "Khamis", title: "Existing Block workflow", lines: ["Dammam area deductions do not change this plant's behavior."] },
    { label: "Dammam", title: "Net / gross basis", lines: ["Face and web thickness; configured holes; net area and net strength."] },
  ], flow: ["LOCATION", "SCOPED RULE", "RELEVANT RESULT"] },
  { section: "Architecture", title: "A browser app backed by an API and PostgreSQL", columns: [
    { label: "User", title: "Web browser", lines: ["Employee login and QC screens."] },
    { label: "Frontend", title: "React + TypeScript", lines: ["Vite-built static application."] },
    { label: "API", title: "Node.js + Express", lines: ["Auth, validation, records and criteria."] },
    { label: "Persistence", title: "PostgreSQL", lines: ["Drizzle ORM; object storage for files."] },
  ], flow: ["BROWSER", "STATIC APP", "/api", "POSTGRESQL"] },
  { section: "Data flow", title: "Validation, calculation, persistence and reporting", columns: [
    { label: "Enter", title: "QC form", lines: ["Shared context and test measurements."] },
    { label: "Check", title: "Validation", lines: ["Form checks and server request schemas."] },
    { label: "Derive", title: "Results", lines: ["Form calculations and selected API evaluations."] },
    { label: "Store", title: "Database", lines: ["PostgreSQL records and JSONB details."] },
  ], flow: ["RECORD HISTORY", "REPORT VIEW", "PRINT / XLSX"], note: "Files are in object storage; PostgreSQL stores the metadata and object path." },
  { section: "Publishing", title: "Published on Replit Autoscale", columns: [
    { label: "Source", title: "GitHub remote", lines: ["GitHub source remote configured.", "Automated deployment trigger not confirmed."] },
    { label: "Build", title: "Two services", lines: ["Vite builds the static UI.", "Node runs the Express API; health at /api/healthz."] },
    { label: "Live status", title: "Public deployment", lines: ["Autoscale deployment listed as deployed.", "Successful build reported during this review."] },
  ], note: liveUrl },
  { section: "Security position", title: "Current controls — and items still to verify", columns: [
    { label: "Implemented in code", title: "Current controls", lines: ["Employee passwords: salted scrypt hashes.", "Secure, HttpOnly, SameSite=Lax cookie.", "Server role checks; inactive session revocation.", "Schema validation; login / activity records."] },
    { label: "Requires verification", title: "Do not overstate", lines: ["MFA / SSO; hosted encryption-at-rest settings.", "Backup schedule and tested restoration.", "Complete field-level QC / report revision history.", "Penetration testing, monitoring and incident response."] },
  ], note: "Code inspection is not a security audit. Employee activity history is not a full versioned history of every QC field." },
  { section: "Security recommendations", title: "Recommended security and governance roadmap", columns: [
    { label: "Strengthen access", title: "Build on current roles", lines: ["Evaluate MFA / SSO requirements.", "Review employee lifecycle and access checks.", "Confirm password and session policies."] },
    { label: "Traceability", title: "Reviewable changes", lines: ["Field-level QC record history.", "Report revisions and approval evidence.", "Document retention and access rules."] },
    { label: "Resilience", title: "Test recovery", lines: ["Confirm backup settings.", "Document a restore exercise.", "Monitoring, incident owners and escalation."] },
  ], note: "Verify existing provider controls before making assurance claims." },
  { section: "Future development", title: "A practical path from QC records to analytics", columns: [
    { label: "Phase 1", title: "Govern", lines: ["Verify backup / recovery.", "Record audit and report revisions.", "Roles and standards ownership."] },
    { label: "Phase 2", title: "Analyze", lines: ["Plant / product trends.", "Failure rate and material variability.", "Statistical process control and alerts."] },
    { label: "Phase 3", title: "Connect", lines: ["Tablet-friendly entry.", "Automated notifications.", "Approved production / ERP integrations."] },
  ], note: "Recommendations only; not implemented features." },
  { section: "Management value", title: "A foundation for more consistent QC operations", columns: [
    { label: "Quality", title: "Consistency", lines: ["Test-specific equations and configured criteria.", "Structured records and report presentation."] },
    { label: "Efficiency", title: "Less repeated handling", lines: ["Calculated results reduce manual arithmetic.", "Reusable report layouts."] },
    { label: "Data", title: "Visibility", lines: ["QC history and monthly status views.", "Foundation for future analysis."] },
  ], note: "Expected value depends on adoption and data quality. No quantified time, cost or error reduction is claimed." },
  { section: "Current status", title: "Current availability and next decisions", columns: [
    { label: "Available now", title: "Verified capability", lines: ["QC workflows, calculations and standards.", "Dashboards, reports and daily XLSX.", "Complaints, archive and employee roles.", "Public Replit Autoscale deployment."] },
    { label: "In progress", title: "No feature confirmed", lines: ["No separate in-development feature was identifiable in the inspected repository.", "Confirm active backlog with product owners."] },
    { label: "Recommended next", title: "Govern, then analyze", lines: ["Backup / restore and security verification.", "Record and report-version requirements.", "Prioritize analytics and mobile access."] },
  ], note: "Implemented capability, published status and future recommendations are distinct." },
  { section: "Conclusion", title: "From manual QC reporting to a digital quality platform", dark: true, columns: [
    { label: "Current foundation", title: "Digital QC", lines: ["Standardized records, calculations and reporting.", "Centralized historical information."] },
    { label: "Next stage", title: "Governance and analytics", lines: ["Strengthen security verification and data governance.", "Develop insight from accumulated QC data."] },
  ], flow: ["MANUAL QC", "DIGITAL REPORTING", "CENTRALIZED DATA", "ANALYTICS"] },
  { section: "Appendix A · Calculations", title: "Formula reference from current application logic", columns: [
    { label: "Strength", title: "Load-derived results", lines: ["Cube / Block water: Load × 1,000 ÷ (L × W).", "Air dry: Water × 1.2 outside Dammam; × 1.0 at Dammam. Normalized: rounded Air dry × shape factor.", "Paving: 0.637 × Load × 1,000 ÷ (L × H), then size correction."] },
    { label: "Materials", title: "Percentage / chemical results", lines: ["Moisture / absorption: (Wet − Dry) ÷ Dry × 100.", "Silt: (Before − After) ÷ Before × 100.", "Cl = 0.07092 × [AgNO₃ − 10 × 0.1 × (second − first)].", "SO₄ = [(crucible + ash) − crucible] × 34.3 ÷ 3."] },
  ], note: "Dammam geometry is shown on slides 8–9. Display rounding is field-specific. All listed expressions are derived from the current source." },
  { section: "Appendix B · Architecture", title: "Application architecture and service boundaries", columns: [
    { label: "Presentation", title: "React / Vite", lines: ["TypeScript browser UI.", "QC records, reports, dashboards and admin views."] },
    { label: "API", title: "Node / Express", lines: ["REST under /api.", "Auth, server validation and evaluations."] },
    { label: "Database", title: "Drizzle / PostgreSQL", lines: ["Typed schema and queries.", "Record / configuration persistence."] },
    { label: "Files", title: "Object storage", lines: ["Signed uploads.", "Paths and metadata stored in PostgreSQL."] },
  ], flow: ["BROWSER UI", "/api SERVICE", "DRIZZLE", "POSTGRESQL"] },
  { section: "Appendix C · Data model", title: "Structured records with test-specific details", columns: [
    { label: "QC records", title: "Core record", lines: ["Record number, test type, date, location, material and status.", "Tester / reviewer, remarks and timestamps.", "JSONB details for variable test data."] },
    { label: "Configuration", title: "Reference data", lines: ["Categories and selectable values.", "Strength, water, sieve and shape-factor standards.", "Report templates and layouts."] },
    { label: "Operations", title: "Supporting records", lines: ["Complaints and review sign-off.", "Employees, roles, sessions and activity.", "Archive metadata / object paths."] },
  ], note: "File payloads are separate from database metadata." },
  { section: "Appendix D · Deployment", title: "Production routing and runtime", columns: [
    { label: "Public entry", title: "HTTPS domain", lines: ["Replit public Autoscale deployment.", "Status reported as deployed."] },
    { label: "Web", title: "Static frontend", lines: ["Vite production build at /."] },
    { label: "API", title: "Node process", lines: ["Express service at /api.", "Health endpoint: /api/healthz."] },
    { label: "Data", title: "PostgreSQL", lines: ["Runtime environment supplies connection configuration."] },
  ], note: `${liveUrl} — GitHub remote configured; automated CI/CD trigger not confirmed.` },
  { section: "Appendix E · Security", title: "Security maturity: evidence today, actions next", columns: [
    { label: "Code evidence", title: "Observed controls", lines: ["Salted scrypt password hashes.", "Secure employee-session cookie.", "Server authentication and role checks.", "Schema validation and employee activity history."] },
    { label: "Verify / recommend", title: "Governance work", lines: ["Encryption, backups and restore capability.", "MFA / SSO and sign-in rate controls.", "QC change / report revision history.", "Monitoring, retention and independent testing."] },
  ], note: "This is a code-evidence summary, not certification or a managed-service configuration audit." },
];

await access(texture);
const cover = pptx.addSlide();
frame(cover, 1, "Management overview", "Al Manaratain Quality Control");
text(cover, "Digital Testing &\nReporting Application", 0.55, 2.00, 7.25, 1.70, 37, C.navy, true);
text(cover, "Technical Overview, Workflow, Calculations,\nDeployment & Future Development", 0.55, 4.15, 7.1, 1.1, 23, C.muted);
text(cover, "WEB APPLICATION  /  PREPARED FOR MANAGEMENT", 0.55, 5.70, 7.4, 0.42, 13, C.muted, true);
cover.addImage({ path: texture, x: 8.35, y: 1.90, w: 4.40, h: 3.65 });
text(cover, "MATERIAL / MEASURE / VERIFY", 8.35, 5.73, 4.40, 0.35, 12, C.muted, true);
text(cover, "PUBLISHED APPLICATION", 0.55, 6.35, 10, 0.30, 13, C.gold, true);

pages.forEach((page, index) => {
  const slide = pptx.addSlide();
  frame(slide, index + 2, page.section, page.title, page.dark);
  columns(slide, page.columns, page.dark, Boolean(page.flow));
  if (page.flow) flow(slide, page.flow, 5.78, page.dark);
  if (page.note) text(slide, page.note, 0.55, 6.53, 12.2, 0.35, 11, page.dark ? "CBD5E1" : C.muted);
});

await mkdir(path.dirname(output), { recursive: true });
await pptx.writeFile({ fileName: output });
console.log(`Generated 25 slides: ${path.relative(root, output)}`);
