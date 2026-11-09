import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, maxPoolSize: 10 });
  // Unique indexes must exist before concurrent instances start accepting writes.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  console.log('MongoDB connected');
}
