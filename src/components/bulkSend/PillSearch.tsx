import { Search, X } from "lucide-react";

/** Pill-shaped search input used at the top of the recipients and templates
 *  pickers. */
export default function PillSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center w-full rounded-full px-[14px] h-[40px] bg-incoming-chat-bubble">
      <Search className="text-muted-foreground w-[16px] h-[16px]" />
      <input
        className="bg-transparent outline-none border-none w-full h-full mx-[10px] text-[14px]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <X
          className="cursor-pointer text-muted-foreground w-[14px] h-[14px]"
          onClick={() => onChange("")}
        />
      )}
    </div>
  );
}
