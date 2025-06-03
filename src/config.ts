import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  logLevel: process.env.LOG_LEVEL || 'info',
};

if (!config.telegramBotToken) {
  // Эта проверка теперь важнее в telegram.service.ts, но оставим и здесь для раннего оповещения
  console.warn('WARNING: TELEGRAM_BOT_TOKEN is not set in .env file. Bot functionality will be impaired.');
}

export default config;