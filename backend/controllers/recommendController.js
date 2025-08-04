import asyncHandler from '../middleware/asyncHandler.js';
import Product from '../models/productModel.js';
import getRecommendedProducts from '../utils/recommendHelper.js'

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const pageSize = process.env.PAGINATION_LIMIT || 8;
  const page = Number(req.body.pageNumber) || 1;
  const cartItems = req.body.cartItems;

  const keyword = req.body.keyword
    ? {
        name: {
          $regex: req.query.keyword,
          $options: 'i',
        },
      }
    : {};
    const result = await getRecommendedProducts({
        keyword,
        cartItems,
        pageSize,
        page,
    });    

    res.json(result);

});

export {
  getProducts,
};
