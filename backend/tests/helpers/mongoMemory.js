const mongoose = require("mongoose");
const { MongoMemoryServer, MongoMemoryReplSet } = require("mongodb-memory-server");

let mongoServer = null;

async function startTestDatabase({ replicaSet = false } = {}) {
  const connectOptions = {
    // Provide Node's `os` adapter explicitly so Jest's VM context doesn't fail on dynamic `import("os")`
    runtimeAdapters: { os: require("os") },
  };

  if (process.env.MONGODB_TEST_URI) {
    await mongoose.connect(process.env.MONGODB_TEST_URI, connectOptions);
    return;
  }

  mongoServer = replicaSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    : await MongoMemoryServer.create();

  const uri = mongoServer.getUri();
  await mongoose.connect(uri, connectOptions);
}

async function clearTestDatabase() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

async function stopTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

module.exports = {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
};
