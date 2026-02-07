import type { UiTableThemeTokens } from "./types";
/** Apply CSS custom properties for the given theme to a DOM element */
export declare function applyTableTheme(el: HTMLElement, tokens: UiTableThemeTokens): void;
/** Merge two token sets (useful for partial overrides) */
export declare function mergeThemeTokens(base: UiTableThemeTokens, override?: Partial<UiTableThemeTokens>): UiTableThemeTokens;
//# sourceMappingURL=utils.d.ts.map