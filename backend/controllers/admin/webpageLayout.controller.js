const WebpageLayout = require("../../models/webpageLayout.model");
const Movie = require("../../models/movie.model");
const Series = require("../../models/series.model");
const Microdrama = require("../../models/microdrama.model");

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a map of { _id -> populated doc } for an array of { contentType, contentId } items.
 * Returns the same array with contentId replaced by the full document (or null if not found).
 */
const populateItems = async (items) => {
  if (!items || items.length === 0) return [];

  // Bucket IDs by model
  const movieIds = [];
  const seriesIds = [];
  const microdramaIds = [];

  for (const item of items) {
    const id = item.contentId?.toString();
    if (!id) continue;
    if (item.contentType === "Movie") movieIds.push(id);
    else if (item.contentType === "Series") seriesIds.push(id);
    else if (item.contentType === "Microdrama") microdramaIds.push(id);
  }

  const [movies, seriesDocs, microdramas] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds } }).lean() : [],
    seriesIds.length ? Series.find({ _id: { $in: seriesIds } }).lean() : [],
    microdramaIds.length ? Microdrama.find({ _id: { $in: microdramaIds } }).lean() : [],
  ]);

  const contentMap = {};
  movies.forEach((m) => (contentMap[m._id.toString()] = { ...m, type: "movie" }));
  seriesDocs.forEach((s) => (contentMap[s._id.toString()] = { ...s, type: "series" }));
  microdramas.forEach((md) => (contentMap[md._id.toString()] = { ...md, type: "microdrama" }));

  return items
    .map((item) => {
      const id = (item.contentId?._id || item.contentId)?.toString();
      const found = contentMap[id];
      if (!found) return null; // orphaned → skip
      return { contentType: item.contentType, contentId: found };
    })
    .filter(Boolean);
};

/**
 * Populate a full layout document (heroBanners + all sections.items).
 */
const populateLayout = async (layout) => {
  const plain = layout.toObject ? layout.toObject() : { ...layout };

  plain.heroBanners = await populateItems(plain.heroBanners);

  plain.sections = await Promise.all(
    (plain.sections || []).map(async (section) => ({
      ...section,
      items: await populateItems(section.items),
    }))
  );

  return plain;
};

/**
 * Collect all content IDs from the payload and check for is18plus items.
 * Returns the list of 18+ items found (empty = all clear).
 */
const find18PlusItems = async (heroBanners, sections) => {
  const allItems = [
    ...(heroBanners || []),
    ...(sections || []).flatMap((s) => s.items || []),
  ];

  if (allItems.length === 0) return [];

  const movieIds = allItems.filter((i) => i.contentType === "Movie").map((i) => i.contentId);
  const seriesIds = allItems.filter((i) => i.contentType === "Series").map((i) => i.contentId);
  const microdramaIds = allItems.filter((i) => i.contentType === "Microdrama").map((i) => i.contentId);

  const [adultMovies, adultSeries, adultMicrodramas] = await Promise.all([
    movieIds.length ? Movie.find({ _id: { $in: movieIds }, is18plus: true }).select("title").lean() : [],
    seriesIds.length ? Series.find({ _id: { $in: seriesIds }, is18plus: true }).select("title").lean() : [],
    microdramaIds.length ? Microdrama.find({ _id: { $in: microdramaIds }, is18plus: true }).select("title").lean() : [],
  ]);

  return [...adultMovies, ...adultSeries, ...adultMicrodramas];
};

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/webpage-layout
 * Fetch current layout (populated). Auto-creates singleton if missing.
 */
exports.getWebpageLayout = async (req, res) => {
  try {
    let layout = await WebpageLayout.findOne();

    if (!layout) {
      layout = await WebpageLayout.create({ heroBanners: [], sections: [] });
    }

    const populated = await populateLayout(layout);

    return res.status(200).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    console.error("getWebpageLayout error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch webpage layout",
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/webpage-layout
 * Full overwrite — replaces heroBanners and sections entirely.
 * Body: { heroBanners: [{contentType, contentId}], sections: [{categorySlug, title, items:[{contentType,contentId}]}] }
 */
exports.updateWebpageLayout = async (req, res) => {
  try {
    const { heroBanners = [], sections = [] } = req.body;

    // ── 18+ Guard ──────────────────────────────────────────────────────────
    const adultItems = await find18PlusItems(heroBanners, sections);
    if (adultItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "18+ content cannot be added to the webpage layout",
        items: adultItems.map((i) => i.title),
      });
    }

    // ── Sanitize: extract only ObjectId strings ────────────────────────────
    const sanitizeItem = (item) => ({
      contentType: item.contentType,
      contentId: item.contentId?._id || item.contentId,
    });

    const sanitizeSectionItem = (item) => ({
      contentType: item.contentType,
      contentId: item.contentId?._id || item.contentId,
    });

    const cleanBanners = heroBanners.map(sanitizeItem);
    const cleanSections = sections.map((s) => ({
      categorySlug: s.categorySlug,
      title: s.title,
      items: (s.items || []).map(sanitizeSectionItem),
    }));

    // ── Upsert singleton ───────────────────────────────────────────────────
    let layout = await WebpageLayout.findOne();

    if (!layout) {
      layout = new WebpageLayout({});
    }

    layout.heroBanners = cleanBanners;
    layout.sections = cleanSections;
    await layout.save();

    // ── Re-populate and return ─────────────────────────────────────────────
    const populated = await populateLayout(layout);

    return res.status(200).json({
      success: true,
      message: "Webpage layout published successfully",
      data: populated,
    });
  } catch (error) {
    console.error("updateWebpageLayout error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to publish webpage layout",
      error: error.message,
    });
  }
};

