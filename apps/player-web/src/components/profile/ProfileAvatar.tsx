import React, { useEffect, useState } from "react";

/**
 * ProfileAvatar (multi-spritesheet)
 * ---------------------------------
 * Renders a single avatar from a configurable list of sprite sheets.
 *
 * Configure once at app startup:
 *   setAvatarSheets([
 *     { file: "/assets/shared/avatars.png", cols: 8, rows: 8, tileSize: 64, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
 *     { file: "/assets/shared/avatars-extra.png", cols: 10, rows: 10, tileSize: 64, padding: { top: 4, right: 2, bottom: 4, left: 2 } },
 *   ]);
 *
 * Mapping: user.avatar is a 1-based global index spanning all sheets in order.
 * Example: if sheetA has 64 frames and sheetB has 100, then indices 1..64 map to A,
 * and 65..164 map to B.
 *
 * Background color: If user.avatarbackgroundcolor is provided, it becomes the inner
 * background behind the sprite. Else it defaults to #f3f3f3.
 */

export interface AvatarSheetMeta {
  file: string;
  cols: number;
  rows: number;
  tileSize: number; // recommended display size (px)
  padding: { top: number; right: number; bottom: number; left: number };
}

type UserLike =
  | { avatar?: number | null; avatarbackgroundcolor?: string | null }
  | null
  | undefined;

let avatarSheets: AvatarSheetMeta[] = [
  {
    file: "/assets/shared/avatars.jpg",
    cols: 5,
    rows: 5,
    tileSize: 185,
    padding: { top: 27, right: 0, bottom: 0, left: 17 },
  },
  {
    file: "/assets/shared/avatars.png",
    cols: 8,
    rows: 8,
    tileSize: 120,
    padding: { top: 11, right: 0, bottom: 10, left: 0 },
  },
];

export function setAvatarSheets(sheets: AvatarSheetMeta[]) {
  avatarSheets = Array.isArray(sheets) ? sheets.slice() : [];
}

export function addAvatarSheet(sheet: AvatarSheetMeta) {
  avatarSheets.push(sheet);
}

function resolveSheet(globalIndex: number): { sheet: AvatarSheetMeta | null; localIndex: number } {
  if (!avatarSheets.length) return { sheet: null, localIndex: 0 };
  let remaining = globalIndex;
  for (const meta of avatarSheets) {
    const count = meta.cols * meta.rows;
    if (remaining <= count) return { sheet: meta, localIndex: remaining - 1 };
    remaining -= count;
  }
  return { sheet: avatarSheets[0], localIndex: 0 }; // fallback
}

export interface ProfileAvatarProps {
  user?: UserLike;
  size?: number;
  className?: string;
  rounded?: boolean;
  borderWidth?: number;
  borderColor?: string;
  strokeWidth?: number;
  strokeColor?: string;
  title?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  user: userProp,
  size,
  className = "",
  rounded = true,
  borderWidth = 4,
  borderColor = "#3b82f6",
  strokeWidth = 2,
  strokeColor = "#000",
  title,
}) => {
  const user = userProp as any;
  const rawIndex = typeof user?.avatar === "number" ? Number(user.avatar) : NaN;
  const globalIndex = Number.isFinite(rawIndex) && rawIndex >= 1 ? rawIndex : 1;
  const { sheet, localIndex } = resolveSheet(globalIndex);

  if (!sheet) {
    const fallback = size || 64;
    return (
      <div
        role="img"
        aria-label={title || "User avatar placeholder"}
        className={className}
        style={{
          width: fallback,
          height: fallback,
          borderRadius: rounded ? 8 : 0,
          background: user?.avatarbackgroundcolor || "#f3f3f3",
          outline: `${strokeWidth}px solid ${strokeColor}`,
          outlineOffset: `-${strokeWidth}px`,
          display: "inline-block",
        }}
      />
    );
  }

  const { cols, padding, file, tileSize } = sheet;
  const displaySize = size || tileSize || 64;
  const col = localIndex % cols;
  const row = Math.floor(localIndex / cols);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.src = file;
    img.onload = () => active && setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => active && setNatural(null);
    return () => {
      active = false;
    };
  }, [file]);

  // Calculate scaling and positioning
  const contentSize = displaySize - borderWidth * 2;
  const scale = contentSize / tileSize;
  const sourceX = padding.left + col * tileSize;
  const sourceY = padding.top + row * tileSize;
  const offsetX = sourceX * scale;
  const offsetY = sourceY * scale;

  const cornerRadius = rounded ? 8 : 0;
  const outerRadius = cornerRadius;
  const innerRingRadius = Math.max(0, outerRadius - strokeWidth);
  const imageRadius = Math.max(0, innerRingRadius - borderWidth);
  const ariaLabel = title || `User avatar ${globalIndex}`;
  const bgColor = user?.avatarbackgroundcolor || "#f3f3f3";

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{
        width: displaySize,
        height: displaySize,
        borderRadius: `${outerRadius}px`,
        overflow: "visible",
        position: "relative",
        outline: `${strokeWidth}px solid ${strokeColor}`,
        outlineOffset: `-${strokeWidth}px`,
        display: "inline-block",
      }}
    >
      <div
        style={{
          width: displaySize,
          height: displaySize,
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: `${innerRingRadius}px`,
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: displaySize - borderWidth * 2,
            height: displaySize - borderWidth * 2,
            backgroundColor: bgColor,
            backgroundImage: natural ? `url(${file})` : undefined,
            backgroundSize: natural ? `${natural.w * scale}px ${natural.h * scale}px` : undefined,
            backgroundPosition: natural ? `-${offsetX}px -${offsetY}px` : undefined,
            backgroundRepeat: "no-repeat",
            imageRendering: "crisp-edges" as any,
            borderRadius: `${imageRadius}px`,
            overflow: "hidden",
            position: "relative",
          }}
        ></div>
      </div>
    </div>
  );
};

// Touch references to avoid unused local warnings under strict TS configs
void setAvatarSheets;
void addAvatarSheet;
void ProfileAvatar;

export default ProfileAvatar;
