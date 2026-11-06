const IntroScreen = require("../../models/introScreen.model");

/**
 * Normalizes all screen orders to be strictly sequential 1, 2, 3...
 */
const normalizeOrders = async () => {
  const screens = await IntroScreen.find().sort({ order: 1, createdAt: 1 });
  for (let i = 0; i < screens.length; i++) {
    if (screens[i].order !== i + 1) {
      await IntroScreen.findByIdAndUpdate(screens[i]._id, { order: i + 1 });
    }
  }
};

/**
 * CREATE INTRO SCREEN
 * POST /api/admin/intro-screens
 */
exports.createIntroScreen = async (req, res) => {
  try {
    const { title, image, order } = req.body;

    // Validation
    if (!title || !image) {
      return res.status(400).json({
        success: false,
        message: "Title and Image URL are required",
      });
    }

    const totalCount = await IntroScreen.countDocuments();
    let targetOrder = Number(order);

    // If order is not given or invalid, place at end
    if (!targetOrder || targetOrder < 1 || targetOrder > totalCount + 1) {
      targetOrder = totalCount + 1;
    }

    // Auto-shift collision: any screen with order >= targetOrder shifts forward (+1)
    await IntroScreen.updateMany(
      { order: { $gte: targetOrder } },
      { $inc: { order: 1 } }
    );

    const introScreen = await IntroScreen.create({
      title,
      image,
      order: targetOrder,
    });

    return res.status(201).json({
      success: true,
      message: "Intro screen created successfully",
      data: introScreen,
    });
  } catch (error) {
    console.error("Create intro screen error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create intro screen",
      error: error.message,
    });
  }
};


/**
 * GET ALL INTRO SCREENS
 * GET /api/admin/intro-screens
 */
exports.getAllIntroScreens = async (req, res) => {
  try {
    let introScreens = await IntroScreen.find().sort({
      order: 1,
      createdAt: 1,
    });

    // Check and auto-clean any legacy duplicate orders in database
    const orders = introScreens.map((s) => s.order);
    const hasDuplicates =
      new Set(orders).size !== orders.length ||
      orders.some((o, i) => o !== i + 1);

    if (hasDuplicates && introScreens.length > 0) {
      for (let i = 0; i < introScreens.length; i++) {
        if (introScreens[i].order !== i + 1) {
          introScreens[i].order = i + 1;
          await IntroScreen.findByIdAndUpdate(introScreens[i]._id, {
            order: i + 1,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      count: introScreens.length,
      data: introScreens,
    });
  } catch (error) {
    console.error("Get intro screens error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get intro screens",
      error: error.message,
    });
  }
};


/**
 * GET INTRO SCREEN BY ID
 * GET /api/admin/intro-screens/:id
 */
exports.getIntroScreenById = async (req, res) => {
  try {
    const { id } = req.params;

    const introScreen = await IntroScreen.findById(id);

    if (!introScreen) {
      return res.status(404).json({
        success: false,
        message: "Intro screen not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: introScreen,
    });
  } catch (error) {
    console.error("Get intro screen by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get intro screen",
      error: error.message,
    });
  }
};


/**
 * UPDATE INTRO SCREEN
 * PUT /api/admin/intro-screens/:id
 */
exports.updateIntroScreen = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image, order } = req.body;

    const introScreen = await IntroScreen.findById(id);

    if (!introScreen) {
      return res.status(404).json({
        success: false,
        message: "Intro screen not found",
      });
    }

    if (title !== undefined) {
      introScreen.title = title;
    }

    if (image !== undefined) {
      introScreen.image = image;
    }

    if (order !== undefined) {
      const oldOrder = introScreen.order;
      const totalCount = await IntroScreen.countDocuments();
      let targetOrder = Number(order);

      if (targetOrder < 1) targetOrder = 1;
      if (targetOrder > totalCount) targetOrder = totalCount;

      if (targetOrder !== oldOrder) {
        if (targetOrder < oldOrder) {
          // Moving forward to an earlier step (e.g. step 5 -> step 2)
          // Shift items between targetOrder and oldOrder - 1 by +1
          await IntroScreen.updateMany(
            { _id: { $ne: id }, order: { $gte: targetOrder, $lt: oldOrder } },
            { $inc: { order: 1 } }
          );
        } else {
          // Moving backward to a later step (e.g. step 2 -> step 5)
          // Shift items between oldOrder + 1 and targetOrder by -1
          await IntroScreen.updateMany(
            { _id: { $ne: id }, order: { $gt: oldOrder, $lte: targetOrder } },
            { $inc: { order: -1 } }
          );
        }
        introScreen.order = targetOrder;
      }
    }

    await introScreen.save();

    return res.status(200).json({
      success: true,
      message: "Intro screen updated successfully",
      data: introScreen,
    });
  } catch (error) {
    console.error("Update intro screen error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update intro screen",
      error: error.message,
    });
  }
};


/**
 * DELETE INTRO SCREEN
 * DELETE /api/admin/intro-screens/:id
 */
exports.deleteIntroScreen = async (req, res) => {
  try {
    const { id } = req.params;

    const introScreen = await IntroScreen.findByIdAndDelete(id);

    if (!introScreen) {
      return res.status(404).json({
        success: false,
        message: "Intro screen not found",
      });
    }

    // Shift all subsequent screens down by -1 to maintain compact sequence
    await IntroScreen.updateMany(
      { order: { $gt: introScreen.order } },
      { $inc: { order: -1 } }
    );

    return res.status(200).json({
      success: true,
      message: "Intro screen deleted successfully",
    });
  } catch (error) {
    console.error("Delete intro screen error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete intro screen",
      error: error.message,
    });
  }
};


/**
 * REORDER INTRO SCREENS
 * PATCH /api/admin/intro-screens/reorder
 */
exports.reorderIntroScreens = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "items must be an array",
      });
    }

    for (const item of items) {
      if (!item.id || item.order === undefined) {
        return res.status(400).json({
          success: false,
          message: "Each item must contain id and order",
        });
      }
    }

    await Promise.all(
      items.map((item) =>
        IntroScreen.findByIdAndUpdate(
          item.id,
          {
            order: Number(item.order),
          },
          {
            runValidators: true,
          }
        )
      )
    );

    return res.status(200).json({
      success: true,
      message: "Intro screen order updated successfully",
    });
  } catch (error) {
    console.error("Reorder intro screens error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reorder intro screens",
      error: error.message,
    });
  }
};
