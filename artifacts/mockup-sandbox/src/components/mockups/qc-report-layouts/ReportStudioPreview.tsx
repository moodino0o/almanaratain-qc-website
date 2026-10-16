import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GripVertical,
  Printer,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

type ReportKind = "Block compression" | "Ready Mix" | "Sand sieve" | "Paving blocks";
type ReportSection = { id: string; label: string; enabled: boolean };

const reportKinds: ReportKind[] = ["Block compression", "Ready Mix", "Sand sieve", "Paving blocks"];

const reportContent: Record<ReportKind, {
  title: string;
  subtitle: string;
  reference: string;
  rows: string[][];
  headers: string[];
  method: string;
  sample: string;
}> = {
  "Block compression": {
    title: "Concrete Block Compression Test",
    subtitle: "Compressive strength determination",
    reference: "QC-BLK-24-0186",
    headers: ["No.", "Length\n(mm)", "Width\n(mm)", "Height\n(mm)", "Load\n(kN)", "Air dry\n(N/mm²)", "Normalized\n(N/mm²)"],
    rows: [
      ["01", "390", "190", "140", "218.4", "2.95", "3.24"],
      ["02", "391", "190", "141", "226.7", "3.07", "3.36"],
      ["03", "390", "191", "140", "221.2", "2.99", "3.29"],
    ],
    method: "BS EN 772-1:2011",
    sample: "Hollow concrete masonry units",
  },
  "Ready Mix": {
    title: "Ready Mix Concrete Test Results",
    subtitle: "Compressive strength of concrete cubes",
    reference: "QC-RMX-24-0328",
    headers: ["No.", "Test age", "Load\n(kN)", "Calculated strength\n(N/mm²)"],
    rows: [["01", "7 days", "612.8", "27.2"], ["02", "7 days", "634.1", "28.2"], ["03", "28 days", "879.5", "39.1"]],
    method: "BS EN 12390-3:2019",
    sample: "Grade C35/45 — mix design RM-35",
  },
  "Sand sieve": {
    title: "Sieve Analysis Report",
    subtitle: "Particle size distribution",
    reference: "QC-SIV-24-0092",
    headers: ["Sieve size", "Mass retained\n(g)", "Retained\n(%)", "Passing\n(%)"],
    rows: [["4.75 mm", "14.2", "2.8", "97.2"], ["2.36 mm", "68.5", "13.7", "83.5"], ["1.18 mm", "121.4", "24.3", "59.2"]],
    method: "BS EN 933-1:2012",
    sample: "Washed natural sand — source S-04",
  },
  "Paving blocks": {
    title: "Paving Block Test Results",
    subtitle: "Tensile splitting strength",
    reference: "QC-PAV-24-0124",
    headers: ["Block", "Length\n(mm)", "Width\n(mm)", "Load\n(kN)", "Tensile strength\n(N/mm²)"],
    rows: [["01", "200", "100", "36.8", "3.68"], ["02", "200", "100", "38.1", "3.81"], ["03", "201", "100", "37.4", "3.74"]],
    method: "BS EN 1338:2003",
    sample: "Rectangular paving units — 80 mm",
  },
};

const initialSections: ReportSection[] = [
  { id: "identity", label: "Company header", enabled: true },
  { id: "sample", label: "Sample details", enabled: true },
  { id: "results", label: "Test results", enabled: true },
  { id: "remarks", label: "Remarks", enabled: true },
  { id: "approval", label: "Signatures & approval", enabled: true },
];

export function ReportStudioPreview() {
  const [kind, setKind] = useState<ReportKind>("Block compression");
  const [title, setTitle] = useState(reportContent["Block compression"].title);
  const [visibleFields, setVisibleFields] = useState<string[]>(reportContent["Block compression"].headers);
  const [font, setFont] = useState("Arial");
  const [fontSize, setFontSize] = useState(10);
  const [padding, setPadding] = useState(14);
  const [accent, setAccent] = useState("#8c3142");
  const [sections, setSections] = useState(initialSections);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"layout" | "fields">("layout");
  const content = reportContent[kind];
  const sectionOrder = (id: string) => sections.findIndex((section) => section.id === id);

  const changeKind = (next: ReportKind) => {
    setKind(next);
    setTitle(reportContent[next].title);
    setVisibleFields(reportContent[next].headers);
    setSaved(false);
  };
  const toggleField = (field: string) => {
    setVisibleFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
    setSaved(false);
  };
  const setSection = (id: string, enabled: boolean) => {
    setSections((current) => current.map((section) => section.id === id ? { ...section, enabled } : section));
    setSaved(false);
  };
  const moveSection = (index: number, direction: -1 | 1) => {
    setSections((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  };
  const resetLayout = () => {
    setSections(initialSections);
    setFont("Arial");
    setFontSize(10);
    setPadding(14);
    setAccent("#8c3142");
    setTitle(content.title);
    setSaved(false);
  };

  return (
    <main className="min-h-[100dvh] bg-[#f1f3f1] px-4 py-5 text-[#233334] sm:px-7 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#d8dfdc] pb-5">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6ddda] bg-[#f9faf8] text-[#516562]">
              <ChevronLeft size={17} />
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#263f3e] text-[#e4c789]">
              <FileCheck2 size={18} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.15em] text-[#788986]">Al Manaratain · Quality control</div>
              <div className="mt-0.5 text-sm font-semibold text-[#263a39]">Settings <span className="px-1.5 text-[#a8b2ae]">/</span> Report layouts</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#d8dfdc] bg-[#f8faf8] px-3 py-1.5 text-xs text-[#647571] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#80a28d]" /> Draft preview</span>
            <button type="button" onClick={resetLayout} className="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-[#61716e] hover:bg-white">
              <RotateCcw size={14} /> Reset
            </button>
            <button type="button" onClick={() => { setSaved(true); }} className="flex h-9 items-center gap-2 rounded-lg bg-[#263f3e] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1e3433]">
              {saved ? <Check size={14} /> : <FileCheck2 size={14} />}
              {saved ? "Layout saved" : "Save layout"}
            </button>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[.17em] text-[#927453]">Document studio</p>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-.035em] text-[#263a39] sm:text-[32px]">Shape the printed report.</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#6c7b77]">Set the page style and section order. Preview updates as you work.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#d8dfdc] bg-[#f8faf8] px-3.5 py-2.5 text-xs text-[#647571]">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e8edeb] text-[#59706a]"><FileText size={15} /></span>
            <span><b className="font-semibold text-[#344946]">4</b> report templates</span>
            <ChevronDown size={14} className="ml-2 text-[#879590]" />
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(390px,0.82fr)_minmax(550px,1.18fr)]">
          <section className="overflow-hidden rounded-2xl border border-[#dce2df] bg-[#f9faf8] shadow-[0_6px_22px_rgba(39,61,56,.045)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e4e9e6] px-5 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#304542]"><Settings2 size={16} className="text-[#987650]" /> Layout controls</div>
                <p className="mt-1 text-xs text-[#82908c]">Fine-tune the printable page</p>
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#eef1ee] text-[#73817c]"><SlidersHorizontal size={15} /></div>
            </div>

            <div className="flex gap-5 border-b border-[#e4e9e6] px-5 sm:px-6">
              {(["layout", "fields"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`relative py-3 text-xs font-semibold capitalize transition-colors ${activeTab === tab ? "text-[#354c47]" : "text-[#899590] hover:text-[#536762]"}`}>
                  {tab === "layout" ? "Page layout" : "Data fields"}
                  {activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#987650]" />}
                </button>
              ))}
            </div>

            {activeTab === "layout" ? (
              <div className="space-y-6 px-5 py-5 sm:px-6">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.11em] text-[#778681]">Report type</span>
                  <span className="relative block">
                    <select value={kind} onChange={(event) => changeKind(event.target.value as ReportKind)} className="h-10 w-full appearance-none rounded-lg border border-[#dce3df] bg-white px-3.5 pr-9 text-sm font-medium text-[#374a46] outline-none transition focus:border-[#947651] focus:ring-2 focus:ring-[#947651]/10">
                      {reportKinds.map((item) => <option key={item}>{item}</option>)}
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[#81908a]" />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.11em] text-[#778681]">Printed report title</span>
                  <input value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} className="h-10 w-full rounded-lg border border-[#dce3df] bg-white px-3.5 text-sm font-medium text-[#374a46] outline-none focus:border-[#947651] focus:ring-2 focus:ring-[#947651]/10" />
                </label>

                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[.11em] text-[#778681]">Type & scale</span>
                    <span className="text-[10px] font-medium text-[#a0aaa5]">Applied to document</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-[11px] font-medium text-[#72817c]">Font family
                      <span className="relative mt-1.5 block">
                        <select value={font} onChange={(event) => setFont(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-[#dce3df] bg-white px-3 pr-8 text-sm text-[#40514c] outline-none focus:border-[#947651]">
                          {["Arial", "Calibri", "Times New Roman", "Georgia"].map((item) => <option key={item}>{item}</option>)}
                        </select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#87948f]" />
                      </span>
                    </label>
                    <label className="block text-[11px] font-medium text-[#72817c]">Body size
                      <span className="mt-1.5 flex h-10 items-center overflow-hidden rounded-lg border border-[#dce3df] bg-white">
                        <input type="number" min={8} max={18} value={fontSize} onChange={(event) => { setFontSize(Number(event.target.value)); setSaved(false); }} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[#40514c] outline-none" />
                        <span className="pr-3 text-xs text-[#929e99]">pt</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-medium text-[#72817c]">Accent color
                    <span className="mt-1.5 flex h-10 items-center gap-2 rounded-lg border border-[#dce3df] bg-white px-2.5">
                      <input type="color" value={accent} onChange={(event) => { setAccent(event.target.value); setSaved(false); }} className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <span className="font-mono text-xs text-[#64746f]">{accent.toUpperCase()}</span>
                    </span>
                  </label>
                  <label className="block text-[11px] font-medium text-[#72817c]">Paper margin
                    <span className="mt-1.5 flex h-10 items-center overflow-hidden rounded-lg border border-[#dce3df] bg-white">
                      <input type="number" min={5} max={30} value={padding} onChange={(event) => { setPadding(Number(event.target.value)); setSaved(false); }} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[#40514c] outline-none" />
                      <span className="pr-3 text-xs text-[#929e99]">mm</span>
                    </span>
                  </label>
                </div>

                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <div><h3 className="text-xs font-semibold text-[#40534e]">Report sections</h3><p className="mt-0.5 text-[10px] text-[#93a09a]">Show or reorder the page content</p></div>
                    <span className="rounded-full bg-[#edf1ee] px-2 py-1 text-[10px] font-semibold text-[#73827c]">{sections.filter((item) => item.enabled).length} visible</span>
                  </div>
                  <div className="space-y-1.5">
                    {sections.map((section, index) => (
                      <div key={section.id} className="flex min-h-10 items-center gap-2.5 rounded-lg border border-[#e4e9e6] bg-white px-2.5">
                        <GripVertical size={14} className="text-[#b1bbb6]" />
                        <input type="checkbox" checked={section.enabled} onChange={(event) => setSection(section.id, event.target.checked)} className="h-3.5 w-3.5 accent-[#8c3142]" />
                        <span className={`min-w-0 flex-1 text-xs ${section.enabled ? "text-[#495b56]" : "text-[#9ba6a1]"}`}>{section.label}</span>
                        <button type="button" aria-label={`Move ${section.label} up`} onClick={() => moveSection(index, -1)} disabled={index === 0} className="grid h-6 w-6 place-items-center rounded text-[#81908a] hover:bg-[#f1f4f1] disabled:opacity-30"><ArrowUp size={13} /></button>
                        <button type="button" aria-label={`Move ${section.label} down`} onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1} className="grid h-6 w-6 place-items-center rounded text-[#81908a] hover:bg-[#f1f4f1] disabled:opacity-30"><ArrowDown size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg border border-[#e5e7da] bg-[#f7f7ef] px-3 py-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e8e8d5] text-[#807c50]"><Eye size={12} /></span>
                  <p className="text-[10px] leading-[1.55] text-[#7d8066]">Layout changes affect printed reports. Approved test data and calculations are never changed.</p>
                </div>
              </div>
            ) : (
              <div className="px-5 py-5 sm:px-6">
                <div className="mb-4 flex items-start justify-between">
                  <div><h3 className="text-sm font-semibold text-[#40534e]">Included result fields</h3><p className="mt-1 text-xs text-[#889590]">Fields available for this report template</p></div>
                  <span className="rounded-md bg-[#edf1ee] px-2 py-1 text-[10px] font-semibold text-[#72817b]">{content.headers.length} columns</span>
                </div>
                <div className="space-y-2">
                  {content.headers.map((field, index) => <label key={field} className="flex items-center gap-3 rounded-lg border border-[#e4e9e6] bg-white px-3 py-2.5">
                    <input type="checkbox" checked={visibleFields.includes(field)} onChange={() => toggleField(field)} className="h-3.5 w-3.5 accent-[#8c3142]" />
                    <span className="flex-1 text-xs font-medium text-[#53635e]">{field.replace("\n", " ")}</span>
                    <span className="font-mono text-[10px] text-[#9ca7a1]">0{index + 1}</span>
                  </label>)}
                </div>
                <div className="mt-5 rounded-xl bg-[#eef2ef] p-4">
                  <div className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#7f8f89]"><SlidersHorizontal size={15} /></div>
                    <div><p className="text-xs font-semibold text-[#50615b]">Approved data only</p><p className="mt-1 text-[11px] leading-5 text-[#82908a]">Results shown here map to verified fields from the selected test record.</p></div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-[#d8dfdc] bg-[#e7ebe8] shadow-[0_6px_22px_rgba(39,61,56,.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7dedb] bg-[#eef1ee] px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#657973] shadow-sm"><Eye size={15} /></span>
                <div><div className="text-xs font-semibold text-[#415550]">Print preview</div><div className="text-[10px] text-[#8b9892]">A4 portrait <span className="px-1">·</span> 100% scale</div></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-[#d6ddda] bg-[#f8faf8] px-2.5 py-1.5 font-mono text-[10px] text-[#74827d]">1 / 1</span>
                <button type="button" onClick={() => window.print()} className="flex h-8 items-center gap-1.5 rounded-lg bg-[#fff] px-3 text-[11px] font-semibold text-[#4c625b] shadow-sm hover:bg-[#f6f8f6]"><Printer size={13} /> Print</button>
                <button type="button" onClick={() => window.print()} aria-label="Download report" className="grid h-8 w-8 place-items-center rounded-lg border border-[#d6ddda] bg-[#f8faf8] text-[#677a73] hover:bg-white"><Download size={14} /></button>
              </div>
            </div>
            <div className="flex justify-center overflow-auto p-3 sm:p-6 lg:p-8">
              <article
                className="w-full max-w-[630px] bg-white text-[#2a3030] shadow-[0_12px_38px_rgba(44,58,53,.17)]"
                style={{
                  minHeight: 790,
                  padding: `${Math.max(22, padding * 2.6)}px ${Math.max(24, padding * 2.9)}px`,
                  fontFamily: font,
                  fontSize: `${fontSize}px`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {sections.find((item) => item.id === "identity")?.enabled && <div style={{ order: sectionOrder("identity") }}>
                  <div className="flex items-center justify-between gap-3 border-b-[3px] pb-3" style={{ borderColor: accent }}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-[48px] w-[48px] shrink-0 place-items-center border border-[#d9dcd7] text-[11px] font-bold tracking-[.1em]" style={{ color: accent }}>AM<span className="text-[7px]">QC</span></div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold leading-tight tracking-[.025em]" style={{ color: accent }}>AL MANARATAIN</p>
                        <p className="mt-1 text-[8px] uppercase tracking-[.17em] text-[#737a78]">Quality Control Laboratory</p>
                        <p className="mt-1 text-[7px] text-[#858c89]">Kingdom of Bahrain · Building Materials Division</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[7px] font-bold uppercase tracking-[.14em] text-[#818885]">Laboratory report</p>
                      <p className="mt-1 font-mono text-[9px] font-semibold" style={{ color: accent }}>{content.reference}</p>
                      <p className="mt-1 text-[7px] text-[#858c89]">Issued 18 November 2024</p>
                    </div>
                  </div>
                </div>}

                {sections.find((item) => item.id === "sample")?.enabled && <div style={{ order: sectionOrder("sample") }}>
                  <div className="py-4 text-center">
                    <p className="text-[7px] font-bold uppercase tracking-[.23em] text-[#858c89]">{content.subtitle}</p>
                    <h2 className="mt-1.5 text-[17px] font-bold leading-tight" style={{ color: accent }}>{title || content.title}</h2>
                    <p className="mt-1 text-[8px] text-[#7b8380]">Test report <span className="mx-1.5 text-[#c0c5c2]">|</span> Controlled copy</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2 border-y border-[#dfe3df] bg-[#f8f9f7] px-3 py-2.5">
                    {[
                      ["Client", "Al Manaratain Company"],
                      ["Sample description", content.sample],
                      ["Sample received", "12 November 2024"],
                      ["Test date", "18 November 2024"],
                      ["Work order", "WO-24-1186"],
                      ["Test method", content.method],
                    ].map(([label, value]) => <div key={label} className="min-w-0">
                      <div className="text-[6px] font-bold uppercase tracking-[.12em] text-[#89918e]">{label}</div>
                      <div className="mt-0.5 truncate text-[8px] font-medium text-[#3c4542]">{value}</div>
                    </div>)}
                  </div>
                </div>}

                {sections.find((item) => item.id === "results")?.enabled && <div style={{ order: sectionOrder("results") }}>
                  <div className="mb-2 mt-4 flex items-end justify-between">
                    <div><h3 className="text-[10px] font-bold uppercase tracking-[.12em]" style={{ color: accent }}>Test results</h3><p className="mt-0.5 text-[7px] text-[#89918e]">Individual specimen measurements and calculated values</p></div>
                    <span className="text-[7px] text-[#858c89]">Table 1</span>
                  </div>
                  <table className="w-full border-collapse text-center">
                    <thead>
                      <tr style={{ backgroundColor: accent, color: "#fff" }}>
                        {content.headers.map((header) => visibleFields.includes(header) && <th key={header} className="whitespace-pre-line border border-white/20 px-1 py-2 text-[7px] font-semibold leading-[1.25]">{header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {content.rows.map((row, rowIndex) => <tr key={row[0]} style={{ backgroundColor: rowIndex % 2 ? "#f7f8f6" : "#fff" }}>
                        {row.map((value, valueIndex) => visibleFields.includes(content.headers[valueIndex]) && <td key={`${rowIndex}-${valueIndex}`} className={`border border-[#dfe3df] px-1 py-2 text-[8px] ${valueIndex === 0 ? "font-semibold text-[#5b6863]" : "text-[#48534f]"}`}>{value}</td>)}
                      </tr>)}
                    </tbody>
                  </table>
                  <div className="mt-2 flex items-center justify-between border border-[#dfe3df] bg-[#f8f9f7] px-2.5 py-2">
                    <span className="text-[7px] font-medium text-[#727c78]">Mean result</span>
                    <span className="text-[8px] font-bold" style={{ color: accent }}>{kind === "Block compression" ? "3.30 N/mm²" : kind === "Ready Mix" ? "31.5 N/mm²" : kind === "Sand sieve" ? "80.0% passing" : "3.74 N/mm²"}</span>
                  </div>
                  <div className="mt-2 flex gap-1.5 text-[7px] leading-[1.5] text-[#68726e]">
                    <span className="font-bold" style={{ color: accent }}>Note:</span>
                    <span>Values reported apply only to the specimens tested. Results shall not be reproduced except in full without written approval.</span>
                  </div>
                </div>}

                {sections.find((item) => item.id === "remarks")?.enabled && <div className="mt-3 border-l-2 py-1 pl-2.5" style={{ borderColor: accent, order: sectionOrder("remarks") }}>
                  <p className="text-[7px] font-bold uppercase tracking-[.1em] text-[#707b76]">Remarks</p>
                  <p className="mt-1 text-[7px] leading-[1.5] text-[#737c78]">Specimens were received in a condition suitable for testing. Testing was conducted under laboratory conditions in accordance with the referenced standard.</p>
                </div>}

                {sections.find((item) => item.id === "approval")?.enabled && <div className="mt-6 grid grid-cols-2 gap-8" style={{ order: sectionOrder("approval") }}>
                  <div className="border-t border-[#aeb7b2] pt-1.5">
                    <p className="text-[7px] font-semibold text-[#3f4a46]">S. Rahman</p>
                    <p className="mt-0.5 text-[6px] text-[#828b87]">Tested by · Laboratory Technician</p>
                  </div>
                  <div className="border-t border-[#aeb7b2] pt-1.5">
                    <p className="text-[7px] font-semibold text-[#3f4a46]">A. Al Khalifa</p>
                    <p className="mt-0.5 text-[6px] text-[#828b87]">Approved by · Quality Manager</p>
                  </div>
                </div>}
                <div className="mt-7 border-t border-[#e2e5e2] pt-2" style={{ order: 99 }}>
                  <div className="flex items-center justify-between text-[6px] text-[#929a96]">
                    <span>Al Manaratain QC Laboratory <span className="mx-1">·</span> Document controlled</span>
                    <span>Page 1 of 1</span>
                  </div>
                  <div className="mt-1.5 h-[2px] w-full" style={{ backgroundColor: accent }} />
                </div>
              </article>
            </div>
            <div className="flex items-center justify-between border-t border-[#d7dedb] px-4 py-2.5 text-[10px] text-[#84918b] sm:px-5">
              <span>Preview reflects current layout settings</span>
              <span className="font-mono">A4 · 210 × 297 mm</span>
            </div>
          </section>
        </div>
      </div>
      <style>{`
        @media (max-width: 520px) {
          article { min-height: 700px !important; }
        }
        @media print {
          body * { visibility: hidden; }
          article, article * { visibility: visible; }
          article { position: absolute; inset: 0 auto auto 0; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; }
        }
      `}</style>
    </main>
  );
}