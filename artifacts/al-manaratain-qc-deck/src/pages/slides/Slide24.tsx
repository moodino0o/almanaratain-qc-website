import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide24() {
  return (
    <ManagementSlide section="Appendix D · Deployment" page="24" title="Production routing and runtime">
      <div className="grid h-[44vh] grid-cols-4 gap-[1vw]">
        <Card label="PUBLIC ENTRY" title="HTTPS domain">
          Replit public deployment URL
          <div>Current status: deployed</div>
        </Card>
        <Card label="WEB SERVICE" title="Static frontend">
          Vite production build
          <div>Served at /</div>
        </Card>
        <Card label="API SERVICE" title="Node process">
          Express server
          <div>Requests routed at /api</div>
        </Card>
        <Card label="DATA" title="PostgreSQL">
          Connection supplied through environment configuration
          <div>Health check: /api/healthz</div>
        </Card>
      </div>
      <div className="mt-[3vh] border border-accent/50 bg-soft p-[1.5vw]">
        <div className="font-mono text-[1.5vw] uppercase tracking-[0.12em] text-[#718096]">VERIFIED DEPLOYMENT</div>
        <div className="mt-[0.7vh] break-all font-display text-[2.35vw] font-bold text-primary">https://al-manaratain-qc-system.replit.app</div>
        <div className="mt-[0.7vh] text-[1.7vw] text-muted">Replit Autoscale · public · successful build reported during this review</div>
      </div>
      <Note>GitHub remote is configured. An automated CI/CD trigger was not confirmed and is not shown as an established deployment step.</Note>
    </ManagementSlide>
  );
}
