import { TestType } from "@workspace/api-client-react";

export type RegisterSection =
  | "all"
  | "readymix"
  | "masonry"
  | "aggregate"
  | "precast"
  | "kerbstone";

export const REGISTER_SECTIONS: Array<{
  id: RegisterSection;
  label: string;
  href: string;
  testTypes: TestType[];
  defaultTestType: TestType;
}> = [
  {
    id: "all",
    label: "All Results",
    href: "/records",
    testTypes: Object.values(TestType),
    defaultTestType: TestType.Ready_Mix,
  },
  {
    id: "readymix",
    label: "ReadyMix",
    href: "/records/readymix",
    testTypes: [TestType.Ready_Mix],
    defaultTestType: TestType.Ready_Mix,
  },
  {
    id: "masonry",
    label: "Masonry",
    href: "/records/masonry",
    testTypes: [TestType.Blocks, TestType.Paving_Blocks],
    defaultTestType: TestType.Blocks,
  },
  {
    id: "aggregate",
    label: "Aggregate",
    href: "/records/aggregate",
    testTypes: [
      TestType.Sand_Sieve,
      TestType.Aggregate_Sieve,
      TestType["Flakiness_&_Elongation"],
    ],
    defaultTestType: TestType.Sand_Sieve,
  },
  {
    id: "precast",
    label: "Precast",
    href: "/records/precast",
    testTypes: [TestType.Precast],
    defaultTestType: TestType.Precast,
  },
  {
    id: "kerbstone",
    label: "Kerb Stone",
    href: "/records/kerb-stone",
    testTypes: [TestType.Kerb_Stone],
    defaultTestType: TestType.Kerb_Stone,
  },
];

export const registerSectionFromQuery = () => {
  const value = new URLSearchParams(window.location.search).get("section");
  return REGISTER_SECTIONS.find((section) => section.id === value);
};