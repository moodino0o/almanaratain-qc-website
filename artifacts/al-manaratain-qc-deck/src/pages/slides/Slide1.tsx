import { SlideFooter, SlideFrame, SlideHeader } from '../../components/SlideFrame';

const base = import.meta.env.BASE_URL;

export default function Slide1() {
  return (
    <SlideFrame>
      <SlideHeader section="Management Overview" number="01 / 25" />
      <div className="absolute right-[5vw] top-[13vh] w-[33vw]">
        <div className="overflow-hidden border border-line bg-soft">
          <img src={`${base}qc-material-texture.png`} crossOrigin="anonymous" className="h-[49vh] w-full object-cover" alt="Concrete texture used as an engineering material visual" />
        </div>
        <div className="mt-[1.5vh] font-mono text-[1.5vw] tracking-[0.14em] text-muted">MATERIAL / MEASURE / VERIFY</div>
      </div>
      <div className="absolute bottom-[17vh] left-[5vw] top-[18vh] flex w-[53vw] flex-col justify-center">
        <div className="mb-[2.2vh] font-mono text-[1.5vw] uppercase tracking-[0.16em] text-[#718096]">AL MANARATAIN QUALITY CONTROL</div>
        <h1 className="font-display text-[5.1vw] font-black leading-[0.95] tracking-[-0.06em] text-primary">
          Digital Testing
          <span className="block"> & Reporting</span>
          <span className="block text-accent">Application</span>
        </h1>
        <p className="mt-[3vh] max-w-[48vw] text-[2.1vw] leading-[1.25] text-muted">
          Technical Overview, Workflow, Calculations, Deployment & Future Development
        </p>
        <div className="mt-[4vh] flex items-center gap-[2vw] font-mono text-[1.6vw] text-muted">
          <span className="border border-line px-[1vw] py-[0.8vh]">WEB APPLICATION</span>
          <span className="border border-line px-[1vw] py-[0.8vh]">PREPARED FOR MANAGEMENT</span>
          <span className="text-accent">PUBLISHED</span>
        </div>
      </div>
      <SlideFooter label="AL MANARATAIN / QUALITY & CONTROL" number="01" />
    </SlideFrame>
  );
}
