import { ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide20() {
  return (
    <ManagementSlide section="Conclusion" page="20" title="From manual QC reporting to a digital quality platform" dark>
      <div className="flex h-[39vh] items-center justify-between gap-[1vw]">
        <div className="w-[19%] border border-white/25 p-[1.2vw] text-center text-[1.8vw] font-semibold text-white">MANUAL QC</div>
        <div className="text-[2.5vw] text-accent">→</div>
        <div className="w-[19%] border border-white/25 p-[1.2vw] text-center text-[1.8vw] font-semibold text-white">DIGITAL REPORTING</div>
        <div className="text-[2.5vw] text-accent">→</div>
        <div className="w-[19%] border border-white/25 p-[1.2vw] text-center text-[1.8vw] font-semibold text-white">CENTRALIZED DATA</div>
        <div className="text-[2.5vw] text-accent">→</div>
        <div className="w-[19%] border border-accent/60 bg-white/5 p-[1.2vw] text-center text-[1.8vw] font-semibold text-white">ANALYTICS</div>
      </div>
      <div className="mt-[2vh] max-w-[80vw] text-[2.15vw] leading-[1.3] text-white/85">
        The current application establishes a foundation for standardized digital QC testing and reporting. The next stage is to strengthen governance, security verification and analytics so the platform can support broader quality decisions.
      </div>
      <div className="mt-[2.4vh] font-mono text-[1.5vw] uppercase tracking-[0.14em] text-white/55">CURRENT PLATFORM · VERIFIED DEPLOYMENT · CLEAR NEXT STEPS</div>
    </ManagementSlide>
  );
}
