// src/Platform/node/nodeConfig.ts
// (C)2026, CoraTech Workspace. All rights reserved. See LICENSE for details.
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { CoreConfig as AppConfig } from "../../types";

const CONFIG_PATH = resolve("config.json");



function defaultConfig(): AppConfig {
  return {
    napcat_httpserver_url: "",
    napcat_httpserver_token: "",
    noimgMode: true,
    dialogCount: 10,
    messageCount: 10,
    animationEnabled: false,
  };
}

class ConfigSystem {
  private config: AppConfig | null = null;

  async init(): Promise<void> {
    const exists = await this.exists(CONFIG_PATH);
    if (exists) {
      const text = await readFile(CONFIG_PATH, "utf-8");
      this.config = JSON.parse(text) as AppConfig;
    } else {
      this.config = defaultConfig();
      await this.persist(this.config);
    }
  }

  read<R>(f: (cfg: Readonly<AppConfig>) => R): R {
    if (!this.config) throw new Error("Config not initialized");
    return f(this.config);
  }

  async write<R>(f: (cfg: AppConfig) => R): Promise<R> {
    if (!this.config) throw new Error("Config not initialized");
    const result = f(this.config);
    await this.persist(this.config);
    return result;
  }

  async save(): Promise<void> {
    if (!this.config) throw new Error("Config not initialized");
    await this.persist(this.config);
  }

  private async persist(cfg: AppConfig): Promise<void> {
    const data = JSON.stringify(cfg, null, 2);
    await mkdir(dirname(CONFIG_PATH), { recursive: true });
    await writeFile(CONFIG_PATH, data, "utf-8");
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}

export const Config = new ConfigSystem();
export const config = Config;
