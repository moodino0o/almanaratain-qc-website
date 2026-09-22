import { Bullet, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide9() {
  return (
    <SlideFrame>
      <SlideHeader section="Product Surface" number="09 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Reports and Archive</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[1.1fr_0.9fr] gap-[7vw]">
          <div className="space-y-[3.2vh]">
            <Bullet number="01">Filterable reporting views for QC history</Bullet>
            <Bullet number="02">Archive access for completed or retired records</Bullet>
            <Bullet number="03">Print-ready record and complaint views</Bullet>
            <Bullet number="04">Historical information remains available for review</Bullet>
          </div>
          <div className="border-t-2 border-primary pt-[3vh]">
            <div className="font-display text-[4.8vw] font-black leading-none tracking-[-0.06em] text-primary">FIND</div>
            <div className="mt-[1vh] font-display text-[4.8vw] font-black leading-none tracking-[-0.06em] text-primary">REVIEW</div>
            <div className="mt-[1vh] font-display text-[4.8vw] font-black leading-none tracking-[-0.06em] text-primary">PRINT</div>
          </div>
        </div>
      </div>
      <SlideFooter label="Product Surface / Reports and Archive" number="09" />
    </SlideFrame>
  );
}