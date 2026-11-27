const { TestEnvironment } = require("jest-environment-node");

class MongoSafeNodeEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    // Avoid Jest VM realm mismatch with Node Buffer / Uint8Array / Map used by MongoDB BSON driver
    this.global.Uint8Array = Uint8Array;
    this.global.ArrayBuffer = ArrayBuffer;
    this.global.DataView = DataView;
    this.global.Map = Map;
    this.global.Set = Set;
  }
}

module.exports = MongoSafeNodeEnvironment;
