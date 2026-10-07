import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide8() {
  return (
    <ManagementSlide section="Dammam Block Logic" page="08" title="Dammam: gross area and net area">
      <div className="grid h-[54vh] grid-cols-[1.05fr_0.95fr] gap-[1.5vw]">
        <Card label="IMPLEMENTED Dammam MODEL" title="Void area is deducted">
          <div className="font-display text-[2vw] font-bold text-primary">Gross Area = Width × Length</div>
          <div>Hole Width = [Width − 2(Face) − (Holes − 1)(Web)] ÷ Holes</div>
          <div>Hole Length = [Length − 2(Face) − (Holes − 1)(Web)] ÷ Holes</div>
          <div>Total Void Area = Holes × Hole Width × Hole Length</div>
          <div className="font-display font-bold text-primary">Net Area = Gross Area − Total Void Area</div>
        </Card>
        <div className="flex flex-col justify-between border border-line bg-soft p-[1.5vw]">
          <div>
            <div className="mb-[1vh] font-mono text-[1.5vw] uppercase tracking-[0.12em] text-[#718096]">SCHEMATIC — NOT TO SCALE</div>
            <svg viewBox="0 0 600 300" className="h-[29vh] w-full" role="img" aria-label="Block cross-section showing face, webs and three voids">
              <rect x="45" y="45" width="510" height="190" fill="#FFFFFF" stroke="#0A1628" strokeWidth="6" />
              <rect x="105" y="85" width="85" height="110" fill="#E7EEF6" stroke="#B8A58A" strokeWidth="4" />
              <rect x="257" y="85" width="85" height="110" fill="#E7EEF6" stroke="#B8A58A" strokeWidth="4" />
              <rect x="410" y="85" width="85" height="110" fill="#E7EEF6" stroke="#B8A58A" strokeWidth="4" />
              <line x1="45" y1="260" x2="555" y2="260" stroke="#718096" strokeWidth="3" />
              <line x1="45" y1="250" x2="45" y2="270" stroke="#718096" strokeWidth="3" />
              <line x1="555" y1="250" x2="555" y2="270" stroke="#718096" strokeWidth="3" />
              <text x="280" y="292" textAnchor="middle" fill="#4A5568" fontSize="22">Width / length · face · web · voids</text>
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-[1vw] text-[1.7vw] text-muted">
            <div>100 / 150 mm width → 2 holes</div><div>200 mm width → 3 holes</div>
            <div>Face default → 30 mm</div><div>Web default → 25 mm at 100/150; otherwise 30 mm</div>
          </div>
        </div>
      </div>
      <Note>The thickness defaults are editable. Confirm the model against approved block geometry or standards before relying on it for acceptance decisions.</Note>
    </ManagementSlide>
  );
}
