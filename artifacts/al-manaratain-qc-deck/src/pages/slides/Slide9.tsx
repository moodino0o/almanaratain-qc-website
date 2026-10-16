import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide9() {
  return (
    <ManagementSlide section="Dammam Block Logic" page="09" title="Dammam: strength on gross and net basis">
      <div className="grid h-[48vh] grid-cols-2 gap-[1.5vw]">
        <Card label="AREA BASIS" title="Same load, different area">
          <div className="font-display text-[2.15vw] font-bold text-primary">Gross Strength = Load × 1,000 ÷ Gross Area</div>
          <div className="font-display text-[2.15vw] font-bold text-primary">Net Strength = Load × 1,000 ÷ Net Area</div>
          <div>With an identical failure load, the net-area result is higher because the void area is excluded.</div>
        </Card>
        <Card label="ILLUSTRATIVE ONLY" title="Fresh example from app logic" soft>
          8-inch selection → 400 × 200 mm; 3 holes; face/web 30 mm; load 200 kN
          <div>Gross Area = 80,000 mm² · Net Area ≈ 72,533.33 mm²</div>
          <div>Gross Strength = 2.50 N/mm² · Net Strength ≈ 2.76 N/mm²</div>
        </Card>
      </div>
      <div className="mt-[2.4vh] grid grid-cols-3 gap-[1.2vw]">
        <div className="border border-line bg-white p-[1.2vw] text-center"><div className="font-mono text-[1.5vw] text-muted">LOAD</div><div className="mt-[0.7vh] font-display text-[2.2vw] font-bold text-primary">200 kN</div></div>
        <div className="border border-line bg-white p-[1.2vw] text-center"><div className="font-mono text-[1.5vw] text-muted">GROSS AREA</div><div className="mt-[0.7vh] font-display text-[2.2vw] font-bold text-primary">80,000 mm²</div></div>
        <div className="border border-accent/50 bg-soft p-[1.2vw] text-center"><div className="font-mono text-[1.5vw] text-muted">NET AREA</div><div className="mt-[0.7vh] font-display text-[2.2vw] font-bold text-primary">≈ 72,533 mm²</div></div>
      </div>
      <Note>This is a mathematical illustration, not a tested sample, acceptance threshold or value from the supplied brief.</Note>
    </ManagementSlide>
  );
}
