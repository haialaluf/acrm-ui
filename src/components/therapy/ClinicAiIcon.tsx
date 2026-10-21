import { createLucideIcon } from "lucide-react";

// Building2 and Sparkle shrunk onto one 24px grid; strokes are scaled up
// to match the line weight of other icons.
const BUILDING = {
  transform: "translate(0 8.6) scale(.62)",
  strokeWidth: "3.2",
};
const SPARKLE = { transform: "translate(11.5 0) scale(.5)", strokeWidth: "4" };

const ClinicAiIcon = createLucideIcon("ClinicAi", [
  ["path", { d: "M10 12h4", ...BUILDING, key: "b1" }],
  ["path", { d: "M10 8h4", ...BUILDING, key: "b2" }],
  ["path", { d: "M14 21v-3a2 2 0 0 0-4 0v3", ...BUILDING, key: "b3" }],
  [
    "path",
    {
      d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
      ...BUILDING,
      key: "b4",
    },
  ],
  [
    "path",
    { d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16", ...BUILDING, key: "b5" },
  ],
  [
    "path",
    {
      d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
      ...SPARKLE,
      key: "s1",
    },
  ],
]);

export default ClinicAiIcon;
