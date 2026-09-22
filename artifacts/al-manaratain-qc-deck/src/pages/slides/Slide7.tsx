import { SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide7() {
  return (
    <SlideFrame>
      <SlideHeader section="QC Workflows" number="07 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Assessment Engine</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[0.85fr_1.15fr] gap-[7vw]">
          <div className="border border-line bg-soft px-[3vw] py-[4vh]">
            <SectionTag>Review signal</SectionTag>
            <div className="font-display text-[5.5vw] font-black leading-none tracking-[-0.06em] text-primary">QC</div>
            <p className="mt-[2vh] text-[1.9vw] leading-[1.35] text-muted">
              Calculated results stay close to the submitted record.
            </p>
          </div>
          <div className="space-y-[4vh]">
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>01 / Strength</SectionTag><p className="text-[2vw] leading-[1.3] text-muted">Strength records are evaluated against configured standards</p></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>02 / Sieve</SectionTag><p className="text-[2vw] leading-[1.3] text-muted">Sieve records calculate passing mass from retained amounts</p></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>03 / Review</SectionTag><p className="text-[2vw] leading-[1.3] text-muted">Results are stored with the submitted QC record</p></div>
            <div className="border-t-2 border-primary pt-[2vh]"><SectionTag>04 / Visibility</SectionTag><p className="text-[2vw] leading-[1.3] text-muted">Status and calculated values remain visible during review</p></div>
          </div>
        </div>
      </div>
      <SlideFooter label="QC Workflows / Assessment Engine" number="07" />
    </SlideFrame>
  );
}