import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../hooks/useSession";

type UserLike = { avatar?: number | null } | null | undefined;

export interface ProfileAvatarProps {
  user?: UserLike; // optional override; if omitted the hook-provided user is used
  size?: number; // square size in px
  className?: string;
  rounded?: boolean; // rounded avatar by default
  borderWidth?: number; // inner ring width in px (between image and stroke)
  borderColor?: string; // inner ring color (default blue)
  strokeWidth?: number; // outer stroke width in px
  strokeColor?: string; // outer stroke color (default black)
  title?: string; // accessible label override
  // spritePadding: either a single number applied to all sides, or a per-side
  // object specifying { top, right, bottom, left } in pixels which matches
  // the padding present around the spritesheet image file. This is used to
  // compute the inner grid area for the 5x5 tiles and to compute the offset
  // into the image.
  spritePadding?: number | { top: number; right: number; bottom: number; left: number };
}

/**
 * Renders a user avatar from the 5x5 grid spritesheet at `/assets/shared/avatars.jpg`.
 * The user's `avatar` field is a 1-based index (1..25). Missing/invalid => 1.
 */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  user: userProp,
  size = 64,
  className = "",
  rounded = true,
  borderWidth = 4,
  borderColor = "#3b82f6",
  strokeWidth = 2,
  strokeColor = "#000",
  title,
  spritePadding = { top: 30, right: 25, bottom: 0, left: 25 },
}) => {
  const { user: sessionUser } = useSession();
  const user = userProp ?? (sessionUser as any);

  const rawIndex = typeof (user as any)?.avatar === "number" ? Number((user as any).avatar) : NaN;
  const index = Number.isFinite(rawIndex) && rawIndex >= 1 && rawIndex <= 25 ? rawIndex : 20;
  const zero = index - 1;
  const cols = 5;
  const col = zero % cols; // 0..4
  const row = Math.floor(zero / cols); // 0..4
  // Use a rounded-square corner (not a full circle). Use 8px radius when
  // `rounded` is true to produce a modern rounded-square avatar.
  const cornerRadius = rounded ? 8 : 0; // numeric px

  const ariaLabel = title || `User avatar ${index}`;
  // Spritesheet details
  const SPRITE_COLS = 5;
  const SPRITE_ROWS = 5;

  // Normalize spritePadding into per-side numbers
  const padding = useMemo(() => {
    if (typeof spritePadding === "number") {
      return {
        top: spritePadding,
        right: spritePadding,
        bottom: spritePadding,
        left: spritePadding,
      };
    }
    return {
      top: spritePadding?.top ?? 0,
      right: spritePadding?.right ?? 0,
      bottom: spritePadding?.bottom ?? 0,
      left: spritePadding?.left ?? 0,
    };
  }, [spritePadding]);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = "/assets/shared/avatars.jpg";
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setNatural(null);
  }, []);

  // Compute positioning and scaling once we know natural size
  const imgStyle = useMemo(() => {
    if (!natural) return { display: "none" } as React.CSSProperties;

    const innerW = Math.max(0, natural.w - (padding.left + padding.right));
    const innerH = Math.max(0, natural.h - (padding.top + padding.bottom));
    const tileW = innerW / SPRITE_COLS;
    const tileH = innerH / SPRITE_ROWS;

    // innerSize should account for the inner ring (borderWidth). The outer
    // stroke is drawn outside via `outline` so it doesn't reduce layout size.
    const innerSize = Math.max(0, size - borderWidth * 2);
    const scale = innerSize / Math.max(1, tileW);

    const offsetX = (padding.left + col * tileW) * scale;
    const offsetY = (padding.top + row * tileH) * scale;

    return {
      position: "absolute" as const,
      left: -offsetX,
      top: -offsetY,
      width: Math.round(natural.w * scale) + "px",
      height: Math.round(natural.h * scale) + "px",
      imageRendering: "auto" as any as any,
      maxWidth: "none",
      maxHeight: "none",
      display: "block",
    } as React.CSSProperties;
  }, [natural, col, row, size]);

  // radii for nested elements: outermost cornerRadius, inner ring radius,
  // and image container radius (subtracting ring width)
  const outerRadius = cornerRadius;
  const innerRingRadius = Math.max(0, outerRadius - strokeWidth);
  const imageRadius = Math.max(0, innerRingRadius - borderWidth);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: `${outerRadius}px`,
        overflow: "visible",
        position: "relative",
        // outer stroke drawn as an outline so it sits outside the box
        outline: `${strokeWidth}px solid ${strokeColor}`,
        outlineOffset: `-${strokeWidth}px`,
        display: "inline-block",
      }}
    >
      {/* inner colored ring */}
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          padding: borderWidth,
          borderRadius: `${innerRingRadius}px`,
          backgroundColor: borderColor,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* image container hides overflow and applies the innermost radius */}
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            borderRadius: `${imageRadius}px`,
            position: "relative",
            backgroundColor: "#f3f3f3",
          }}
        >
          <img ref={imgRef} src="/assets/shared/avatars.jpg" alt="" style={imgStyle} />
        </div>
      </div>
    </div>
  );
};

export default ProfileAvatar;
