// @desc    Get sales forecast data
// @route   GET /api/sales/forecast
// @access  Private/Admin
const getSalesForecast = async (req, res) => {
  try {
    const { period } = req.query;
    
    // Return empty response for now
    res.json({});
    
  } catch (error) {
    console.error('Error in getSalesForecast:', error);
    res.status(500).json({ message: error.message });
  }
};

export { getSalesForecast };