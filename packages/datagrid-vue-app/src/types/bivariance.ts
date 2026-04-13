export type DataGridBivariantCallback<TArgs extends readonly unknown[], TResult> = {
  bivarianceHack: (...args: TArgs) => TResult
}["bivarianceHack"]