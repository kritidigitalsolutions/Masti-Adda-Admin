const Plan = require("../models/plan.model");

// GET ACTIVE PLANS
exports.getPlans = async (req, res) => {
  try {
    const rawType = req.params.planType;
    const requestedPlanType = rawType ? rawType.toLowerCase().trim() : null;

    const filter = { isActive: true };
    if (requestedPlanType && requestedPlanType !== "all") {
      filter.planType = requestedPlanType;
    }

    const plans = await Plan.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 });

    res.json({
      success: true,
      planType: requestedPlanType || "all",
      count: plans.length,
      plans,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
