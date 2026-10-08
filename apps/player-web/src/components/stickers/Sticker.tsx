import { stickerInfo } from "../../config/stickers";

type Props = {
  /** A sticker id from the server, e.g. "week-2026-41". */
  id: string;
  /** Width and height in CSS pixels. */
  size?: number;
  className?: string;
};

/** One sticker, drawn from the catalogue in config/stickers.ts. */
export default function Sticker({ id, size = 48, className = "" }: Props) {
  const info = stickerInfo(id);
  return (
    <img
      src={info.src}
      alt={info.alt}
      title={info.alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`inline-block select-none drop-shadow-[0_2px_0_var(--color-edge)] ${className}`}
    />
  );
}

export { Sticker };
