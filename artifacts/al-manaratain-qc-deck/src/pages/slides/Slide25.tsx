import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide25() {
  return (
    <ManagementSlide section="Appendix E · Security" page="25" title="Security maturity: evidence today, actions next">
      <div className="grid h-[51vh] grid-cols-2 gap-[1.3vw]">
        <Card label="IN THE CURRENT CODE" title="Controls observed">
          Salted scrypt password hashes
          <div>Secure, HttpOnly, SameSite=Lax cookie</div>
          <div>Server authentication and roles</div>
          <div>Inactive-session revocation</div>
          <div>Request validation and activity history</div>
        </Card>
        <Card label="ROADMAP / VERIFY" title="Governance work">
          Verify encryption, backups and restore
          <div>Assess MFA / SSO and sign-in limits</div>
          <div>QC change / report revision history</div>
          <div>Monitoring, incidents and retention</div>
          <div>Independent security testing</div>
        </Card>
      </div>
      <div className="mt-[2.5vh] grid grid-cols-4 gap-[0.8vw] text-center">
        <div className="border border-line bg-soft p-[1.2vh] text-[1.6vw] font-semibold text-primary">ACCESS</div>
        <div className="border border-line bg-white p-[1.2vh] text-[1.6vw] font-semibold text-primary">TRACEABILITY</div>
        <div className="border border-line bg-soft p-[1.2vh] text-[1.6vw] font-semibold text-primary">RECOVERY</div>
        <div className="border border-accent/50 bg-white p-[1.2vh] text-[1.6vw] font-semibold text-primary">ASSURANCE</div>
      </div>
      <Note>Code inspection identifies implemented mechanisms; it does not verify managed-service configuration or constitute a security audit.</Note>
    </ManagementSlide>
  );
}
