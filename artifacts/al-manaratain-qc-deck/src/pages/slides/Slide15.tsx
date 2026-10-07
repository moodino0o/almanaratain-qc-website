import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide15() {
  return (
    <ManagementSlide section="Security Position" page="15" title="Current controls — and items still to verify">
      <div className="grid h-[52vh] grid-cols-2 gap-[1.4vw]">
        <Card label="IMPLEMENTED IN THE CODE" title="Current controls">
          Employee ID and password login; passwords use salted scrypt hashes
          <div>Secure, HttpOnly, SameSite=Lax session cookie</div>
          <div>Server-side role checks and administrator-only actions</div>
          <div>Inactive employee sessions are rejected / revoked</div>
          <div>Request schemas are validated; login and activity events are recorded</div>
        </Card>
        <Card label="NOT CONFIRMED BY THIS REVIEW" title="Verify before claiming">
          MFA / SSO and external identity integration
          <div>Production database encryption-at-rest settings</div>
          <div>Backup schedule and successful restore testing</div>
          <div>Full field-level change history for QC records and reports</div>
          <div>Penetration test, alerting coverage and incident response plan</div>
        </Card>
      </div>
      <div className="mt-[2.2vh] grid grid-cols-2 gap-[1.3vw]">
        <div className="border border-line bg-soft p-[1.2vw] text-[1.7vw] leading-[1.2] text-muted">Employee activity history is present; it is not the same as a complete versioned audit of every QC field change.</div>
        <div className="flex items-center border-l-[0.35vw] border-accent pl-[1.3vw] text-[1.8vw] font-semibold leading-[1.2] text-primary">These findings describe code evidence, not a penetration test or provider security certification.</div>
      </div>
      <Note>Current controls do not by themselves establish that the system is “fully secure.”</Note>
    </ManagementSlide>
  );
}
