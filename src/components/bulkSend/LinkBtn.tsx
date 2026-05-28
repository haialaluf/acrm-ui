/** Small inline link-style button used for "select all", "clear", etc. */
export default function LinkBtn({
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
      className="text-[12px] text-primary bg-transparent border-none p-0 cursor-pointer"
    >
      {children}
    </button>
  );
}
