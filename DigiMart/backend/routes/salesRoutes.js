import express from 'express';
import {
  getModelMetrics,
  getSalesForecast,
  recalculateForecast,
} from '../controllers/salesController.js';
import { admin, protect } from '../middleware/authMiddleware.js';
const router = express.Router();

// @desc    Get sales forecast data
// @route   GET /api/sales/forecast
// @access  Private/Admin
router.get('/forecast', getSalesForecast);
router.get('/metrics', getModelMetrics);
router.post('/recalculate', protect, admin, recalculateForecast);

export default router;
