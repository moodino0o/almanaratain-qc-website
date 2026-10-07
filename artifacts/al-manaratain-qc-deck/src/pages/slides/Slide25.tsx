import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide25() {
  return (
    <ManagementSlide section="Appendix E · Security" page="25" title="Security maturity: evidence today, actions next">
      <div className="grid h-[51vh] grid-cols-2 gap-[1.3vw]">
        <Card label="IN THE CURRENT CODE" title="Controls observed">
          Salted scrypt password hashes
          <div>Secure, HttpOnly, SameSite=Lax employee session cookie</div>
          <div>Server-side authentication and role authorization</div>
          <div>Inactive-user session rejection / revocation</div>
          <div>Zod request validation and employee activity records</div>
        </Card>
        <Card label="ROADMAP / VERIFY" title="Governance work">
          Confirm hosted database encryption, backups and restore capability
          <div>Evaluate MFA / SSO and sign-in rate controls</div>
          <div>Introduce record-change / report-revision history as required</div>
          <div>Document monitoring, incident response and retention</div>
          <div>Schedule independent security testing</div>
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
