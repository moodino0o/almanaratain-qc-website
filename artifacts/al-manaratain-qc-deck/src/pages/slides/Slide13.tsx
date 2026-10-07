import { ManagementSlide, StepCard } from '../../components/ManagementSlide';

export default function Slide13() {
  return (
    <ManagementSlide section="Data Flow" page="13" title="Validation, calculation, persistence and reporting">
      <div className="grid h-[44vh] grid-cols-4 gap-[1vw]">
        <StepCard number="01 · ENTER" title="QC form" detail="Shared metadata plus test-specific measurements." />
        <StepCard number="02 · CHECK" title="Validation" detail="Form checks and server-side request validation." />
        <StepCard number="03 · DERIVE" title="Results" detail="Form calculations; selected standards are evaluated by the API." />
        <StepCard number="04 · STORE" title="Database" detail="PostgreSQL record, JSONB test details and reference data." />
      </div>
      <div className="mt-[2.8vh] grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-[1vw]">
        <div className="border border-line bg-soft p-[1.4vw] text-center text-[1.8vw] font-semibold text-primary">Record history & lookup</div>
        <div className="text-[2.2vw] text-accent">→</div>
        <div className="border border-line bg-white p-[1.4vw] text-center text-[1.8vw] font-semibold text-primary">Report view</div>
        <div className="text-[2.2vw] text-accent">→</div>
        <div className="border border-accent/50 bg-soft p-[1.4vw] text-center text-[1.8vw] font-semibold text-primary">Print / XLSX</div>
      </div>
      <div className="mt-[2vh] text-[1.7vw] leading-[1.2] text-muted">Files are kept in object storage; the database stores metadata and paths rather than embedding the file payload.</div>
    </ManagementSlide>
  );
}
