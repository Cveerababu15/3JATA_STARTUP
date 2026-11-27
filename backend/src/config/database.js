const mongoose = require("mongoose");
const env = require("./env");

const READY_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const connectDatabase = async (uri = env.mongodbUri) => {
  if (!uri) {
    throw new Error("MONGODB_URI is required to connect to MongoDB");
  }

  await mongoose.connect(uri);
  if (!env.isTest) {
    console.log("MongoDB connected successfully");
  }
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

const getDatabaseState = () => {
  return READY_STATES[mongoose.connection.readyState] || "unknown";
};

const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseState,
  isDatabaseConnected,
};
