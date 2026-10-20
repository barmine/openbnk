interface ImportMetaEnv {
  readonly OPENBNK_CHANNEL: string
  readonly OPENBNK_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
