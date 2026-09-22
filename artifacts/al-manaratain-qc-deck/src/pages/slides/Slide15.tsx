import { SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide15() {
  return (
    <SlideFrame>
      <SlideHeader section="Delivery" number="15 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Current Delivery Status</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[1fr_1fr] gap-[5vw]">
          <div className="bg-primary px-[3vw] py-[4vh] text-white">
            <SectionTag dark>Release readiness</SectionTag>
            <div className="font-display text-[4.4vw] font-black leading-[0.98] tracking-[-0.06em]">READY</div>
            <p className="mt-[3vh] text-[1.9vw] leading-[1.3] text-white/75">The project is ready for website publishing</p>
          </div>
          <div className="grid grid-cols-2 gap-x-[3vw] gap-y-[4vh]">
            <div className="border-t-2 border-primary pt-[1.5vh]"><SectionTag>01</SectionTag><div className="text-[1.8vw] leading-[1.25] text-muted">Web and API workflows are running</div></div>
            <div className="border-t-2 border-primary pt-[1.5vh]"><SectionTag>02</SectionTag><div className="text-[1.8vw] leading-[1.25] text-muted">API and web typechecks pass</div></div>
            <div className="border-t-2 border-primary pt-[1.5vh]"><SectionTag>03</SectionTag><div className="text-[1.8vw] leading-[1.25] text-muted">Frontend test suite passes with 23 tests</div></div>
            <div className="border-t-2 border-primary pt-[1.5vh]"><SectionTag>04</SectionTag><div className="text-[1.8vw] leading-[1.25] text-muted">Production web build passes</div></div>
          </div>
        </div>
      </div>
      <SlideFooter label="Delivery / Current Delivery Status" number="15" />
    </SlideFrame>
  );
}