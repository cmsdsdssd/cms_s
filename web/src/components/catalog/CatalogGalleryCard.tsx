import { memo, useCallback, useEffect, useRef } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { Card } from "@/components/ui/card";
import { NumberText } from "@/components/ui/number-text";
import { cn } from "@/lib/utils";

type CatalogGalleryCardProps = {
  id: string;
  model: string;
  imageUrl?: string | null;
  isSelected: boolean;
  materialBgClass: string;
  estimatedTotalPrice: number | null;
  estimatedWeight: { weight: number; deduction: number } | null;
  laborSell: number | null;
  onSelect: (id: string) => void;
  onOpenEdit: () => void;
  onPreviewImage: (imageUrl: string) => void;
};

function CatalogGalleryCardComponent({
  id,
  model,
  imageUrl,
  isSelected,
  materialBgClass,
  estimatedTotalPrice,
  estimatedWeight,
  laborSell,
  onSelect,
  onOpenEdit,
  onPreviewImage,
}: CatalogGalleryCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const canHoverRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const handleSelect = useCallback(() => onSelect(id), [onSelect, id]);

  const handleImageDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      if (imageUrl) onPreviewImage(imageUrl);
    },
    [imageUrl, onPreviewImage]
  );

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      canHoverRef.current = hoverQuery.matches;
      reduceMotionRef.current = motionQuery.matches;
    };
    update();
    hoverQuery.addEventListener("change", update);
    motionQuery.addEventListener("change", update);
    return () => {
      hoverQuery.removeEventListener("change", update);
      motionQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current || !cardRef.current || !rectRef.current || !pointerRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const card = cardRef.current;
      const rect = rectRef.current;
      const pointer = pointerRef.current;
      if (!card || !rect || !pointer) return;
      const clamp = (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value));
      const x = clamp((pointer.x - rect.left) / rect.width, 0, 1);
      const y = clamp((pointer.y - rect.top) / rect.height, 0, 1);
      const tiltX = clamp((y - 0.5) * -12, -6, 6);
      const tiltY = clamp((x - 0.5) * 12, -6, 6);
      card.style.setProperty("--tilt-x", `${tiltX}deg`);
      card.style.setProperty("--tilt-y", `${tiltY}deg`);
      card.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
      card.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);
      card.style.setProperty("--spot-opacity", "1");
      card.style.setProperty("--hovered", "1");
      card.style.setProperty("--shadow-alpha", "0.18");
    });
  }, []);

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!canHoverRef.current || reduceMotionRef.current) return;
      const card = cardRef.current;
      if (!card) return;
      rectRef.current = card.getBoundingClientRect();
      pointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    },
    [scheduleUpdate]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!canHoverRef.current || reduceMotionRef.current) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleUpdate();
    },
    [scheduleUpdate]
  );

  const handlePointerLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pointerRef.current = null;
    rectRef.current = null;
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
    card.style.setProperty("--spot-opacity", "0");
    card.style.setProperty("--hovered", "0");
    card.style.setProperty("--shadow-alpha", "0");
  }, []);

  const baseStyle: CSSProperties = {
    "--tilt-x": "0deg",
    "--tilt-y": "0deg",
    "--mx": "50%",
    "--my": "50%",
    "--spot-opacity": "0",
    "--hovered": "0",
    "--shadow-alpha": "0",
    "--spot-size": "140px",
  } as CSSProperties;

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative cursor-pointer overflow-hidden h-full flex flex-col min-w-0",
        "[transform:perspective(900px)_rotateX(var(--tilt-x))_rotateY(var(--tilt-y))_translateY(calc(-4px*var(--hovered)))]",
        "transition-[transform,box-shadow,filter] duration-200 ease-out will-change-transform",
        "[box-shadow:0_14px_32px_rgba(15,23,42,var(--shadow-alpha))]",
        materialBgClass,
        isSelected
          ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]/90"
          : "hover:opacity-90"
      )}
      style={baseStyle}
      onClick={handleSelect}
      onDoubleClick={onOpenEdit}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Card className="h-full flex flex-col overflow-hidden border-0 shadow-none bg-transparent">
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
        style={{
          opacity: "var(--hovered)",
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0))",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
        style={{
          opacity: "var(--spot-opacity)",
          backgroundImage:
            "radial-gradient(var(--spot-size) circle at var(--mx) var(--my), rgba(255,255,255,0.45), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 opacity-0 transition-opacity duration-200"
        style={{ opacity: "var(--hovered)" }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--panel)]/60 bg-[var(--panel)]/70 text-[var(--muted)] shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--panel)]/60 bg-[var(--panel)]/70 text-[var(--muted)] shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M13.5 6.5l4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      {isSelected ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 12.5l4 4 8-9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : null}
      <div
        className="relative aspect-square bg-gradient-to-br from-[var(--panel)] to-[var(--background)]"
        onDoubleClick={handleImageDoubleClick}
      >
        <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]">
          이미지
        </div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${model} 이미지`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="space-y-1 p-[clamp(0.55rem,0.45rem+0.45vw,0.8rem)] flex-1 min-w-0">
        <p className="text-[clamp(0.8rem,0.76rem+0.26vw,0.9rem)] font-semibold text-[var(--foreground)] truncate leading-tight">
          {model}
        </p>
        <div className="grid gap-1 text-[clamp(0.66rem,0.62rem+0.22vw,0.76rem)] [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] min-w-0">
          <div className="min-w-0">
            <p className="text-[clamp(0.56rem,0.52rem+0.18vw,0.66rem)] font-semibold uppercase tracking-wider text-[var(--muted)] mb-0.5 leading-tight">
              예상 총 금액
            </p>
            <p className="font-semibold text-[var(--foreground)] truncate leading-tight">
              {estimatedTotalPrice === null ? "-" : <NumberText value={estimatedTotalPrice} />} 원
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[clamp(0.56rem,0.52rem+0.18vw,0.66rem)] font-semibold uppercase tracking-wider text-[var(--muted)] mb-0.5 leading-tight">
              예상 중량 · 공임
            </p>
            <div className="grid grid-cols-2 gap-2 text-[var(--foreground)] font-semibold leading-tight">
              <span className="truncate">
                {estimatedWeight ? (
                  <>
                    <NumberText value={estimatedWeight.weight} />g
                    {estimatedWeight.deduction > 0 ? (
                      <span className="ml-1 text-[var(--muted)]">
                        (-<NumberText value={estimatedWeight.deduction} />)
                      </span>
                    ) : null}
                  </>
                ) : (
                  "-"
                )}
              </span>
              <span className="truncate text-right">
                {laborSell === null ? "-" : <NumberText value={laborSell} />} 원
              </span>
            </div>
          </div>
        </div>
      </div>
      </Card>
    </div>
  );
}

export const CatalogGalleryCard = memo(CatalogGalleryCardComponent);
