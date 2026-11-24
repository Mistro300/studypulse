import { z } from 'zod';
import { LocaleSchema, ThemeModeSchema } from './core';

export const UpdatePreferencesInputSchema = z.object({
  theme: ThemeModeSchema.optional(),
  locale: LocaleSchema.optional(),
  dailyGoal: z.number().int().min(5).max(500).optional(),
  pushRemindersEnabled: z.boolean().optional(),
  pushRoomInvitesEnabled: z.boolean().optional(),
  reminderHourLocal: z.number().int().min(0).max(23).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesInputSchema>;

export const PushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(8).max(512),
    auth: z.string().min(8).max(512),
  }),
});
export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInputSchema>;

export const PushStatusResponseSchema = z.object({
  subscribed: z.boolean(),
  subscriptionCount: z.number().int().nonnegative(),
  vapidPublicKey: z.string().nullable(),
  pushRemindersEnabled: z.boolean(),
  pushRoomInvitesEnabled: z.boolean(),
  reminderHourLocal: z.number().int().min(0).max(23),
});
export type PushStatusResponse = z.infer<typeof PushStatusResponseSchema>;
