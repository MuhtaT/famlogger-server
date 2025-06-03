import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Логируем все детали ошибки
  logger.error(
    `Error during request ${req.method} ${req.path}: ${err.message}`,
    {
      stack: err.stack,
      name: err.name,
      // Можно добавить больше контекста из req, если нужно
      // query: req.query,
      // body: req.body, // Осторожно с логированием тела, может содержать PII
    }
  );

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.flatten().fieldErrors, // Более удобный формат ошибок Zod
    });
  }

  // Обработка других известных типов ошибок (если будут)
  // if (err instanceof SomeCustomError) {
  //   return res.status(err.statusCode || 500).json({ message: err.message });
  // }

  // Если заголовки уже были отправлены, передаем ошибку стандартному обработчику Express
  if (res.headersSent) {
    return next(err);
  }

  // Общая ошибка сервера
  res.status(500).json({
    message: 'Internal Server Error',
    // В режиме разработки можно выводить сообщение об ошибке клиенту
    errorDetails: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};