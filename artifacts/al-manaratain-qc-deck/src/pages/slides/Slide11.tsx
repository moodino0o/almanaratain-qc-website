import { Bullet, SectionTag, SlideFooter, SlideFrame, SlideHeader, SlideTitle } from '../../components/SlideFrame';

export default function Slide11() {
  return (
    <SlideFrame>
      <SlideHeader section="Access and Governance" number="11 / 16" />
      <div className="absolute left-[5vw] right-[5vw] top-[16vh]">
        <SlideTitle>Employee Access</SlideTitle>
        <div className="mt-[7vh] grid grid-cols-2 gap-[6vw]">
          <div className="border border-line bg-soft px-[3vw] py-[4vh]">
            <SectionTag>Identity</SectionTag>
            <div className="font-display text-[3vw] font-black leading-[1.04] tracking-[-0.04em] text-primary">Registered employee</div>
            <p className="mt-[2vh] text-[1.9vw] leading-[1.35] text-muted">Registered employee ID and name</p>
            <div className="mt-[4vh] h-[1.2vh] w-[8vw] bg-accent" />
          </div>
          <div className="space-y-[2.7vh]">
            <Bullet number="01">Registered employee ID and name</Bullet>
            <Bullet number="02">Individual sign-in password</Bullet>
            <Bullet number="03">Technician, Managerial, Administrator, and Visitor roles</Bullet>
            <Bullet number="04">Active or inactive access status</Bullet>
            <Bullet number="05">Administrators can update the employee name</Bullet>
          </div>
        </div>
      </div>
      <SlideFooter label="Access and Governance / Employee Access" number="11" />
    </SlideFrame>
  );
}