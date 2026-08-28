import { useState, type CSSProperties } from "react";

/**
 * Six hues at one lightness and chroma, so a column of tinted avatars reads as
 * one family rather than as six unrelated colours — the same rule the
 * `--step-*` tokens in `global.css` follow.
 */
const AVATAR_HUES = [152, 75, 292, 248, 20, 195];

/**
 * A stable hue for a contact/conversation, derived from its id so the same
 * record always gets the same colour. Callers that want the flat grey avatar
 * simply omit `hue`.
 */
export function avatarHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

const Avatar = ({
  src,
  fallback,
  size,
  className,
  hue,
}: {
  src?: string | null;
  fallback?: string | null;
  size: number;
  className: string;
  /** Tint the fallback circle with this hue (see `avatarHue`). Omit for the
   *  flat `bg-muted` look every other caller gets. */
  hue?: number | null;
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold uppercase ${
        hue != null ? "avatar-tint " : ""
      }${className}`}
      style={
        {
          width: size,
          height: size,
          overflow: "hidden",
          // `.avatar-tint` reads this and picks its own lightness per theme.
          ...(hue != null ? { "--avatar-hue": hue } : {}),
        } as CSSProperties
      }
    >
      {src && !imageError ? (
        <img
          src={src}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          alt="Avatar"
        />
      ) : (
        fallback
      )}
    </div>
  );
};

export default Avatar;
