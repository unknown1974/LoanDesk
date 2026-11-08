import { z } from 'zod';

// 10-digit Indian mobile; strips spaces, dashes and +91 / 91 / 0 prefixes.
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'));

export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(100);
