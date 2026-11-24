import { z } from 'zod';
import { LocaleSchema, ThemeModeSchema } from './core';

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  avatarUrl: z.string().url().nullable().optional(),
  streakDays: z.number().int().nonnegative(),
  preferences: z.object({
    theme: ThemeModeSchema,
    locale: LocaleSchema,
    dailyGoal: z.number().int().min(5).max(500),
    interests: z.array(z.string().max(40)).default([]),
    onboardingCompleted: z.boolean().default(false),
  }),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const RegisterInputSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(80),
  locale: LocaleSchema.optional().default('ar'),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthSessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresInSec: z.number().int().positive(),
  user: UserProfileSchema,
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;

export const UpdateOnboardingInputSchema = z.object({
  interests: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  dailyGoal: z.number().int().min(5).max(200),
  locale: LocaleSchema.optional(),
  theme: ThemeModeSchema.optional(),
});
export type UpdateOnboardingInput = z.infer<typeof UpdateOnboardingInputSchema>;
