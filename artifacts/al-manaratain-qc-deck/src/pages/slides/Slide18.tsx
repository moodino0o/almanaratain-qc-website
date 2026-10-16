import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide18() {
  return (
    <ManagementSlide section="Management Value" page="18" title="A foundation for more consistent QC operations">
      <div className="grid h-[50vh] grid-cols-3 gap-[1.3vw]">
        <Card label="QUALITY" title="Consistency">
          Test-specific formulas and configured criteria
          <div>Structured review and report presentation</div>
        </Card>
        <Card label="EFFICIENCY" title="Less repeated handling" soft>
          Calculated results reduce manual arithmetic
          <div>Reusable report layouts support repeatable output</div>
        </Card>
        <Card label="DATA" title="Better visibility">
          Searchable QC history and monthly status views
          <div>Structured records support future analysis</div>
        </Card>
      </div>
      <div className="mt-[2.5vh] grid grid-cols-2 gap-[1.3vw]">
        <div className="border border-line p-[1.25vw] text-[1.8vw] leading-[1.2] text-muted">Current platform capability: digital records, test calculations, standards, reports and archive.</div>
        <div className="border border-accent/50 bg-soft p-[1.25vw] text-[1.8vw] leading-[1.2] text-primary">Expected management value depends on adoption, data quality and verified operating measures.</div>
      </div>
      <Note>No quantified time, cost or error reduction is claimed in this review.</Note>
    </ManagementSlide>
  );
}
