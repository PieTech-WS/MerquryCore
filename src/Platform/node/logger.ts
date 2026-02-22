// src/Platform/node/logger.ts
// (C)2026, CoraTech Workspace. All rights reserved. See LICENSE for details.

import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

type LogLevel = "log" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

class Logger {
  private logDirectory: string = resolve("logs");
  private logFilePath: string;

  // 定义日志级别的样式（Node 终端使用 ANSI 颜色）
  private styles: { [key in LogLevel]: string } = {
    log: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  };

  private readonly resetStyle = "\x1b[0m";

  constructor() {
    const startTime = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFilePath = resolve(this.logDirectory, `log-${startTime}.log`);

    void this.initializeLogDirectory();
  }

  private async initializeLogDirectory(): Promise<void> {
    try {
      await mkdir(this.logDirectory, { recursive: true });
      console.log("Log directory created successfully");
    } catch (err) {
      console.error("Failed to create log directory", err);
    }
  }

  public log(...args: any[]) {
    this.printAndStore("log", args);
  }

  public warn(...args: any[]) {
    this.printAndStore("warn", args);
  }

  public error(...args: any[]) {
    this.printAndStore("error", args);
  }

  private printAndStore(level: LogLevel, args: any[]) {
    const timestamp = new Date().toISOString();
    const style = this.styles[level];

    // 将所有参数序列化为字符串
    const message = args.map((arg) => this.safeStringify(arg)).join(" ");
    const entry: LogEntry = {
      timestamp,
      level,
      message,
    };

    const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;

    // 在控制台输出日志
    console.log(`${style}${line}${this.resetStyle}`);

    // 同步日志到文件（异步触发）
    void this.flushLogToFile(line);
  }

  private async flushLogToFile(logEntry: string): Promise<void> {
    try {
      await appendFile(this.logFilePath, `${logEntry}\n`, "utf-8");
    } catch (err) {
      console.error("Failed to write log to file", err);
    }
  }

  private safeStringify(obj: any): string {
    try {
      if (typeof obj === "string") return obj;
      return JSON.stringify(obj, null, 2); // 美化输出
    } catch {
      return "[Circular or Unsupported Object]";
    }
  }
}

const logger = new Logger();
export default logger;
