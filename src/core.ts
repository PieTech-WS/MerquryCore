// src/core.ts
// (C)2026, CoraTech Workspace. All rights reserved. See LICENSE for details.

import type { AdapterType } from "./types";

type PlatformType = "node" | "vela";

type RuntimeRequire = (id: string) => any;

type ConfigLike = {
  init?: () => Promise<void> | void;
  read?: <T>(reader: (cfg: any) => T) => T;
  write?: <T>(writer: (cfg: any) => T) => Promise<T> | T;
  save?: () => Promise<void> | void;
};

type PlatformLibraries = {
  cache: any;
  config: ConfigLike;
  fetch: any;
  logger: any;
};

type CoreGlobalExtensions = typeof globalThis & {
  __merquryRequire?: RuntimeRequire;
  __merquryImport?: (id: string) => Promise<any>;
};

export interface CoreContext {
  platform: PlatformType;
  libs: PlatformLibraries;
  config: ConfigLike;
  cache: any;
  fetch: any;
  logger: any;
  adapterType: AdapterType;
  adapter: any;
}

export interface CoreInitOptions {
  platform?: PlatformType;
  adapter?: AdapterType;
  attachGlobal?: boolean;
}

declare global {
  // 兼容现有代码里直接使用 global.xxx 的写法
  // eslint-disable-next-line no-var
  var config: any;
  // eslint-disable-next-line no-var
  var cache: any;
  // eslint-disable-next-line no-var
  var logger: any;
  // eslint-disable-next-line no-var
  var adapter: any;
  // eslint-disable-next-line no-var
  var core: CoreContext | undefined;
}

const supportedAdapters: readonly AdapterType[] = ["napcat", "llonebot", "onebot"];

async function getNodeLibraries(): Promise<PlatformLibraries> {
  const [cacheModule, configModule, loggerModule] = await Promise.all([
    loadProjectModule("./Platform/node/cache"),
    loadProjectModule("./Platform/node/config"),
    loadProjectModule("./Platform/node/logger"),
  ]);

  let nodeFetchModule: any = {};
  try {
    nodeFetchModule = await loadProjectModule("./Platform/node/fetch");
  } catch {
    // node 平台 fetch 模块允许暂时为空实现
  }

  return {
    cache: cacheModule.default ?? cacheModule,
    config: (configModule.config ?? configModule.Config ?? configModule.default) as ConfigLike,
    fetch: nodeFetchModule,
    logger: loggerModule.default ?? loggerModule,
  };
}

function getRuntimeRequire(): RuntimeRequire | undefined {
  const g = globalThis as CoreGlobalExtensions;
  if (typeof g.__merquryRequire === "function") return g.__merquryRequire;

  const maybeRequire = (globalThis as any).require;
  if (typeof maybeRequire === "function") return maybeRequire as RuntimeRequire;

  return undefined;
}

async function importWithFallback(moduleId: string): Promise<any> {
  const g = globalThis as CoreGlobalExtensions;
  if (typeof g.__merquryImport === "function") {
    return g.__merquryImport(moduleId);
  }

  // QuickJS/不同运行时对动态 import 支持不一致：仅作为兜底方案
  try {
    const indirectEval = (globalThis as any).eval as ((code: string) => any) | undefined;
    if (!indirectEval) {
      throw new Error("eval is unavailable");
    }
    return await indirectEval(`import(${JSON.stringify(moduleId)})`);
  } catch {
    const importer = new Function("m", "return import(m);") as (m: string) => Promise<any>;
    return importer(moduleId);
  }
}

async function loadProjectModule(moduleId: string): Promise<any> {
  const req = getRuntimeRequire();
  if (req) {
    try {
      return req(moduleId);
    } catch {
      // 某些运行时没有 require 或路径解析不支持，继续走 import 兜底
    }
  }

  return importWithFallback(moduleId);
}

async function importSystemDeviceModule(): Promise<any> {
  const req = getRuntimeRequire();
  if (req) {
    try {
      return req("@system.device");
    } catch {
      // 快应用宿主若不通过 require 暴露，则继续尝试 import
    }
  }

  return importWithFallback("@system.device");
}

export async function isVelaPlatform(): Promise<boolean> {
  try {
    const mod = await importSystemDeviceModule();
    return !!mod;
  } catch {
    return false;
  }
}

export async function detectPlatform(): Promise<PlatformType> {
  return (await isVelaPlatform()) ? "vela" : "node";
}

export function isNodeJsPlatform(): boolean {
  const p = (globalThis as any).process;
  return !!(p && typeof p === "object" && p.versions && p.versions.node);
}

async function getVelaLibraries(): Promise<PlatformLibraries> {
  const [cacheModule, configModule, fetchModule, loggerModule] = await Promise.all([
    loadProjectModule("./Platform/vela/cache"),
    loadProjectModule("./Platform/vela/config"),
    loadProjectModule("./Platform/vela/fetch"),
    loadProjectModule("./Platform/vela/logger"),
  ]);

  return {
    cache: cacheModule.default ?? cacheModule,
    config: (configModule.config ?? configModule.Config ?? configModule.default) as ConfigLike,
    fetch: fetchModule.default ?? fetchModule,
    logger: loggerModule.default ?? loggerModule,
  };
}

export async function loadPlatformLibraries(platform?: PlatformType): Promise<{ platform: PlatformType; libs: PlatformLibraries }> {
  if (platform === "vela") {
    return { platform, libs: await getVelaLibraries() };
  }
  if (platform === "node") {
    return { platform, libs: await getNodeLibraries() };
  }

  // 默认优先走 vela，避免在快应用环境提前加载 node 侧库
  if (await isVelaPlatform()) {
    return { platform: "vela", libs: await getVelaLibraries() };
  }

  if (isNodeJsPlatform()) {
    return { platform: "node", libs: await getNodeLibraries() };
  }

  // 非标准运行时的兜底：仍尝试 node 实现，便于本地调试与测试环境运行
  return { platform: "node", libs: await getNodeLibraries() };
}

function resolveAdapterType(config: ConfigLike, options?: CoreInitOptions): AdapterType {
  const optionAdapter = options?.adapter;
  if (optionAdapter) return optionAdapter;

  if (typeof config.read === "function") {
    try {
      const fromConfig = config.read((cfg) => cfg?.adapter) as unknown;
      if (typeof fromConfig === "string" && (supportedAdapters as readonly string[]).includes(fromConfig)) {
        return fromConfig as AdapterType;
      }
    } catch {
      // 配置可能尚未初始化或不包含 adapter 字段，回退默认值
    }
  }

  return "napcat";
}

async function loadAdapter(adapterType: AdapterType): Promise<any> {
  switch (adapterType) {
    case "napcat":
      return loadProjectModule("./Adapters/napcat");
    case "llonebot":
    case "onebot":
      throw new Error(`Adapter "${adapterType}" is not implemented yet`);
    default:
      throw new Error(`Unsupported adapter: ${String(adapterType)}`);
  }
}

function attachGlobals(ctx: CoreContext): void {
  globalThis.config = ctx.config;
  globalThis.cache = ctx.cache;
  globalThis.fetch = ctx.fetch;
  globalThis.logger = ctx.logger;
  globalThis.adapter = ctx.adapter;
  globalThis.core = ctx;
}

export async function initCore(options: CoreInitOptions = {}): Promise<CoreContext> {
  const { platform, libs } = await loadPlatformLibraries(options.platform);

  if (typeof libs.config?.init === "function") {
    await libs.config.init();
  }

  const adapterType = resolveAdapterType(libs.config, options);
  const adapter = await loadAdapter(adapterType);

  const ctx: CoreContext = {
    platform,
    libs,
    config: libs.config,
    cache: libs.cache,
    fetch: libs.fetch,
    logger: libs.logger,
    adapterType,
    adapter,
  };

  if (options.attachGlobal !== false) {
    attachGlobals(ctx);
  }

  return ctx;
}

export default initCore;
