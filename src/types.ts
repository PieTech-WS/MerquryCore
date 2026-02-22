// src/types.ts
// (C)2026, CoraTech Workspace. All rights reserved. See LICENSE for details.

// 支持的适配器列表
export const SUPPORTED_ADAPTERS = ['napcat', 'llonebot', 'onebot'] as const;

// 适配器类型：只能为列表中的值
export type AdapterType = (typeof SUPPORTED_ADAPTERS)[number];

export interface AdapterConfig {
  [key: string]: any;
}

export interface CoreConfig {
  adapter: AdapterType;
  adapterConfig: AdapterConfig; // 适配器特定的配置，可以根据需要定义更具体的类型
}

