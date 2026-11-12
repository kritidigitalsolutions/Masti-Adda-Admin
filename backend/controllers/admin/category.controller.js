const Category = require("../../models/category.model");

/**
 * Normalizes all category priorities to be strictly sequential 1, 2, 3...
 */
const normalizeCategoryPriorities = async () => {
  const categories = await Category.find().sort({ priority: 1, createdAt: 1 });
  for (let i = 0; i < categories.length; i++) {
    if (categories[i].priority !== i + 1) {
      await Category.findByIdAndUpdate(categories[i]._id, { priority: i + 1 });
      categories[i].priority = i + 1;
    }
  }
  return categories;
};

// ========================================
// CREATE CATEGORY
// ========================================
exports.createCategory = async (req, res) => {
  try {
    const { name, priority, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Category with this name already exists" });
    }

    const totalCount = await Category.countDocuments();
    let targetPriority = parseInt(priority, 10);

    if (isNaN(targetPriority) || targetPriority < 1 || targetPriority > totalCount + 1) {
      targetPriority = totalCount + 1;
    }

    // Auto-shift collision: any category with priority >= targetPriority shifts forward (+1)
    await Category.updateMany(
      { priority: { $gte: targetPriority } },
      { $inc: { priority: 1 } }
    );

    const categoryData = { name, priority: targetPriority };
    if (isActive !== undefined) categoryData.isActive = isActive === true || isActive === "true";

    const category = await Category.create(categoryData);
    await normalizeCategoryPriorities();

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        priority: category.priority,
        isActive: category.isActive,
        createdAt: category.createdAt
      }
    });
  } catch (error) {
    console.error("CREATE CATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// GET ALL CATEGORIES (Admin)
// ========================================
exports.getAllCategories = async (req, res) => {
  try {
    let categories = await Category.find()
      .select("_id name slug priority isActive createdAt curatedContent")
      .sort({ priority: 1, createdAt: 1 })
      .lean();

    // Check and auto-clean any legacy duplicate or non-sequential priorities in database
    const priorities = categories.map((c) => c.priority);
    const hasDuplicatesOrGaps =
      new Set(priorities).size !== priorities.length ||
      priorities.some((p, i) => p !== i + 1);

    if (hasDuplicatesOrGaps && categories.length > 0) {
      for (let i = 0; i < categories.length; i++) {
        if (categories[i].priority !== i + 1) {
          categories[i].priority = i + 1;
          await Category.findByIdAndUpdate(categories[i]._id, {
            priority: i + 1,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      count: categories.length,
      total: categories.length,
      data: categories,
      categories: categories
    });
  } catch (error) {
    console.error("GET ALL CATEGORIES ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// GET CATEGORY BY ID (Admin)
// ========================================
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error("GET CATEGORY BY ID ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// UPDATE CATEGORY
// ========================================
exports.updateCategory = async (req, res) => {
  try {
    const { name, isActive, priority } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (name) category.name = name;
    if (isActive !== undefined) category.isActive = isActive === true || isActive === "true";

    if (priority !== undefined) {
      const oldPriority = category.priority;
      const totalCount = await Category.countDocuments();
      let targetPriority = parseInt(priority, 10);

      if (isNaN(targetPriority) || targetPriority < 1) targetPriority = 1;
      if (targetPriority > totalCount) targetPriority = totalCount;

      if (targetPriority !== oldPriority) {
        if (targetPriority < oldPriority) {
          // Moving forward to higher priority (e.g. 5 -> 2)
          // Shift items between targetPriority and oldPriority - 1 by +1
          await Category.updateMany(
            { _id: { $ne: req.params.id }, priority: { $gte: targetPriority, $lt: oldPriority } },
            { $inc: { priority: 1 } }
          );
        } else {
          // Moving backward to lower priority (e.g. 2 -> 5)
          // Shift items between oldPriority + 1 and targetPriority by -1
          await Category.updateMany(
            { _id: { $ne: req.params.id }, priority: { $gt: oldPriority, $lte: targetPriority } },
            { $inc: { priority: -1 } }
          );
        }
        category.priority = targetPriority;
      }
    }

    await category.save();
    await normalizeCategoryPriorities();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        priority: category.priority,
        isActive: category.isActive,
        createdAt: category.createdAt
      }
    });
  } catch (error) {
    console.error("UPDATE CATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// DELETE CATEGORY
// ========================================
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    await Category.findByIdAndDelete(req.params.id);
    await normalizeCategoryPriorities();

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// SAVE CURATED CONTENT FOR CATEGORY
// ========================================
exports.saveCuratedContent = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const { items } = req.body; // [{ contentType: "Movie"|"Series", contentId: "..." }]
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "items must be an array" });
    }

    category.curatedContent = items.map((i, index) => ({
      contentType: i.contentType,
      contentId: i.contentId,
      position: index + 1
    }));

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Curated content saved successfully",
      count: category.curatedContent.length
    });
  } catch (error) {
    console.error("SAVE CURATED CONTENT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
