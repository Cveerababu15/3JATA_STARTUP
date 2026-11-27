const mongoose = require("mongoose");

/**
 * Parses pagination query parameters safely and enforces upper bounds
 * so callers cannot request unbounded page sizes.
 */
function parsePagination(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit || 12;
  const maxLimit = options.maxLimit || 100;

  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function buildPaginationMeta({ page, limit, total }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / limit);

  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
  };
}

/**
 * Resolves a query sort key strictly through an explicit allowlist map.
 * Never passes user-controlled objects directly into Mongoose .sort().
 */
function parseSort(sortKey, allowedSortMap, defaultSort = { createdAt: -1 }) {
  if (!sortKey || typeof sortKey !== "string") {
    return defaultSort;
  }
  const normalized = sortKey.trim();
  if (Object.prototype.hasOwnProperty.call(allowedSortMap, normalized)) {
    return allowedSortMap[normalized];
  }
  return defaultSort;
}

/**
 * Escapes special RegExp characters before building a MongoDB regex query.
 */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

module.exports = {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  escapeRegex,
  isValidObjectId,
};
