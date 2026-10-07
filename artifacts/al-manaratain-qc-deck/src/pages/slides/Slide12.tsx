import { Card, ManagementSlide } from '../../components/ManagementSlide';

export default function Slide12() {
  return (
    <ManagementSlide section="Architecture" page="12" title="A browser application backed by an API and PostgreSQL">
      <div className="grid h-[47vh] grid-cols-4 gap-[1vw]">
        <Card label="USER" title="Web browser">
          Employee login and QC screens
        </Card>
        <Card label="FRONT END" title="React + TypeScript">
          Vite-built static application
        </Card>
        <Card label="API" title="Node.js + Express">
          Auth, records, validation and reporting data
        </Card>
        <Card label="PERSISTENCE" title="PostgreSQL">
          Drizzle ORM; object storage for files
        </Card>
      </div>
      <div className="mt-[3vh] grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-[0.7vw] text-center">
        <div className="border border-line bg-white px-[0.8vw] py-[1.3vh] text-[1.7vw] font-semibold text-primary">Browser</div><div className="text-[2vw] text-accent">→</div>
        <div className="border border-line bg-soft px-[0.8vw] py-[1.3vh] text-[1.7vw] font-semibold text-primary">Static app</div><div className="text-[2vw] text-accent">→</div>
        <div className="border border-line bg-white px-[0.8vw] py-[1.3vh] text-[1.7vw] font-semibold text-primary">/api service</div><div className="text-[2vw] text-accent">→</div>
        <div className="border border-accent/50 bg-soft px-[0.8vw] py-[1.3vh] text-[1.7vw] font-semibold text-primary">PostgreSQL</div>
      </div>
      <div className="mt-[2.4vh] grid grid-cols-2 gap-[1.2vw]">
        <div className="border border-line p-[1.1vw] text-[1.7vw] leading-[1.2] text-muted">UI reports use application views and browser print; daily result export is generated as an .xlsx file.</div>
        <div className="border border-line p-[1.1vw] text-[1.7vw] leading-[1.2] text-muted">Files use object-storage upload URLs; records retain the related object path and metadata.</div>
      </div>
    </ManagementSlide>
  );
}
