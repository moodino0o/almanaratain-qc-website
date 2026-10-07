import { ManagementSlide, Note } from '../../components/ManagementSlide';

const formulas = [
  ["CUBE / BLOCK WATER STRENGTH", "Load (kN) × 1,000 ÷ [Length × Width]"],
  ["BLOCK · FACTOR 1.2 OTHER / 1.0 DAMMAM", "Air dry = Water × factor\nNormalized = rounded Air dry × shape factor"],
  ["PAVING · SIZE FACTOR k", "0.637 × Load × 1,000 ÷ [Length × Height] × k"],
  ["MOISTURE / WATER ABSORPTION", "(Wet − Dry) ÷ Dry × 100"],
  ["SILT · PASS WHEN BELOW 3%", "(Before − After) ÷ Before × 100"],
  ["CHLORIDE · C₁ / C₂ = TITRATION POINTS", "0.07092 × [AgNO₃ − 10 × 0.1 × (C₂ − C₁)]"],
  ["SULPHATE", "[(Crucible + ash) − Crucible] × 34.3 ÷ 3"],
  ["DAMMAM · GEOMETRY ON SLIDE 8", "Net Area = W × L − n × Hole W × Hole L\nStrength = Load × 1,000 ÷ Area"],
];

export default function Slide21() {
  return (
    <ManagementSlide section="Appendix A · Calculations" page="21" title="Formula reference from current application logic">
      <div className="grid h-[57vh] grid-cols-2 grid-rows-4 gap-[0.9vw]">
        {formulas.map(([label, formula]) => (
          <div key={label} className="border border-line bg-white p-[0.7vw]">
            <div className="font-mono text-[1.5vw] leading-[1.1] text-[#718096]">{label}</div>
            <div className="mt-[0.7vh] whitespace-pre-line text-[1.8vw] font-bold leading-[1.1] text-primary">{formula}</div>
          </div>
        ))}
      </div>
      <div className="mt-[1vh]"><Note>Load is in kN; dimensions / areas in mm / mm² where applicable. Rounding is field-specific, not one universal precision rule.</Note></div>
    </ManagementSlide>
  );
}
