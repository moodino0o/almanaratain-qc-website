import { Card, ManagementSlide, Note } from '../../components/ManagementSlide';

export default function Slide11() {
  return (
    <ManagementSlide section="Plant-specific Logic" page="11" title="Plant-specific rules stay scoped to their workflow">
      <div className="grid h-[46vh] grid-cols-3 gap-[1.4vw]">
        <Card label="HIDD" title="Existing Block workflow">
          Existing non-Dammam air-dry basis and configured standards remain in effect.
        </Card>
        <Card label="KHAMIS" title="Existing Block workflow" soft>
          Dammam-specific area deductions do not change this plant’s behavior.
        </Card>
        <Card label="DAMMAM" title="Net / gross basis">
          Editable face and web thickness; configured hole count; net area and net strength.
        </Card>
      </div>
      <div className="mt-[3vh] flex items-center justify-center gap-[1vw] text-[1.8vw] font-semibold text-primary">
        <span className="border border-line px-[1.2vw] py-[1vh]">SELECTED LOCATION</span>
        <span className="text-accent">→</span>
        <span className="border border-accent/50 bg-soft px-[1.2vw] py-[1vh]">LOCATION-SPECIFIC RULE</span>
        <span className="text-accent">→</span>
        <span className="border border-line px-[1.2vw] py-[1vh]">RELEVANT QC RESULT</span>
      </div>
      <Note>Current code confines the new Dammam geometry and report basis to Dammam; other plant workflows remain separate.</Note>
    </ManagementSlide>
  );
}
