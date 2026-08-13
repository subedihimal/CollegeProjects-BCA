import app from './app.js';
import connectDB from './config/db.js';

const port = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(port, () =>
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`)
  );
};

startServer().catch((error) => {
  console.error(`Unable to start server: ${error.message}`);
  process.exitCode = 1;
});
