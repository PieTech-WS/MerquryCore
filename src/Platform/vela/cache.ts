// src/Platform/vela/cache.ts
// (C)2026, CoraTech Workspace. All rights reserved. See LICENSE for details.

import storageFile from './utils/storage' // 根据实际路径调整

interface StorageCallback {
  success?: (data?: any) => void;
  fail?: (error?: any) => void;
  complete?: () => void;
  default?: any;
}

interface CacheParams extends StorageCallback {
  default?: any;
}

class CacheManager {
  // 默认缓存时间：1小时（毫秒）
  private readonly DEFAULT_CACHE_TIME: number = 60 * 60 * 1000;
  
  // 缓存键的前缀，用于区分普通存储和缓存
  private readonly CACHE_PREFIX: string = 'cache_';
  
  // 时间戳键的前缀
  private readonly TIMESTAMP_PREFIX: string = 'timestamp_';

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param cacheTime 缓存时间（毫秒），可选，默认1小时
   * @param param 回调参数对象，包含success, fail, complete等回调
   */
  set(key: string, value: any, cacheTime?: number, param?: StorageCallback): void {
    if (!param) param = {};
    
    const cacheKey: string = this.CACHE_PREFIX + key;
    const timestampKey: string = this.TIMESTAMP_PREFIX + key;
    
    const actualCacheTime: number = cacheTime || this.DEFAULT_CACHE_TIME;
    const timestamp: number = new Date().getTime();
    const expiryTime: number = timestamp + actualCacheTime;
    
    // 保存缓存数据
    storageFile.set({
      key: cacheKey,
      value: value,
      success: (): void => {
        // 保存时间戳
        storageFile.set({
          key: timestampKey,
          value: expiryTime,
          success: (): void => {
            if (param?.success) {
              param.success(value);
            }
          },
          fail: param?.fail,
          complete: param?.complete
        });
      },
      fail: param?.fail,
      complete: param?.complete
    });
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @param param 回调参数对象
   *   - success: 成功回调，参数为缓存值（如果缓存有效）
   *   - fail: 失败回调
   *   - complete: 完成回调
   *   - default: 默认值（当缓存不存在或过期时返回）
   */
  get(key: string, param?: CacheParams): void {
    if (!param) param = {};
    
    const cacheKey: string = this.CACHE_PREFIX + key;
    const timestampKey: string = this.TIMESTAMP_PREFIX + key;
    const currentTime: number = new Date().getTime();
    
    // 先获取时间戳检查是否过期
    storageFile.get({
      key: timestampKey,
      success: (expiryTime: any): void => {
        if (expiryTime && currentTime < parseInt(expiryTime)) {
          // 缓存未过期，获取缓存数据
          storageFile.get({
            key: cacheKey,
            success: (cachedData: any): void => {
              if (param?.success) {
                param.success(cachedData);
              }
              if (param?.complete) {
                param.complete();
              }
            },
            fail: param?.fail,
            complete: param?.complete,
            default: param?.default
          });
        } else {
          // 缓存已过期或不存在
          if (param?.success) {
            param.success(param?.default || null);
          }
          if (param?.complete) {
            param.complete();
          }
          // 可选：自动清理过期缓存
          this.delete(key);
        }
      },
      fail: (): void => {
        // 时间戳获取失败，返回默认值
        if (param?.success) {
          param.success(param?.default || null);
        }
        if (param?.complete) {
          param.complete();
        }
      },
      default: '0' // 默认过期时间为0（已过期）
    });
  }

  /**
   * 删除指定缓存
   * @param key 缓存键
   * @param param 回调参数对象
   */
  delete(key: string, param?: StorageCallback): void {
    if (!param) param = {};
    
    const cacheKey: string = this.CACHE_PREFIX + key;
    const timestampKey: string = this.TIMESTAMP_PREFIX + key;
    
    let deleteCount: number = 0;
    const totalToDelete: number = 2;
    const checkComplete = (): void => {
      deleteCount++;
      if (deleteCount >= totalToDelete && param?.complete) {
        param.complete();
      }
    };
    
    // 删除缓存数据
    storageFile.delete({
      key: cacheKey,
      success: (): void => {
        if (param?.success && deleteCount === 0) {
          param.success();
        }
        checkComplete();
      },
      fail: param?.fail,
      complete: checkComplete
    });
    
    // 删除时间戳
    storageFile.delete({
      key: timestampKey,
      success: (): void => {
        if (param?.success && deleteCount === 0) {
          param.success();
        }
        checkComplete();
      },
      fail: param?.fail,
      complete: checkComplete
    });
  }

  /**
   * 清理所有过期缓存
   * @param param 回调参数对象
   */
  clearExpired(param?: StorageCallback): void {
    if (!param) param = {};
    
    const currentTime: number = new Date().getTime();
    const expiredKeys: string[] = [];
    
    // 先获取所有数据来检查过期键
    storageFile.get({
      key: '', // 获取所有数据
      success: (allData: any): void => {
        if (!allData) {
          if (param?.success) param.success(0);
          if (param?.complete) param.complete();
          return;
        }
        
        // 查找所有时间戳键
        Object.keys(allData).forEach((key: string) => {
          if (key.startsWith(this.TIMESTAMP_PREFIX)) {
            const expiryTime: number = parseInt(allData[key]);
            if (currentTime >= expiryTime) {
              // 提取原始键名
              const originalKey: string = key.replace(this.TIMESTAMP_PREFIX, '');
              expiredKeys.push(originalKey);
            }
          }
        });
        
        // 删除所有过期缓存
        let deletedCount: number = 0;
        if (expiredKeys.length === 0) {
          if (param?.success) param.success(0);
          if (param?.complete) param.complete();
          return;
        }
        
        expiredKeys.forEach((key: string) => {
          this.delete(key, {
            success: (): void => {
              deletedCount++;
              if (deletedCount === expiredKeys.length && param?.success) {
                param.success(deletedCount);
              }
            },
            complete: (): void => {
              if (deletedCount === expiredKeys.length && param?.complete) {
                param.complete();
              }
            },
            fail: param?.fail
          });
        });
      },
      fail: param?.fail,
      complete: param?.complete
    });
  }

  /**
   * 清理所有缓存（包括未过期的）
   * @param param 回调参数对象
   */
  clearAll(param?: StorageCallback): void {
    if (!param) param = {};
    
    storageFile.get({
      key: '', // 获取所有数据
      success: (allData: any): void => {
        if (!allData) {
          if (param?.success) param.success();
          if (param?.complete) param.complete();
          return;
        }
        
        const cacheKeys: string[] = [];
        Object.keys(allData).forEach((key: string) => {
          if (key.startsWith(this.CACHE_PREFIX) || 
              key.startsWith(this.TIMESTAMP_PREFIX)) {
            cacheKeys.push(key);
          }
        });
        
        let deletedCount: number = 0;
        if (cacheKeys.length === 0) {
          if (param?.success) param.success();
          if (param?.complete) param.complete();
          return;
        }
        
        cacheKeys.forEach((key: string) => {
          storageFile.delete({
            key: key,
            success: (): void => {
              deletedCount++;
              if (deletedCount === cacheKeys.length && param?.success) {
                param.success();
              }
            },
            complete: (): void => {
              if (deletedCount === cacheKeys.length && param?.complete) {
                param.complete();
              }
            },
            fail: param?.fail
          });
        });
      },
      fail: param?.fail,
      complete: param?.complete
    });
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键
   * @param callback 回调函数，参数为boolean表示是否存在有效缓存
   */
  has(key: string, callback?: (exists: boolean) => void): void {
    this.get(key, {
      success: (data: any): void => {
        if (callback) {
          callback(data !== null && data !== undefined);
        }
      },
      fail: (): void => {
        if (callback) {
          callback(false);
        }
      }
    });
  }
}

const cacheManager: CacheManager = new CacheManager();

export default cacheManager;