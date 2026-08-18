import express from 'express';
const router = express.Router();
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  getTopProducts,
} from '../controllers/productController.js';
import { protect, admin, blockDemoAdmin } from '../middleware/authMiddleware.js';
import checkObjectId from '../middleware/checkObjectId.js';

router.route('/').get(getProducts).post(protect, admin, blockDemoAdmin, createProduct);
router
  .route('/:id/reviews')
  .post(protect, blockDemoAdmin, checkObjectId, createProductReview);
router.get('/top', getTopProducts);
router
  .route('/:id')
  .get(checkObjectId, getProductById)
  .put(protect, admin, blockDemoAdmin, checkObjectId, updateProduct)
  .delete(protect, admin, blockDemoAdmin, checkObjectId, deleteProduct);

export default router;
