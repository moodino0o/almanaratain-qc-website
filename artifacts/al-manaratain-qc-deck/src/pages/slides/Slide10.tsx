import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide10() {
  return (
    <ManagementSlide section="Reporting" page="10" title="Results move into a report-ready view">
      <div className="grid h-[51vh] grid-cols-[1.12fr_0.88fr] gap-[1.5vw]">
        <div className="border border-line bg-white p-[1.5vw] shadow-sm">
          <div className="mb-[1.2vh] flex items-center justify-between border-b border-line pb-[1vh]">
            <div className="font-display text-[2vw] font-bold text-primary">QC TEST REPORT</div>
            <div className="font-mono text-[1.5vw] text-[#718096]">ILLUSTRATIVE LAYOUT</div>
          </div>
          <div className="grid grid-cols-3 gap-[0.8vw] text-[1.5vw] text-muted">
            <div className="bg-soft p-[0.8vw]">Record / sample</div><div className="bg-soft p-[0.8vw]">Test type</div><div className="bg-soft p-[0.8vw]">Date / location</div>
            <div className="border border-line p-[0.8vw]">Specimen details</div><div className="border border-line p-[0.8vw]">Measured values</div><div className="border border-line p-[0.8vw]">Calculated results</div>
          </div>
          <div className="mt-[1.2vh] h-[16vh] border border-line bg-[#FBFCFE] p-[1vw]">
            <div className="mb-[1vh] h-[1.2vh] w-[82%] bg-[#E2E8F0]" />
            <div className="mb-[1vh] h-[1.2vh] w-[61%] bg-[#E2E8F0]" />
            <div className="h-[1.2vh] w-[73%] bg-[#E2E8F0]" />
          </div>
          <div className="mt-[1vh] text-[1.5vw] text-muted">Illustrative mockup — not a captured application screenshot</div>
        </div>
        <Card label="AVAILABLE OUTPUTS" title="Review and share">
          <div>Printable QC reports</div>
          <div>Browser print / “Print to PDF”</div>
          <div>Daily results .xlsx export</div>
          <div>Configurable layouts / templates</div>
          <div>Dammam: net-area basis</div>
        </Card>
      </div>
      <Note>The signed-in report screen could not be captured in the unauthenticated preview, so the visual above is explicitly illustrative.</Note>
    </ManagementSlide>
  );
}
