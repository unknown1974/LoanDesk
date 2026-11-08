import { HttpError } from '../utils/httpError.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`);
    return next(new HttpError(400, 'Validation failed', details));
  }
  req[source] = result.data;
  next();
};
