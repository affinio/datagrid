import "pinia"

declare module "pinia" {
  // Extend Pinia option store for persistedstate plugin config.
  export interface DefineStoreOptionsBase<S, Store> {
    persist?:
      | boolean
      | {
          key?: string
          storage?: Storage
          paths?: string[]
        }
  }
}
