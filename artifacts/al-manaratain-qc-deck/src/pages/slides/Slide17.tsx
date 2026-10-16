import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide17() {
  return (
    <ManagementSlide section="Future Development" page="17" title="A practical path from QC records to analytics">
      <div className="grid h-[51vh] grid-cols-3 gap-[1.4vw]">
        <Card label="PHASE 1 · GOVERN" title="Strengthen the foundation">
          Verify backup and recovery
          <div>Complete record-level audit and report revision needs</div>
          <div>Review roles, standards ownership and rollout guidance</div>
        </Card>
        <Card label="PHASE 2 · ANALYZE" title="Turn history into insight" soft>
          Plant and product trend analysis
          <div>Failure-rate and material variability views</div>
          <div>Statistical process-control indicators and alerts</div>
        </Card>
        <Card label="PHASE 3 · CONNECT" title="Extend the platform">
          Tablet-friendly QC entry
          <div>Automated notifications</div>
          <div>Production / ERP integrations where approved</div>
        </Card>
      </div>
      <Note>All items on this slide are recommendations; they are not represented as implemented features.</Note>
    </ManagementSlide>
  );
}
