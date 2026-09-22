import { Bullet, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide3() {
  return (
    <SlideFrame>
      <SlideHeader section="Project Overview" number="03 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Operating Context</SlideTitle>
        <div className="mt-[8vh] grid grid-cols-2 gap-x-[7vw] gap-y-[7vh]">
          <div className="border-t-2 border-primary pt-[2vh]">
            <div className="mb-[1.5vh] font-mono text-[1.5vw] text-[#718096]">01</div>
            <Bullet number="">Quality checks span multiple materials and test types</Bullet>
          </div>
          <div className="border-t-2 border-primary pt-[2vh]">
            <div className="mb-[1.5vh] font-mono text-[1.5vw] text-[#718096]">02</div>
            <Bullet number="">Inspectors need consistent fields and reference values</Bullet>
          </div>
          <div className="border-t-2 border-primary pt-[2vh]">
            <div className="mb-[1.5vh] font-mono text-[1.5vw] text-[#718096]">03</div>
            <Bullet number="">Managers need current records, statuses, and reports</Bullet>
          </div>
          <div className="border-t-2 border-primary pt-[2vh]">
            <div className="mb-[1.5vh] font-mono text-[1.5vw] text-[#718096]">04</div>
            <Bullet number="">Administrators need control over access and master data</Bullet>
          </div>
        </div>
      </div>
      <SlideFooter label="Project Overview / Operating Context" number="03" />
    </SlideFrame>
  );
}