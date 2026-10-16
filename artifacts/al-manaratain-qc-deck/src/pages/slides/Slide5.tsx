import { Card, ManagementSlide } from '../../components/ManagementSlide';

export default function Slide5() {
  return (
    <ManagementSlide section="Workflow" page="05" title="A repeatable workflow from sample to report">
      <div className="grid h-[51vh] grid-cols-3 gap-[1.4vw]">
        <Card label="CAPTURE" title="Record the context">
          <div>01 · Choose the QC test type</div>
          <div>02 · Enter sample date, location and material</div>
          <div>03 · Add test-specific specimen data</div>
        </Card>
        <Card label="ASSESS" title="Check and calculate" soft>
          <div>04 · Validate entered values</div>
          <div>05 · Calculate derived results</div>
          <div>06 · Apply relevant configured criteria</div>
        </Card>
        <Card label="REVIEW & REPORT" title="Close the record">
          <div>07 · Review calculated results</div>
          <div>08 · Record tester / reviewer information where applicable</div>
          <div>09 · Print or export the report</div>
        </Card>
      </div>
      <div className="mt-[2.7vh] flex items-center justify-center gap-[1.1vw] text-[1.8vw] font-semibold text-primary">
        <span className="border border-line px-[1.2vw] py-[1vh]">SAMPLE</span><span className="text-accent">→</span>
        <span className="border border-line px-[1.2vw] py-[1vh]">MEASURE</span><span className="text-accent">→</span>
        <span className="border border-line px-[1.2vw] py-[1vh]">ASSESS</span><span className="text-accent">→</span>
        <span className="border border-line px-[1.2vw] py-[1vh]">REPORT</span>
      </div>
    </ManagementSlide>
  );
}
