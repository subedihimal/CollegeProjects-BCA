import mongoose from 'mongoose';

let connectionPromise;

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(mongoUri)
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        conn.connection.once('disconnected', () => {
          connectionPromise = undefined;
        });
        return conn.connection;
      })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  return connectionPromise;
};

export default connectDB;
