import { ManagementSlide, StepCard } from '../../components/ManagementSlide';

export default function Slide4() {
  return (
    <ManagementSlide section="Product Overview" page="04" title="What the application does">
      <div className="grid h-[39vh] grid-cols-4 gap-[1.25vw]">
        <StepCard number="01" title="Employee" detail="Signs in with an active employee account." />
        <StepCard number="02" title="QC record" detail="Selects a test type and enters sample details." />
        <StepCard number="03" title="Assessment" detail="Application validates values and calculates applicable results." />
        <StepCard number="04" title="Report" detail="Reviews, prints or exports the resulting QC information." />
      </div>
      <div className="mt-[3vh] grid grid-cols-[1.1fr_0.9fr] gap-[1.5vw]">
        <div className="border border-line bg-soft p-[1.5vw]">
          <div className="mb-[1vh] font-mono text-[1.5vw] uppercase tracking-[0.12em] text-[#718096]">CURRENT SCOPE</div>
          <div className="text-[2vw] leading-[1.25] text-primary">Test records · calculations · standards · dashboards · complaints · reports · document archive · employee access</div>
        </div>
        <div className="flex items-center border-l-[0.35vw] border-accent pl-[1.5vw] text-[2vw] font-semibold leading-[1.2] text-primary">
          Raw measurements become a traceable QC record and a consistent report view.
        </div>
      </div>
    </ManagementSlide>
  );
}
