import { z } from 'zod';

// Для GET /getDuplicates
export const getDuplicatesQuerySchema = z.object({
  chatId: z.string().min(1, "chatId is required"),
  timeframe: z.preprocess( // Преобразуем строку в число
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().positive("timeframe must be a positive integer (seconds)")
  ).refine(val => val > 0, { message: "timeframe must be greater than 0" }),
  message: z.string().min(1, "message is required (URL encoded UTF-8 string)"),
});

// Для POST /sendMessage
export const sendMessageQuerySchema = z.object({
  chatId: z.string().min(1, "chatId is required"),
});

export const sendMessageBodySchema = z.object({
  message: z.string().min(1, "message is required (UTF-8 string)"),
});