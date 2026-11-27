const app = require("./app");
const env = require("./config/env");
const { connectDatabase, disconnectDatabase } = require("./config/database");

let server;

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Closing server gracefully...`);
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    console.error("Graceful shutdown failed:", err.message);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    env.validateEnv();
    await connectDatabase();

    server = app.listen(env.port, () => {
      console.log(`3JATA Organic Powder API running on port ${env.port} (${env.nodeEnv})`);
    });

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("Server startup failed:", err.message);
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

startServer();
