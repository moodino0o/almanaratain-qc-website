import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide3() {
  return (
    <ManagementSlide section="Operating Context" page="03" title="The operational problem it targets">
      <div className="grid h-[49vh] grid-cols-2 gap-[1.5vw]">
        <Card label="MANUAL-PROCESS RISKS" title="Where friction can occur" soft>
          <div>Repeated entry across forms and spreadsheets</div>
          <div>Formula and formatting differences</div>
          <div>Manual assembly of reports</div>
          <div>Historical records spread across files</div>
        </Card>
        <Card label="CURRENT DIGITAL CAPABILITY" title="What the app centralizes">
          <div>Typed QC records with test-specific details</div>
          <div>Calculations and standards in application logic</div>
          <div>Print-ready reports and spreadsheet export</div>
          <div>Searchable records, reference data and archive</div>
        </Card>
      </div>
      <div className="mt-[2.5vh] grid grid-cols-[1fr_auto_1fr] items-center gap-[1.5vw]">
        <div className="border border-line px-[1.5vw] py-[1.2vh] text-[1.8vw] text-muted">Manual entry / calculation / report work</div>
        <div className="font-display text-[2.5vw] font-bold text-accent">→</div>
        <div className="border border-accent/50 bg-soft px-[1.5vw] py-[1.2vh] text-[1.8vw] font-semibold text-primary">Structured digital QC workflow</div>
      </div>
      <Note>These are design goals, not quantified before-and-after results.</Note>
    </ManagementSlide>
  );
}
