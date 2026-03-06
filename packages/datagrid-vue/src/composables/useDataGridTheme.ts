import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue"

export type DataGridTheme = "light" | "dark" | (string & {})

type DataGridThemeRef = Readonly<Ref<DataGridTheme>>

const DATA_GRID_THEME_KEY: InjectionKey<DataGridThemeRef> = Symbol("DATA_GRID_THEME")

export function provideDataGridTheme(theme: DataGridThemeRef): void {
  provide(DATA_GRID_THEME_KEY, theme)
}

export function useDataGridTheme(): ComputedRef<DataGridTheme> {
  const fallbackTheme = ref<DataGridTheme>("light")
  const injectedTheme = inject<DataGridThemeRef>(DATA_GRID_THEME_KEY, fallbackTheme)
  return computed<DataGridTheme>(() => injectedTheme.value)
}
