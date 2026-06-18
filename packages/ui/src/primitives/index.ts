// Barrel des primitives visuelles @repo/ui (Story 1.3).
// Chaque primitive est un export NOMMÉ + son type de props. Ré-exporté par ../index.ts
// (barrière `.`) → la vitrine importe `import { Button, type AxisProps, ... } from "@repo/ui"`.
export { Button } from "./Button/Button";
export type { ButtonProps } from "./Button/Button";

export { Losanges } from "./Losanges/Losanges";

export { Eyebrow } from "./Eyebrow/Eyebrow";
export type { EyebrowProps } from "./Eyebrow/Eyebrow";

export { LinkArrow } from "./LinkArrow/LinkArrow";
export type { LinkArrowProps } from "./LinkArrow/LinkArrow";

export { Tag } from "./Tag/Tag";
export type { TagProps } from "./Tag/Tag";

export { PhotoFrame } from "./PhotoFrame/PhotoFrame";
export type { PhotoFrameProps } from "./PhotoFrame/PhotoFrame";

export { Sticker } from "./Sticker/Sticker";
export type { StickerProps } from "./Sticker/Sticker";

export { Brush } from "./Brush/Brush";
export type { BrushProps } from "./Brush/Brush";

export { CrownWatermark } from "./CrownWatermark/CrownWatermark";
export type { CrownWatermarkProps } from "./CrownWatermark/CrownWatermark";

export { Axis } from "./Axis/Axis";
export type { AxisProps } from "./Axis/Axis";
