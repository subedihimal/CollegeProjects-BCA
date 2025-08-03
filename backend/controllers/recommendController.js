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

    console.log(result);

    res.json(result);

});



// @desc    Get top rated products
// @route   GET /api/products/top
// @access  Public
const getTopProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).sort({ rating: -1 }).limit(3);

  res.json(products);
});

export {
  getProducts,
  getTopProducts,
};
