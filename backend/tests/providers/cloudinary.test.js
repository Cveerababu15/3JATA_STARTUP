const { hasValidImageMagicBytes } = require("../../src/middleware/upload.middleware");

describe("Cloudinary & Image Upload Validation (Provider/Unit)", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("validates JPEG, PNG, and WebP magic bytes and rejects spoofed files", () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const validWebp = Buffer.from("RIFF1234WEBPxxxx");
    const fakePng = Buffer.from("NOT_A_REAL_PNG_FILE");

    expect(hasValidImageMagicBytes(validPng, "image/png")).toBe(true);
    expect(hasValidImageMagicBytes(validJpeg, "image/jpeg")).toBe(true);
    expect(hasValidImageMagicBytes(validWebp, "image/webp")).toBe(true);
    expect(hasValidImageMagicBytes(fakePng, "image/png")).toBe(false);
  });

  it("throws 503 when Cloudinary credentials are not configured", async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const cloudinaryService = require("../../src/services/cloudinary.service");
    await expect(
      cloudinaryService.uploadProductImageBuffer({
        buffer: Buffer.from("test"),
        productId: "prod-1",
        filename: "test.png",
      })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("uploads and deletes via Cloudinary SDK when configured", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
    process.env.CLOUDINARY_API_KEY = "demo-key";
    process.env.CLOUDINARY_API_SECRET = "demo-secret";

    const mockDestroy = jest.fn().mockResolvedValue({ result: "ok" });
    const mockUploadStream = jest.fn((opts, cb) => {
      const { Writable } = require("stream");
      return new Writable({
        write(chunk, enc, next) {
          next();
        },
        final(done) {
          cb(null, {
            secure_url: "https://res.cloudinary.com/demo/image/upload/v1/beetroot.png",
            public_id: `${opts.folder}/beetroot`,
            width: 800,
            height: 800,
            format: "png",
          });
          done();
        },
      });
    });

    jest.doMock("cloudinary", () => ({
      v2: {
        config: jest.fn(),
        uploader: {
          upload_stream: mockUploadStream,
          destroy: mockDestroy,
        },
      },
    }));

    const cloudinaryService = require("../../src/services/cloudinary.service");
    const uploadResult = await cloudinaryService.uploadProductImageBuffer({
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]),
      productId: "507f1f77bcf86cd799439011",
      filename: "beetroot.png",
    });

    expect(uploadResult.url).toContain("https://res.cloudinary.com/");
    expect(uploadResult.publicId).toContain("507f1f77bcf86cd799439011");

    const delResult = await cloudinaryService.deleteCloudinaryImage(uploadResult.publicId);
    expect(delResult).toEqual({ result: "ok" });
    expect(mockDestroy).toHaveBeenCalledWith(uploadResult.publicId, { resource_type: "image" });

    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });
});
