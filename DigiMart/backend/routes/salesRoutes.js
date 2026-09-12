import express from 'express';
import {
  getModelMetrics,
  getRecalculationStatus,
  getSalesForecast,
  recalculateForecast,
} from '../controllers/salesController.js';
const router = express.Router();

// @desc    Get sales forecast data
// @route   GET /api/sales/forecast
// @access  Public
router.get('/forecast', getSalesForecast);
router.get('/metrics', getModelMetrics);
router.get('/recalculation-status', getRecalculationStatus);
router.post('/recalculate', recalculateForecast);

export default router;
