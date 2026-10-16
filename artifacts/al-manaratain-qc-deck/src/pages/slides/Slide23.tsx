import { Card, ManagementSlide } from '../../components/ManagementSlide';

export default function Slide23() {
  return (
    <ManagementSlide section="Appendix C · Data Model" page="23" title="Structured records with test-specific details">
      <div className="grid h-[53vh] grid-cols-3 gap-[1.1vw]">
        <Card label="QC RECORDS" title="Core record">
          Record number, test type, date, location, material and status
          <div>Tester / reviewer, remarks and timestamps</div>
          <div>Test-specific values stored in a JSONB details object</div>
        </Card>
        <Card label="REFERENCE DATA" title="Reusable configuration" soft>
          Categories and selectable values
          <div>Strength, water, sieve and shape-factor standards</div>
          <div>Report templates and saved layouts</div>
        </Card>
        <Card label="OPERATIONS" title="Supporting records">
          Complaints with status, review sign-off and picture paths
          <div>Employee directory, access roles, sessions and activity events</div>
          <div>Archive metadata with object-storage paths</div>
        </Card>
      </div>
      <div className="mt-[2.5vh] grid grid-cols-3 gap-[1.1vw]">
        <div className="border border-line bg-soft p-[1.1vw] text-[1.7vw] text-muted">Relational identifiers for core tables</div>
        <div className="border border-line bg-soft p-[1.1vw] text-[1.7vw] text-muted">JSONB for variable test details / event details</div>
        <div className="border border-accent/50 bg-white p-[1.1vw] text-[1.7vw] text-muted">File bytes stored separately from database metadata</div>
      </div>
    </ManagementSlide>
  );
}
