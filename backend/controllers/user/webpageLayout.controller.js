const WebpageLayout = require("../../models/webpageLayout.model");
const Movie = require("../../models/movie.model");
const Series = require("../../models/series.model");
const Microdrama = require("../../models/microdrama.model");
const Episode = require("../../models/episode.model");
const MicrodramaEpisode = require("../../models/microdramaEpisode.model");

// ── Visibility filter ──────────────────────────────────────────────────────
const isVisible = (doc) =>
  doc.isPublished !== false && doc.isHide !== true && doc.is18plus !== true;

// ── Attach episodes to series (grouped by season) ──────────────────────────
const attachEpisodesToSeries = async (seriesDoc) => {
  try {
    const episodes = await Episode.find({ series: seriesDoc._id })
      .sort({ season: 1, episodeNumber: 1 })
      .lean();

    const seasonsMap = {};
    for (const ep of episodes) {
      const sn = ep.season || 1;
      if (!seasonsMap[sn]) seasonsMap[sn] = [];
      seasonsMap[sn].push(ep);
    }

    seriesDoc.seasons = Object.keys(seasonsMap)
      .sort((a, b) => Number(a) - Number(b))
      .map((sn) => ({
        seasonNumber: Number(sn),
        episodes: seasonsMap[sn],
      }));
  } catch {
    seriesDoc.seasons = [];
  }
  return seriesDoc;
};

// ── Populate items (public-facing: flatten + filter) ──────────────────────
const populateAndFilterItems = async (items, attachEpisodes = false) => {
  if (!items || items.length === 0) return [];

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
  movies.filter(isVisible).forEach((m) => (contentMap[m._id.toString()] = { ...m, type: "movie" }));
  seriesDocs.filter(isVisible).forEach((s) => (contentMap[s._id.toString()] = { ...s, type: "series" }));
  microdramas.filter(isVisible).forEach((md) => (contentMap[md._id.toString()] = { ...md, type: "microdrama" }));

  const result = [];

  for (const item of items) {
    const id = (item.contentId?._id || item.contentId)?.toString();
    const found = contentMap[id];
    if (!found) continue;

    let doc = { ...found };

    if (attachEpisodes && found.type === "series") {
      doc = await attachEpisodesToSeries(doc);
    }

    result.push(doc);
  }

  return result;
};

// ── Get or create singleton ────────────────────────────────────────────────
const getLayoutDoc = async () => {
  let layout = await WebpageLayout.findOne().lean();
  if (!layout) {
    layout = { heroBanners: [], sections: [], isNew: true };
  }
  return layout;
};

// ── Controllers ────────────────────────────────────────────────────────────

/**
 * GET /api/webpage-layout
 * Full layout — hero banners + all carousel sections.
 */
exports.getWebpageLayout = async (req, res) => {
  try {
    const layout = await getLayoutDoc();

    const [heroBanners, sections] = await Promise.all([
      populateAndFilterItems(layout.heroBanners || []),
      Promise.all(
        (layout.sections || []).map(async (section) => ({
          categorySlug: section.categorySlug,
          title: section.title,
          _id: section._id,
          items: await populateAndFilterItems(section.items || [], true),
        }))
      ),
    ]);

    // Filter out empty sections
    const activeSections = sections.filter((s) => s.items.length > 0);

    const isCustomLayout = (layout.heroBanners?.length > 0 || layout.sections?.length > 0);

    return res.status(200).json({
      success: true,
      isCustomLayout,
      bannersCount: heroBanners.length,
      sectionsCount: activeSections.length,
      heroBanners,
      sections: activeSections,
    });
  } catch (error) {
    console.error("getWebpageLayout (public) error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch webpage layout",
      error: error.message,
    });
  }
};

/**
 * GET /api/webpage-layout/banners
 * Hero banners only.
 */
exports.getWebpageHeroBanners = async (req, res) => {
  try {
    const layout = await getLayoutDoc();
    const heroBanners = await populateAndFilterItems(layout.heroBanners || []);

    return res.status(200).json({
      success: true,
      count: heroBanners.length,
      heroBanners,
    });
  } catch (error) {
    console.error("getWebpageHeroBanners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch hero banners",
      error: error.message,
    });
  }
};

/**
 * GET /api/webpage-layout/sections
 * All carousel sections.
 */
exports.getWebpageSections = async (req, res) => {
  try {
    const layout = await getLayoutDoc();

    const sections = await Promise.all(
      (layout.sections || []).map(async (section) => ({
        categorySlug: section.categorySlug,
        title: section.title,
        _id: section._id,
        items: await populateAndFilterItems(section.items || [], true),
      }))
    );

    const activeSections = sections.filter((s) => s.items.length > 0);

    return res.status(200).json({
      success: true,
      count: activeSections.length,
      sections: activeSections,
    });
  } catch (error) {
    console.error("getWebpageSections error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sections",
      error: error.message,
    });
  }
};

/**
 * GET /api/webpage-layout/sections/:slug
 * Single section by categorySlug.
 */
exports.getWebpageSectionBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const layout = await getLayoutDoc();

    const section = (layout.sections || []).find((s) => s.categorySlug === slug);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: `Section with slug '${slug}' not found`,
      });
    }

    const items = await populateAndFilterItems(section.items || [], true);

    return res.status(200).json({
      success: true,
      section: {
        categorySlug: section.categorySlug,
        title: section.title,
        _id: section._id,
        items,
      },
    });
  } catch (error) {
    console.error("getWebpageSectionBySlug error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch section",
      error: error.message,
    });
  }
};

