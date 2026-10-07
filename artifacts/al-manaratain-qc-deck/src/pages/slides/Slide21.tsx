import { ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide21() {
  return (
    <ManagementSlide section="Appendix A · Calculations" page="21" title="Formula reference from current application logic">
      <div className="grid h-[57vh] grid-cols-2 grid-rows-4 gap-[0.9vw]">
        <div className="border border-line bg-white p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">CUBE / BLOCK WATER STRENGTH</div><div className="mt-[0.6vh] text-[1.9vw] font-bold text-primary">Load (kN) × 1,000 ÷ [Length × Width]</div></div>
        <div className="border border-line bg-white p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">BLOCK STRENGTH ADJUSTMENT</div><div className="mt-[0.6vh] text-[1.8vw] font-bold leading-[1.1] text-primary">Air dry = Water × 1.2 (non-Dammam); × 1.0 (Dammam). Optional normalized = Air dry × shape factor.</div></div>
        <div className="border border-line bg-white p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">PAVING BLOCK</div><div className="mt-[0.6vh] text-[1.9vw] font-bold text-primary">0.637 × Load × 1,000 ÷ [Length × Height] × correction factor</div></div>
        <div className="border border-line bg-white p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">MOISTURE / WATER ABSORPTION</div><div className="mt-[0.6vh] text-[1.9vw] font-bold text-primary">(Wet − Dry) ÷ Dry × 100</div></div>
        <div className="border border-line bg-white p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">SILT CONTENT</div><div className="mt-[0.6vh] text-[1.9vw] font-bold text-primary">(Before − After) ÷ Before × 100</div><div className="text-[1.5vw] text-muted">Pass when below the configured limit (current default: 3%).</div></div>
        <div className="border border-line bg-white p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">CHLORIDE / SULPHATE</div><div className="mt-[0.5vh] text-[1.7vw] font-bold leading-[1.1] text-primary">Cl = 0.07092 × [AgNO₃ − 10 × 0.1 × (second − first)]</div><div className="text-[1.7vw] font-bold leading-[1.1] text-primary">SO₄ = [(crucible + ash) − crucible] × 34.3 ÷ 3</div></div>
        <div className="border border-line bg-white p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">DAMMAM HOLE GEOMETRY</div><div className="mt-[0.5vh] text-[1.7vw] font-bold leading-[1.1] text-primary">Hole W = [W − 2F − (n − 1)Web] ÷ n</div><div className="text-[1.7vw] font-bold leading-[1.1] text-primary">Hole L = [L − 2F − (n − 1)Web] ÷ n</div></div>
        <div className="border border-accent/50 bg-soft p-[1vw]"><div className="font-mono text-[1.5vw] text-[#718096]">DAMMAM AREA / STRENGTH</div><div className="mt-[0.5vh] text-[1.8vw] font-bold leading-[1.1] text-primary">Net Area = W × L − n × Hole W × Hole L</div><div className="text-[1.7vw] font-bold text-primary">Strength = Load (kN) × 1,000 ÷ Area</div></div>
      </div>
      <Note>Lengths and areas are in mm / mm² where applicable. Field-level rounding is implemented separately; this slide does not assert one global precision rule.</Note>
    </ManagementSlide>
  );
}
