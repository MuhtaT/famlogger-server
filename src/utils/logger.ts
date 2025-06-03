import config from '@/config';

/* eslint-disable @typescript-eslint/no-explicit-any */
const levels: { [key: string]: number } = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const currentLevel = levels[config.logLevel] ?? levels.info;

const log = (level: string, message: string, ...args: any[]) => {
  if (levels[level] <= currentLevel) {
    const timestamp = new Date().toISOString();
    // Используем console.log/error для стандартных потоков вывода
    const logFn = level === 'error' ? console.error : console.log;
    if (args.length > 0) {
        logFn(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    } else {
        logFn(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }
};

export const logger = {
  error: (message: string, ...args: any[]) => log('error', message, ...args),
  warn: (message: string, ...args: any[]) => log('warn', message, ...args),
  info: (message: string, ...args: any[]) => log('info', message, ...args),
  http: (message: string, ...args: any[]) => log('http', message, ...args),
  debug: (message: string, ...args: any[]) => log('debug', message, ...args),
};