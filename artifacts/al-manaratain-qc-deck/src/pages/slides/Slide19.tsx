import { Card, ManagementSlide } from '../../components/ManagementSlide';

export default function Slide19() {
  return (
    <ManagementSlide section="Current Status" page="19" title="Current availability and next decisions">
      <div className="grid h-[53vh] grid-cols-3 gap-[1.3vw]">
        <Card label="AVAILABLE NOW" title="Verified in the application">
          QC record workflows, calculations and standards
          <div>Dashboards, printable reports and daily XLSX export</div>
          <div>Complaints, archive, reference data and employee roles</div>
          <div>Public Replit Autoscale deployment</div>
        </Card>
        <Card label="IN PROGRESS" title="No feature confirmed">
          No separate in-development application feature was identifiable from the inspected repository state.
          <div>Confirm the active delivery backlog with product owners.</div>
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
