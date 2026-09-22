import { Bullet, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide12() {
  return (
    <SlideFrame>
      <SlideHeader section="Access and Governance" number="12 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Access Controls</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-[1fr_1fr] gap-[6vw]">
          <div className="space-y-[3.5vh]">
            <Bullet number="01">Server-side authorization protects administrative actions</Bullet>
            <Bullet number="02">Employee directory identity is tied to the registered employee ID</Bullet>
          </div>
          <div className="border-l-2 border-accent pl-[3vw]">
            <Bullet number="03">Administrator safeguards prevent removing the last active administrator</Bullet>
            <div className="mt-[5vh]">
              <Bullet number="04">Access changes are reflected in the current employee list</Bullet>
            </div>
          </div>
        </div>
        <div className="absolute -right-[5vw] top-[35vh] h-[22vh] w-[28vw] border border-primary/10 bg-primary/[0.03]" />
      </div>
      <SlideFooter label="Access and Governance / Access Controls" number="12" />
    </SlideFrame>
  );
}