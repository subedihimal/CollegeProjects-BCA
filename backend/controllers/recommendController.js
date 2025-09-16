import asyncHandler from '../middleware/asyncHandler.js';
import getRecommendedProducts from '../utils/recommendHelper.js'

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const pageSize = process.env.PAGINATION_LIMIT || 8;
  const page = Number(req.body.pageNumber);
  const cartItems = req.body.cartItems;
  const userId = req.body.userId;
  const viewedProducts = req.body.viewedProducts || [];
  
  const result = await getRecommendedProducts({
    cartItems,
    pageSize,
    page,
    userId,
    viewedProducts,
  });    

  res.json(result);
});

export {
  getProducts,
};