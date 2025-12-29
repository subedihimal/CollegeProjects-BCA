import express from 'express';
const router = express.Router();
import {
  getProducts,
} from '../controllers/recommendController.js';
router.route('/').post(getProducts);
export default router;
