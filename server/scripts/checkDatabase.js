// Read-only preflight: no models are imported and no indexes or accounts are changed.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before checking database access');
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, autoIndex: false, autoCreate: false,
  });
  await mongoose.connection.db.command({ ping: 1 });
  const admin = await mongoose.connection.db.collection('users').findOne({ role: 'superadmin', status: 'approved' }, { projection: { _id: 1 } });
  const hello = await mongoose.connection.db.command({ hello: 1 });
  console.log(JSON.stringify({ reachable: true, approvedSuperAdminExists: !!admin, supportsTransactions: !!(hello.setName || hello.msg === 'isdbgrid') }));
} catch (error) {
  console.error('Database preflight failed; check credentials, DNS and the MongoDB network allowlist.', error.name);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
