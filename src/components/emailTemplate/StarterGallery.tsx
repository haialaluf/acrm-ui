import { Plus, Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { STARTERS, type Starter } from "./starters";

/** A wireframe of the layout, drawn in divs. Cheaper and sharper than six
 *  screenshots, and it cannot drift out of date the way an image would. */
function Thumb({ preview }: { preview: Starter["preview"] }) {
  if (preview === "blank") {
    return (
      <div className="w-[44px] h-[44px] m-auto rounded-[12px] border-[1.5px] border-dashed border-input text-muted-foreground flex items-center justify-center">
        <Plus size={22} />
      </div>
    );
  }

  const bar = "rounded-[2px] bg-[#e2e6e2]";
  const heading = "rounded-[2px] bg-[#c4cbc4]";
  const image =
    "rounded-[2px] bg-[repeating-linear-gradient(135deg,#dfe3df,#dfe3df_5px,#d6dbd6_5px,#d6dbd6_10px)]";

  return (
    <div className="w-[126px] min-h-[112px] mx-auto bg-white rounded-[4px] p-[8px] flex flex-col gap-[6px] shadow-sm">
      {preview === "hero" && <div className={`${image} h-[38px]`} />}
      {preview === "gallery" && (
        <div className="grid grid-cols-2 gap-[4px]">
          <div className={`${image} h-[20px]`} />
          <div className={`${image} h-[20px]`} />
        </div>
      )}
      {preview === "table" && <div className={`${image} h-[14px]`} />}

      <div className={`${heading} h-[8px] w-[70%]`} />
      <div className={`${bar} h-[5px]`} />
      <div className={`${bar} h-[5px] w-[60%]`} />

      {preview === "list" && (
        <>
          <div className={`${heading} h-[6px] w-[50%]`} />
          <div className={`${bar} h-[5px]`} />
        </>
      )}

      {preview !== "text" && (
        <div className="h-[14px] w-[56px] rounded-[7px] bg-primary mt-[2px]" />
      )}

      <div className="h-[9px] rounded-[2px] bg-[#eceee9] mt-auto" />
    </div>
  );
}

/**
 * "Start a new email" — the first screen of the create flow.
 *
 * A blank 600px body is a bad place to start for most people. None of these
 * carry the compliance footer — it is appended at send time and is not part of
 * the design, so nobody has to know it was required or keep it intact.
 */
export default function StarterGallery({
  onPick,
}: {
  onPick: (starter: Starter) => void;
}) {
  const { translate: t } = useTranslation();

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-[26px_30px_40px] bg-muted">
      <h2 className="m-0 text-[22px] font-semibold">
        {t("Start a new email")}
      </h2>
      <p className="mt-[5px] mb-[20px] text-[13.5px] text-muted-foreground max-w-[56ch]">
        {t(
          "Every layout is responsive and works right-to-left. The unsubscribe footer is added automatically to every send.",
        )}
      </p>

      <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(206px,1fr))]">
        {STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            className="text-start border border-border rounded-[14px] bg-popover overflow-hidden cursor-pointer transition-[border-color,transform] hover:border-primary hover:-translate-y-[2px]"
            onClick={() => onPick(starter)}
          >
            <div className="h-[158px] bg-[oklch(0.95_0.012_150)] flex items-start justify-center p-[16px] border-b border-border">
              <Thumb preview={starter.preview} />
            </div>
            <div className="p-[13px_15px]">
              <b className="block text-[14px] font-semibold mb-[3px]">
                {t(starter.name)}
              </b>
              <span className="text-[12px] text-muted-foreground leading-[1.5]">
                {t(starter.description)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-[8px] mt-[20px] text-[12.5px] text-muted-foreground">
        <Sparkles size={15} />
        {t(
          "You can also paste existing HTML once you are in the builder — it is parsed into editable blocks.",
        )}
      </div>
    </div>
  );
}
