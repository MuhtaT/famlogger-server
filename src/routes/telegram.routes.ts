import { Router } from 'express';
import { TelegramController } from '@/controllers/telegram.controller';
import { TelegramService } from '@/services/telegram.service';

export default function createTelegramRoutes(telegramService: TelegramService): Router {
  const router = Router();
  const telegramController = new TelegramController(telegramService);

  router.get('/getDuplicates', telegramController.getDuplicates);
  router.post('/sendMessage', telegramController.sendMessage);

  return router;
}