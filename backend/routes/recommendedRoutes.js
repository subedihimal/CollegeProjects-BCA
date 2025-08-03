import express from 'express';
const router = express.Router();
import {
  getProducts,
  getTopProducts,
} from '../controllers/recommendController.js';
router.route('/').post(getProducts);
router.get('/top', getTopProducts);

export default router;
