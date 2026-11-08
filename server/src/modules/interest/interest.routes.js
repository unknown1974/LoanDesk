import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { calculateInterestPaise, periodBounds } from './interest.engine.js';
import { startOfDayUTC } from '../../utils/dates.js';

const router = Router();

// Stateless calculator: shows interest for the first N months of a hypothetical loan.
router.post(
  '/calculate',
  validate(
    z.object({
      principalPaise: z.number().int().positive(),
      monthlyRateBps: z.number().int().min(0).max(10000),
      method: z.enum(['monthly', 'daily']).default('monthly'),
      startDate: z.coerce.date().transform(startOfDayUTC),
      months: z.number().int().min(1).max(60).default(12),
    })
  ),
  (req, res) => {
    const { principalPaise, monthlyRateBps, method, startDate, months } = req.body;
    const rows = [];
    for (let i = 0; i < months; i++) {
      const { periodStart, periodEnd } = periodBounds(startDate, i);
      rows.push({ periodStart, periodEnd, interestPaise: calculateInterestPaise({ principalPaise, rateBps: monthlyRateBps, periodStart, periodEnd, method }) });
    }
    res.json({ rows, totalPaise: rows.reduce((s, r) => s + r.interestPaise, 0) });
  }
);

export default router;
