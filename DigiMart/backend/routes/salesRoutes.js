import express from 'express';
import { getModelMetrics, getSalesForecast } from '../controllers/salesController.js';
const router = express.Router();

// @desc    Get sales forecast data
// @route   GET /api/sales/forecast
// @access  Private/Admin
router.get('/forecast', getSalesForecast);
router.get('/metrics', getModelMetrics);

export default router;
