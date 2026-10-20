export * as OpenBnkWorkerd from "./workerd"

import { Layer } from "effect"
import type { Config, Scope } from "effect"
import { WorkerdProfile } from "../internal/workerd"
import { OpenBnk } from "./openbnk"

export type Configuration = WorkerdProfile.Configuration

export interface CreateOptions<R = never> extends WorkerdProfile.Options {
  readonly log?: OpenBnk.CreateOptions["log"]
  readonly plugins?: OpenBnk.CreateOptions["plugins"]
  readonly workspaceProviders?: OpenBnk.CreateOptions["workspaceProviders"]
  readonly instances?: OpenBnk.CreateOptions<R>["instances"]
}

export const create = <R = never>({ log, plugins, workspaceProviders, instances, ...options }: CreateOptions<R>) => {
  const profile = WorkerdProfile.make(options)
  return OpenBnk.create(
    { ...profile.options, log, plugins, workspaceProviders, instances },
    { overrides: profile.replacements },
  )
}

export const layer = <R = never>(
  options: CreateOptions<R>,
): Layer.Layer<OpenBnk.Service, Config.ConfigError | Error, Exclude<R, Scope.Scope>> =>
  Layer.effect(OpenBnk.Service, create(options))

export type Interface = OpenBnk.Interface
export type Requirements = Scope.Scope
