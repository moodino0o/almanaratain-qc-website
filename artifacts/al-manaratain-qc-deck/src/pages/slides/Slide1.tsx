import { SlideFrame, SlideFooter, SlideHeader } from '../../components/SlideFrame';

const base = import.meta.env.BASE_URL;

export default function Slide1() {
  return (
    <SlideFrame>
      <SlideHeader section="Project Overview" number="01 / 16" />
      <div className="absolute bottom-[13vh] left-[5vw] right-[5vw] flex items-end justify-between gap-[4vw]">
        <div className="relative z-10 max-w-[58vw]">
          <div className="absolute -left-[2vw] top-[2.3vh] h-[5vh] w-[25vw] bg-primary/10" />
          <h1 className="relative font-display text-[6.8vw] font-black leading-[0.94] tracking-[-0.06em] text-primary">
            Al Manaratain
            <span className="block">Quality Control</span>
          </h1>
          <p className="mt-[5vh] max-w-[48vw] text-[1.8vw] font-medium leading-[1.35] text-muted">
            A controlled digital workspace for quality records, standards, complaints, and employee access.
          </p>
        </div>
        <div className="relative h-[34vh] w-[31vw] shrink-0 overflow-hidden border border-line bg-soft">
          <img src={`${base}qc-material-texture.png`} crossOrigin="anonymous" className="h-full w-full object-cover" alt="Construction quality-control material texture" />
          <div className="absolute inset-0 bg-primary/20" />
          <div className="absolute bottom-[2.5vh] left-[2vw] right-[2vw] border-t border-white/50 pt-[1.2vh] font-mono text-[1.5vw] text-white/90">
            MATERIAL / MEASURE / VERIFY
          </div>
        </div>
      </div>
      <div className="absolute right-[5vw] top-[12vh] text-right font-mono text-[1.5vw] leading-[2] text-muted">
        <div><span className="mr-[1vw] text-[#A0AEC0]">Project:</span>Al Manaratain QC</div>
        <div><span className="mr-[1vw] text-[#A0AEC0]">Scope:</span>Web application</div>
        <div><span className="mr-[1vw] text-[#A0AEC0]">Status:</span>Ready for publishing</div>
      </div>
      <SlideFooter label="Project Overview / Al Manaratain QC" number="01" />
    </SlideFrame>
  );
}