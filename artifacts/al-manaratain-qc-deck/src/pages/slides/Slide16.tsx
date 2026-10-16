import { Card, ManagementSlide } from '../../components/ManagementSlide';

export default function Slide16() {
  return (
    <ManagementSlide section="Security Recommendations" page="16" title="Recommended security and governance roadmap">
      <div className="grid h-[52vh] grid-cols-3 gap-[1.3vw]">
        <Card label="01 · STRENGTHEN ACCESS" title="Build on current roles">
          Assess MFA or SSO requirements
          <div>Review employee lifecycle, role assignment and periodic access checks</div>
          <div>Confirm password and session policies fit company requirements</div>
        </Card>
        <Card label="02 · IMPROVE TRACEABILITY" title="Make changes reviewable" soft>
          Add field-level QC record history
          <div>Keep report revision and approval evidence</div>
          <div>Define retention and access rules for uploaded documents</div>
        </Card>
        <Card label="03 · PROVE RESILIENCE" title="Test recovery">
          Confirm managed database backup settings
          <div>Run and document a restore exercise</div>
          <div>Define monitoring, incident owners and escalation path</div>
        </Card>
      </div>
      <div className="mt-[2.6vh] border border-line px-[1.5vw] py-[1.3vh] text-[1.8vw] leading-[1.2] text-muted">
        Prioritize verification of existing provider controls before implementing new controls or making assurance claims.
      </div>
    </ManagementSlide>
  );
}
