import { Request, Response, NextFunction } from 'express';
import { TelegramService } from '@/services/telegram.service';
import {
  getDuplicatesQuerySchema,
  sendMessageQuerySchema,
  sendMessageBodySchema
} from '@/utils/validators';
import { logger } from '@/utils/logger';

export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  // GET /getDuplicates?chatId=<ID>&timeframe=<seconds>&message=<URL_encoded_UTF8_string>
  public getDuplicates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // req.query содержит уже URL-декодированные значения
      const { chatId, timeframe, message: messageToCheck } = getDuplicatesQuerySchema.parse(req.query);

      logger.info(`Handling /getDuplicates: chatId=${chatId}, timeframe=${timeframe}s, decoded_message="${messageToCheck.substring(0,30)}..."`);

      // `messageToCheck` здесь уже должен быть в том виде, в котором он кешируется,
      // т.е. escapeHtml(toUtf8(originalMessage)) из вашего Lua.
      const isDuplicate = this.telegramService.checkDuplicate(chatId, messageToCheck, timeframe);

      res.status(200).json({ isDuplicate });

    } catch (error) {
      logger.error('Error in getDuplicates controller:', error);
      next(error);
    }
  };

  // POST /sendMessage?chatId=<ID>
  // Body: { message: string } // message - это уже экранированный HTML в UTF-8
  public sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { chatId } = sendMessageQuerySchema.parse(req.query);
      const { message: messageToSend } = sendMessageBodySchema.parse(req.body);

      logger.info(`Handling /sendMessage for chatId ${chatId}: "${messageToSend.substring(0,30)}..."`);

      // `messageToSend` уже должен быть в формате UTF-8 и с HTML-экранированием.
      const result = await this.telegramService.sendMessage(chatId, messageToSend, 'HTML');

      if (result.success && result.data) {
        logger.info(`Message sent successfully via controller to ${chatId}. Message ID: ${result.data.message_id}`);
        res.status(200).json({ success: true, data: result.data });
      } else {
        logger.warn(`Failed to send message via controller to ${chatId}: ${result.error} (Code: ${result.errorCode})`);
        // Отдаем 4xx/5xx в зависимости от типа ошибки, если это возможно определить,
        // но для простоты можно использовать 400 для всех ошибок API Telegram.
        // Telegram часто возвращает 400 для ошибок типа "chat not found", "bot blocked" etc.
        const statusCode = result.errorCode && result.errorCode >= 400 && result.errorCode < 500 ? result.errorCode : 400;
        res.status(statusCode).json({ success: false, error: result.error, errorCode: result.errorCode });
      }
    } catch (error) {
      logger.error('Error in sendMessage controller:', error);
      next(error);
    }
  };
}