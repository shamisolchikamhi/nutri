import type { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGES = {
  recipe: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600",
  product: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600",
  snack: "https://images.unsplash.com/photo-1547592180-85f173990554?w=600",
};

type ContentImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  kind: keyof typeof FALLBACK_IMAGES;
};

export function ContentImage({ src, kind, alt, className, onError, ...props }: ContentImageProps) {
  const fallback = FALLBACK_IMAGES[kind];
  return (
    <img
      {...props}
      src={src || fallback}
      alt={alt}
      className={cn("object-cover", className)}
      onError={(event) => {
        onError?.(event);
        event.currentTarget.onerror = null;
        event.currentTarget.src = fallback;
      }}
    />
  );
}
