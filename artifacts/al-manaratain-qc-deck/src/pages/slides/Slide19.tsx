import { Card, ManagementSlide } from '../../components/ManagementSlide';

export default function Slide19() {
  return (
    <ManagementSlide section="Current Status" page="19" title="Current availability and next decisions">
      <div className="grid h-[53vh] grid-cols-3 gap-[1.3vw]">
        <Card label="AVAILABLE NOW" title="Verified in the application">
          QC records and calculations
          <div>Dashboards, reports and XLSX</div>
          <div>Complaints, archive and roles</div>
          <div>Public Autoscale deployment</div>
        </Card>
        <Card label="IN PROGRESS" title="No feature confirmed">
          No separate in-development feature was confirmed by this review.
          <div>Confirm the active backlog with product owners.</div>
        </Card>
        <Card label="RECOMMENDED NEXT" title="Govern, then analyze" soft>
          Verify backup / restore and security posture
          <div>Define record audit and report-version requirements</div>
          <div>Prioritize dashboards, alerts and mobile access</div>
        </Card>
      </div>
      <div className="mt-[2.5vh] border-y border-line py-[1.3vh] text-center font-display text-[2.1vw] font-bold text-primary">
        Implemented ≠ published status ≠ future recommendation
      </div>
    </ManagementSlide>
  );
}
