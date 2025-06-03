import express, { Application } from 'express';
import cors from 'cors';
import createTelegramRoutes from '@/routes/telegram.routes';
import { errorHandler } from '@/utils/errorHandler';
import { logger } from '@/utils/logger';
import { TelegramService } from '@/services/telegram.service';

export function createApp(telegramService: TelegramService): Application {
  const app: Application = express();

  // Middlewares
  app.use(cors()); // Разрешить CORS запросы (настройте более детально для продакшена)
  app.use(express.json({ limit: '1mb' })); // Для парсинга JSON тел запросов
  app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Для парсинга URL-encoded тел

  // Логирование HTTP запросов
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Routes
  app.use('/api/v1/telegram', createTelegramRoutes(telegramService));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(), // Время работы процесса в секундах
      cacheSize: telegramService.getCacheSize(), // Получаем размер кеша
    });
  });

  // Not found handler (после всех роутов)
  app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
  });

  // Global error handler (должен быть последним middleware)
  app.use(errorHandler);

  return app;
}