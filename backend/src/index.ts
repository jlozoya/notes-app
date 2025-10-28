import "dotenv/config";
import { connectDB } from "./config/db";
import { createServer } from "./server";

(async () => {
  await connectDB();
  const srv = createServer();
  const port = await srv.start();
  console.log(`🚀 Server running on port ${port}`);
})();
