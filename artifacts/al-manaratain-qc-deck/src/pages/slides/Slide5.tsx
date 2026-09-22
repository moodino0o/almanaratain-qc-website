import { SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide5() {
  return (
    <SlideFrame>
      <SlideHeader section="QC Workflows" number="05 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>QC Record Workflows</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[1.2fr_0.8fr] gap-[7vw]">
          <div className="grid grid-cols-2 gap-x-[4vw] gap-y-[4vh]">
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>01</SectionTag><div className="font-display text-[2.4vw] font-bold text-primary">Ready Mix</div></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>02</SectionTag><div className="font-display text-[2.4vw] font-bold text-primary">Blocks</div></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>03</SectionTag><div className="font-display text-[2.4vw] font-bold text-primary">Paving Blocks</div></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>04</SectionTag><div className="font-display text-[2.4vw] font-bold text-primary">Sand Sieve</div></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>05</SectionTag><div className="font-display text-[2.4vw] font-bold text-primary">Aggregate Sieve</div></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>06</SectionTag><div className="font-display text-[2.4vw] font-bold text-primary">Water</div></div>
          </div>
          <div className="border border-line bg-soft px-[3vw] py-[4vh]">
            <p className="text-[2vw] font-medium leading-[1.35] text-muted">
              Each workflow captures the fields and specimen details needed for its test type.
            </p>
            <div className="mt-[7vh] h-[1.2vh] w-[9vw] bg-accent" />
          </div>
        </div>
      </div>
      <SlideFooter label="QC Workflows / Record Types" number="05" />
    </SlideFrame>
  );
}