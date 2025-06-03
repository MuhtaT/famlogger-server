import { createApp } from '@/app';
import config from '@/config';
import { logger } from '@/utils/logger';
import { TelegramService } from '@/services/telegram.service';

async function startServer() {
  logger.info('Starting FamLogger server...');

  // 1. Инициализируем TelegramService (и Telegraf внутри него)
  // Этот конструктор теперь выбрасывает ошибку и завершает процесс, если токен не найден
  const telegramService = new TelegramService();

  // 2. Запускаем бота Telegraf (асинхронно)
  try {
    await telegramService.launchBot(); // launchBot теперь тоже завершит процесс при ошибке
  } catch (e) {
    // Эта ветка может быть не достигнута, если launchBot сам завершает процесс
    logger.error("Redundant catch: Failed to launch Telegram bot during server startup. Exiting.", e);
    process.exit(1);
  }

  // 3. Создаем Express приложение, передавая ему сервис
  const app = createApp(telegramService);

  // 4. Запускаем HTTP сервер
  const server = app.listen(config.port, () => {
    logger.info('-------------------------------------------------------');
    logger.info(`🚀 HTTP Server is running on port ${config.port}`);
    logger.info(`🔗 Base URL: http://localhost:${config.port}`);
    logger.info(`API endpoint example: http://localhost:${config.port}/api/v1/telegram/sendMessage`);
    logger.info(`Telegram Bot Token Loaded: ${config.telegramBotToken ? 'YES' : 'NO (CRITICAL - SHOULD HAVE EXITED)'}`);
    logger.info(`Log Level: ${config.logLevel}`);
    logger.info('-------------------------------------------------------');
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
      throw error;
    }
    switch (error.code) {
      case 'EACCES':
        logger.error(`Port ${config.port} requires elevated privileges.`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error(`Port ${config.port} is already in use.`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });


  // Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      // Сначала останавливаем Telegraf бота
      await telegramService.stopBot(signal);
      
      // Затем закрываем HTTP сервер
      server.close((err) => {
        if (err) {
          logger.error('Error during HTTP server close:', err);
          process.exit(1);
        }
        logger.info('HTTP server closed.');
        process.exit(0); // Успешное завершение
      });

      // Если сервер не закрылся за таймаут, принудительно выходим
      setTimeout(() => {
        logger.warn('Graceful shutdown timed out, forcing exit.');
        process.exit(1);
      }, 10000); // 10 секунд на закрытие
    });
  });
}

startServer().catch(error => {
  logger.error("Fatal error during server startup sequence:", error);
  process.exit(1);
});