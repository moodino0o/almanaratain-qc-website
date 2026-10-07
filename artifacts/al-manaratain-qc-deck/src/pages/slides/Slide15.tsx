import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide15() {
  return (
    <ManagementSlide section="Security Position" page="15" title="Current controls — and items still to verify">
      <div className="grid h-[52vh] grid-cols-2 gap-[1.4vw]">
        <Card label="IMPLEMENTED IN THE CODE" title="Current controls">
          Employee login; salted scrypt password hashes
          <div>Secure, HttpOnly, SameSite=Lax cookie</div>
          <div>Server-side roles and admin-only actions</div>
          <div>Inactive sessions rejected / revoked</div>
          <div>Request validation; activity records</div>
        </Card>
        <Card label="NOT CONFIRMED BY THIS REVIEW" title="Verify before claiming">
          MFA / SSO
          <div>Hosted database encryption settings</div>
          <div>Backup schedule and restore testing</div>
          <div>QC field / report revision history</div>
          <div>Security testing and incident response</div>
        </Card>
      </div>
      <div className="mt-[2.5vh]"><Note>Code evidence is not a security audit. Activity history is not a complete QC change history; current controls do not establish that the system is “fully secure.”</Note></div>
    </ManagementSlide>
  );
}
