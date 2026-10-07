import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide14() {
  return (
    <ManagementSlide section="Publishing" page="14" title="Published on Replit Autoscale">
      <div className="grid h-[43vh] grid-cols-3 gap-[1.3vw]">
        <Card label="SOURCE" title="GitHub remote">
          A GitHub source remote is configured for the repository.
          <div>Automated deployment trigger was not confirmed.</div>
        </Card>
        <Card label="BUILD" title="Two application services">
          Vite builds the browser UI; the Node.js service runs the Express API.
          <div>The API health endpoint is configured at /api/healthz.</div>
        </Card>
        <Card label="LIVE STATUS" title="Public deployment">
          Replit Autoscale deployment is listed as deployed with a successful build.
          <div>Deployment status verified during this review.</div>
        </Card>
      </div>
      <div className="mt-[3vh] border border-accent/50 bg-soft p-[1.5vw]">
        <div className="font-mono text-[1.5vw] uppercase tracking-[0.12em] text-[#718096]">CURRENT APPLICATION URL</div>
        <div className="mt-[1vh] break-all font-display text-[2.5vw] font-bold text-primary">https://al-manaratain-qc-system.replit.app</div>
      </div>
      <Note>Runtime configuration and database connection are supplied through environment settings; no credentials are included in the presentation.</Note>
    </ManagementSlide>
  );
}
