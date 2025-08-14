import express from 'express';
import { getSalesForecast } from '../controllers/salesController.js';
const router = express.Router();

// @desc    Get sales forecast data
// @route   GET /api/sales/forecast
// @access  Private/Admin
router.get('/forecast', getSalesForecast);

export default router;