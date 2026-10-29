import { createLucideIcon } from "lucide-react";

// MessagesSquare (the session's conversation) and Sparkle shrunk onto one
// 24px grid, the way ClinicAiIcon pairs a building with the sparkle.
const BUBBLES = {
  transform: "translate(0 8.6) scale(.62)",
  strokeWidth: "3.2",
};
const SPARKLE = { transform: "translate(11.5 0) scale(.5)", strokeWidth: "4" };

const SessionAiIcon = createLucideIcon("SessionAi", [
  [
    "path",
    {
      d: "M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z",
      ...BUBBLES,
      key: "b1",
    },
  ],
  [
    "path",
    {
      d: "M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1",
      ...BUBBLES,
      key: "b2",
    },
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

export default SessionAiIcon;
