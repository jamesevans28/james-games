import type React from "react";
import { avatarFor } from "../../config/avatars";

/**
 * A player's avatar: one face from `src/config/avatars.ts` on a coloured disc
 * with a sticker outline. `user.avatar` is the stored 1-based number; old
 * sprite-sheet numbers wrap onto the current set.
 */

type UserLike = { avatar?: number | string | null } | null | undefined;

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
  user,
  size = 64,
  className = "",
  rounded = true,
  borderWidth = 3,
  borderColor = "var(--color-edge)",
  strokeWidth = 0,
  strokeColor = "var(--color-edge)",
  title,
}) => {
  const avatar = avatarFor(user?.avatar);
  return (
    <span
      role="img"
      aria-label={title || `${avatar.name} avatar`}
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? "9999px" : 12,
        background: avatar.background,
        border: borderWidth ? `${borderWidth}px solid ${borderColor}` : undefined,
        outline: strokeWidth ? `${strokeWidth}px solid ${strokeColor}` : undefined,
        boxSizing: "border-box",
      }}
    >
      <img src={avatar.src} alt="" draggable={false} className="block w-full h-full" />
    </span>
  );
};

export default ProfileAvatar;
