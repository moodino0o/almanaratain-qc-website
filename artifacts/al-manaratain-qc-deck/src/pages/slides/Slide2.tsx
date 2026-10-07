import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide2() {
  return (
    <ManagementSlide section="Executive Summary" page="02" title="A digital path from test data to QC reporting">
      <div className="grid h-[46vh] grid-cols-3 gap-[1.5vw]">
        <Card label="01 / CAPTURE" title="Structured records">
          Test type, sample details, plant, material and test-specific measurements are stored together.
        </Card>
        <Card label="02 / CALCULATE" title="Application rules">
          Test calculations and configured standards turn measurements into reviewable results.
        </Card>
        <Card label="03 / REPORT" title="Consistent outputs">
          Print-ready reports and a daily results spreadsheet support review and historical lookup.
        </Card>
      </div>
      <div className="mt-[2.5vh] flex items-center justify-between border-y border-line py-[1.5vh]">
        <div className="font-display text-[2.3vw] font-bold text-primary">Digital QC foundation</div>
        <div className="max-w-[57vw] text-[1.8vw] leading-[1.2] text-muted">The platform is designed to reduce repeated calculation and report preparation; measured time or error reductions have not been established in this review.</div>
      </div>
      <Note>Current capabilities are separated from future recommendations throughout this presentation.</Note>
    </ManagementSlide>
  );
}
