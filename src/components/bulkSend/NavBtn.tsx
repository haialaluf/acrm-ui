/** Tiny round button used to step the per-contact preview in the review
 *  stage. */
export default function NavBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: 26,
        height: 26,
        background: "var(--background)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}
