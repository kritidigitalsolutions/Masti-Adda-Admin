const Category = require("../models/category.model");
const Movie = require("../models/movie.model");
const Series = require("../models/series.model");
const Microdrama = require("../models/microdrama.model");
const { isWebClient } = require("../utils/clientDetector");

const CONTENT_SELECT = "title poster banner slug isPremium isPublished isHide releaseDate priority rating is18plus duration releaseYear";

// ========================================
// GET ACTIVE CATEGORIES WITH CURATED CONTENT (User-facing)
// ========================================
exports.getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("_id name slug priority")
      .sort({ priority: 1, name: 1 })
      .lean();

    const data = categories.map(cat => ({
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      priority: cat.priority
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data: data,
      categories: data
    });
  } catch (error) {
    console.error("GET ACTIVE CATEGORIES ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// GET CONTENT OF A PARTICULAR CATEGORY (by slug or _id)
// ========================================
exports.getCategoryContent = async (req, res) => {
  try {
    const { slug } = req.params;

    // Support lookup by slug or by _id
    const query = slug.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: slug, isActive: true }
      : { slug, isActive: true };

    const category = await Category.findOne(query).lean();
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    let contents = [];

    if (category.curatedContent && category.curatedContent.length > 0) {
      // Return curated (admin-selected) content in the saved order
      const allContentIds = category.curatedContent
        .map(i => i.contentId?._id || i.contentId)
        .filter(Boolean);

      const adultFilter = isWebClient(req) ? { is18plus: { $ne: true }, isHide: { $ne: true } } : {};
      const [movies, series, microdramas] = await Promise.all([
        allContentIds.length > 0 ? Movie.find({ _id: { $in: allContentIds }, isPublished: true, ...adultFilter }).lean() : [],
        allContentIds.length > 0 ? Series.find({ _id: { $in: allContentIds }, isPublished: true, ...adultFilter }).lean() : [],
        allContentIds.length > 0 ? Microdrama.find({ _id: { $in: allContentIds }, isPublished: true, ...adultFilter }).lean() : []
      ]);

      const contentMap = new Map();
      movies.forEach(m => contentMap.set(m._id.toString(), { ...m, contentType: "Movie" }));
      series.forEach(s => contentMap.set(s._id.toString(), { ...s, contentType: "Series" }));
      microdramas.forEach(d => contentMap.set(d._id.toString(), { ...d, contentType: "Microdrama" }));

      contents = category.curatedContent
        .map((item, index) => {
          const idStr = (item.contentId?._id || item.contentId).toString();
          const contentData = contentMap.get(idStr);
          return contentData ? { ...contentData, position: item.position || index + 1 } : null;
        })
        .filter(Boolean);
    } else {
      // Fallback: fetch all content tagged with this category
      const categoryRegex = new RegExp(`^${category.name}$|^${category.slug}$`, "i");
      
      const adultFilter = isWebClient(req) ? { is18plus: { $ne: true }, isHide: { $ne: true } } : {};
      const [movies, series, microdramas] = await Promise.all([
        Movie.find({ category: { $regex: categoryRegex }, isPublished: true, ...adultFilter }).lean(),
        Series.find({ category: { $regex: categoryRegex }, isPublished: true, ...adultFilter }).lean(),
        Microdrama.find({ category: { $regex: categoryRegex }, isPublished: true, ...adultFilter }).lean()
      ]);

      contents = [
        ...movies.map(m => ({ ...m, contentType: "Movie" })),
        ...series.map(s => ({ ...s, contentType: "Series" })),
        ...microdramas.map(d => ({ ...d, contentType: "Microdrama" }))
      ].sort((a, b) => (b.priority || 0) - (a.priority || 0) || new Date(b.createdAt) - new Date(a.createdAt))
       .map((item, index) => ({ ...item, position: index + 1 }));
    }

    return res.status(200).json({
      success: true,
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug
      },
      count: contents.length,
      data: contents
    });
  } catch (error) {
    console.error("GET CATEGORY CONTENT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};