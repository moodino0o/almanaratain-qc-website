import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide6() {
  return (
    <ManagementSlide section="Data Entry" page="06" title="Structured inputs, tailored to each test">
      <div className="grid h-[48vh] grid-cols-2 gap-[1.4vw]">
        <Card label="RECORD HEADER" title="Shared context">
          Record number · test type · sample date · location · material · status
          <div>Tested by · reviewer · remarks</div>
        </Card>
        <Card label="SPECIMEN & LOAD" title="Where applicable">
          Length · width · height · failure load · wet / dry weight
          <div>Dammam Block face and web thickness inputs</div>
        </Card>
        <Card label="AGGREGATE & MATERIAL" title="Test-specific measurements" soft>
          Sieve sizes and retained amounts
          <div>Silt, chloride, sulphate and moisture-related values</div>
        </Card>
        <Card label="SAMPLE DETAILS" title="Record identification" soft>
          Product / sample details depend on the selected test workflow
          <div>Inputs are not assumed to be identical across all tests</div>
        </Card>
      </div>
      <div className="mt-[2.3vh] grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-[1vw]">
        <div className="border border-line bg-white p-[1.1vh] text-center text-[1.8vw] font-semibold text-primary">INPUT</div>
        <div className="text-[2.3vw] text-accent">→</div>
        <div className="border border-line bg-soft p-[1.1vh] text-center text-[1.8vw] font-semibold text-primary">CALCULATION</div>
        <div className="text-[2.3vw] text-accent">→</div>
        <div className="border border-line bg-white p-[1.1vh] text-center text-[1.8vw] font-semibold text-primary">RESULT</div>
      </div>
      <Note>Exact fields vary by test type; the record model stores shared metadata plus test-specific details.</Note>
    </ManagementSlide>
  );
}
