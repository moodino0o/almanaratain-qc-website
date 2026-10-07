import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide6() {
  return (
    <ManagementSlide section="Data Entry" page="06" title="Structured inputs, tailored to each test">
      <div className="grid h-[55vh] grid-cols-2 gap-[1.4vw]">
        <Card label="RECORD HEADER">
          Record ID, test, date, location, material and status
          <div>Tester, reviewer and remarks</div>
        </Card>
        <Card label="SPECIMEN & LOAD">
          Dimensions, failure load, wet / dry weight
          <div>Dammam face and web thickness</div>
        </Card>
        <Card label="AGGREGATE & MATERIAL" soft>
          Sieve sizes and retained amounts
          <div>Silt, chloride, sulphate and moisture values</div>
        </Card>
        <Card label="SAMPLE DETAILS" soft>
          Product and sample identification
          <div>Fields depend on the selected test workflow</div>
        </Card>
      </div>
      <div className="mt-[2vh]"><Note>The record model combines shared metadata with test-specific details.</Note></div>
    </ManagementSlide>
  );
}
