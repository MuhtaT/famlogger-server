import { Telegraf, Context } from 'telegraf';
import { Message } from 'telegraf/types';
import config from '@/config';
import { logger } from '@/utils/logger';

interface SentMessageCacheEntry {
  text: string;
  timestamp: number; // Unix timestamp в секундах
  chatId: string;
  messageId: number;
}

const MAX_CACHE_AGE_SECONDS = 5 * 60; // 5 минут для очистки кеша (время жизни записи в кеше)
const CACHE_CLEANUP_INTERVAL_MS = 60 * 1000; // Каждую минуту запускать очистку

export class TelegramService {
  public bot: Telegraf<Context>;
  private sentMessagesCache: SentMessageCacheEntry[] = [];
  private cacheCleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (!config.telegramBotToken) {
      logger.error('FATAL: TELEGRAM_BOT_TOKEN is not defined. Telegraf bot cannot start.');
      // Остановка процесса, если токен не задан, так как сервис без него бесполезен
      process.exit(1);
    }
    this.bot = new Telegraf(config.telegramBotToken);
    this.setupBotEventHandlers();
    this.startCacheCleanup();
  }

  private setupBotEventHandlers(): void {
    // Пример обработчика команды, если понадобится
    // this.bot.command('ping', (ctx) => ctx.reply(`Pong! Cache size: ${this.sentMessagesCache.length}`));

    this.bot.catch((err, ctx) => {
      logger.error(`Telegraf error for ${ctx.updateType} in chat ${ctx.chat?.id || 'N/A'}:`, err);
    });
  }

  public async launchBot(): Promise<void> {
    try {
      // ИСПРАВЛЕНИЕ: Не ждем завершения bot.launch(), так как он зависает в режиме polling
      // Вместо этого запускаем его асинхронно и проверяем статус
      logger.info('Starting Telegraf bot launch (non-blocking)...');
      
      // Запускаем бота без await - это позволит коду продолжить выполнение
      this.bot.launch().catch((error) => {
        logger.error('Telegraf bot launch failed:', error);
        process.exit(1);
      });

      // Даем небольшую задержку для инициализации
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('Telegraf bot launched successfully (polling mode, non-blocking).');
    } catch (error) {
      logger.error('Failed to launch Telegraf bot:', error);
      process.exit(1); // Критическая ошибка, если бот не запустился
    }
  }

  public async stopBot(signal?: string): Promise<void> {
    logger.info(`Stopping Telegraf bot... (Signal: ${signal || 'N/A'})`);
    this.bot.stop(signal); // Telegraf сам корректно остановит polling
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
    }
    logger.info('Telegraf bot stopped and cache cleanup timer cleared.');
  }

  public async sendMessage(
    chatId: string,
    text: string,
    parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
  ): Promise<{ success: boolean; data?: Message.TextMessage; error?: string; errorCode?: number }> {
    try {
      logger.debug(`Attempting to send message via Telegraf to ${chatId}: "${text.substring(0, 50)}..." (parse_mode: ${parseMode})`);
      const sentMessage = await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: parseMode,
      });

      if (sentMessage) {
        this.addToCache({
          text: text, // Кешируем текст, который БЫЛ ОТПРАВЛЕН в Telegram
          timestamp: sentMessage.date,
          chatId: String(sentMessage.chat.id),
          messageId: sentMessage.message_id,
        });
        logger.info(`Message sent to ${chatId}, ID: ${sentMessage.message_id}. Cached.`);
        return { success: true, data: sentMessage };
      } else {
        logger.warn(`Telegraf sendMessage to ${chatId} returned no message object unexpectedly.`);
        return { success: false, error: "Telegram API did not return a message object" };
      }
    } catch (error: any) {
      logger.error(`Error sending message to ${chatId} via Telegraf: ${error.message}. Description: ${error.description}`);
      const description = error.description || error.message || "Unknown error sending message";
      const errorCode = error.code; // Telegraf API errors often have a 'code'
      return { success: false, error: description, errorCode };
    }
  }

  private addToCache(entry: SentMessageCacheEntry): void {
    this.sentMessagesCache.push(entry);
    logger.debug(`Added to cache (msgId ${entry.messageId}): "${entry.text.substring(0,30)}...". Total entries: ${this.sentMessagesCache.length}`);
  }

  private cleanupCache(): void {
    const currentTime = Math.floor(Date.now() / 1000);
    const initialSize = this.sentMessagesCache.length;
    this.sentMessagesCache = this.sentMessagesCache.filter(
      (entry) => currentTime - entry.timestamp < MAX_CACHE_AGE_SECONDS
    );
    const removedCount = initialSize - this.sentMessagesCache.length;
    if (removedCount > 0) {
      logger.info(`Cache cleanup: Removed ${removedCount} old entries. Current size: ${this.sentMessagesCache.length}`);
    } else if (initialSize > 0) {
      logger.debug(`Cache cleanup: No entries removed. Current size: ${this.sentMessagesCache.length}`);
    }
  }

  private startCacheCleanup(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, CACHE_CLEANUP_INTERVAL_MS);
    logger.info(`Cache cleanup job scheduled to run every ${CACHE_CLEANUP_INTERVAL_MS / 1000} seconds. Max cache age: ${MAX_CACHE_AGE_SECONDS}s.`);
  }

  public checkDuplicate(chatId: string, messageTextToCheck: string, timeframeSeconds: number): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    logger.debug(`Checking duplicates for chat ${chatId}, timeframe ${timeframeSeconds}s, message: "${messageTextToCheck.substring(0,30)}..."`);
    logger.debug(`Current cache size: ${this.sentMessagesCache.length}. Cache entries for chat ${chatId}: ${this.sentMessagesCache.filter(e => e.chatId === chatId).length}`);

    for (const entry of this.sentMessagesCache) {
      if (entry.chatId === chatId) {
        // Сравниваем декодированный messageTextToCheck с кешированным entry.text
        // Оба должны быть в том же "чистом" формате, как они отправляются в Telegram.
        if (entry.text === messageTextToCheck) {
          if (currentTime - entry.timestamp <= timeframeSeconds) {
            logger.info(`Duplicate found in cache: Entry msgId ${entry.messageId} (time: ${entry.timestamp}), text: "${entry.text.substring(0,30)}...". Current time ${currentTime}. Match!`);
            return true;
          } else {
            logger.debug(`Text match for msgId ${entry.messageId} but too old: entry time ${entry.timestamp}, current time ${currentTime}, timeframe ${timeframeSeconds}s`);
          }
        }
      }
    }
    logger.info(`No duplicate found in cache for message "${messageTextToCheck.substring(0,30)}..." in chat ${chatId} within timeframe ${timeframeSeconds}s.`);
    return false;
  }

  // Метод для получения размера кеша, может быть полезен для /health эндпоинта
  public getCacheSize(): number {
    return this.sentMessagesCache.length;
  }
}