import crypto from 'node:crypto';
import { User } from './user.model.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export async function generateLenderCode() {
  for (let i = 0; i < 10; i++) {
    const code = Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
    if (!(await User.exists({ lenderCode: code }))) return code;
  }
  throw new Error('Could not generate a unique lender code');
}
