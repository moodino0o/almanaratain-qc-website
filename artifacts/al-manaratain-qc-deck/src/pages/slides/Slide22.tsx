import { Card, ManagementSlide } from '../../components/ManagementSlide';

export default function Slide22() {
  return (
    <ManagementSlide section="Appendix B · Architecture" page="22" title="Application architecture and service boundaries">
      <div className="grid h-[47vh] grid-cols-4 gap-[1.1vw]">
        <Card label="PRESENTATION" title="React / Vite">
          TypeScript browser application
          <div>Records, dashboard, reports and administration</div>
        </Card>
        <Card label="API" title="Node.js / Express">
          REST endpoints under /api
          <div>Authentication, server validation and business evaluation</div>
        </Card>
        <Card label="DATABASE ACCESS" title="Drizzle ORM">
          Schema and query layer
          <div>PostgreSQL driver</div>
        </Card>
        <Card label="FILE OBJECTS" title="Object storage">
          Signed upload URLs
          <div>Metadata / object paths are held in PostgreSQL</div>
        </Card>
      </div>
      <div className="mt-[3vh] grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-[0.7vw] text-center text-[1.7vw] font-semibold text-primary">
        <div className="border border-line bg-soft p-[1.2vh]">Browser UI</div><div className="text-accent">→</div>
        <div className="border border-line bg-white p-[1.2vh]">Path-routed API</div><div className="text-accent">→</div>
        <div className="border border-line bg-soft p-[1.2vh]">Drizzle</div><div className="text-accent">→</div>
        <div className="border border-accent/50 bg-white p-[1.2vh]">PostgreSQL</div>
      </div>
      <div className="mt-[2.6vh] text-[1.7vw] leading-[1.2] text-muted">Report pages are rendered in the browser and printed; daily results also support XLSX download.</div>
    </ManagementSlide>
  );
}
