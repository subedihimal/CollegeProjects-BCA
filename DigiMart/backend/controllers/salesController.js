// Optimized Sales Forecasting API Controllers
// Consolidated and streamlined for better performance and maintainability

const BASE_URL = 'http://localhost:5001';
const DEFAULT_TIMEOUT = 15000;

// Utility functions
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const handleServiceError = (error, defaultResponse = null) => {
  if (error.code === 'ECONNREFUSED' || error.message.includes('fetch') || error.name === 'AbortError') {
    return { 
      status: 'service_unavailable', 
      message: 'Forecasting service not running',
      ...defaultResponse 
    };
  }
  return { status: 'error', message: error.message, ...defaultResponse };
};

const validatePeriod = (period) => ['7days', '15days'].includes(period);

const getPerformanceLevel = (r2) => {
  if (r2 >= 0.8) return 'excellent';
  if (r2 >= 0.6) return 'good';
  if (r2 >= 0.4) return 'fair';
  return 'poor';
};

const calculateAccuracyScore = (metrics) => {
  if (!metrics?.r2) return { score: 0, level: 'unknown' };
  
  let score = Math.max(0, metrics.r2 * 100);
  if (metrics.mae > 100) score *= 0.8;
  if (metrics.mae > 200) score *= 0.6;
  
  return {
    score: Math.round(Math.min(100, score)),
    level: getPerformanceLevel(metrics.r2),
    details: {
      r2: Math.round(metrics.r2 * 10000) / 100,
      mae: Math.round(metrics.mae * 100) / 100,
      rmse: Math.round(metrics.rmse * 100) / 100
    }
  };
};

// @desc    Get sales forecast data with complete historical data and metrics
// @route   GET /api/sales/forecast
// @access  Private/Admin
const getSalesForecast = async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    if (!validatePeriod(period)) {
      return res.status(400).json({ message: 'Invalid period. Must be: 7days, 15days' });
    }
    
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/forecast?period=${period}`, {
      timeout: 30000
    });
    
    if (!response.ok) {
      return res.json({
        summary: { predictedRevenue: 0, growthRate: 0, confidence: 0, bestCase: 0, worstCase: 0, dailyAverage: 0 },
        dailyForecast: [], categoryForecast: [], lineGraphData: [], topProducts: [],
        modelInfo: { type: 'No model available', metrics: null, categoryModels: 0 },
        serviceStatus: 'unavailable',
        message: response.status === 500 ? 'Forecasting engine error' : 'Service temporarily unavailable'
      });
    }
    
    const data = await response.json();
    res.json({ 
      ...data, 
      serviceStatus: 'success', 
      timestamp: new Date().toISOString(), 
      period 
    });
    
  } catch (error) {
    console.error('Forecast error:', error);
    res.json(handleServiceError(error, {
      summary: { predictedRevenue: 0, growthRate: 0, confidence: 0, bestCase: 0, worstCase: 0, dailyAverage: 0 },
      dailyForecast: [], categoryForecast: [], lineGraphData: [], topProducts: [],
      modelInfo: { type: 'No model available', metrics: null, categoryModels: 0 },
      serviceStatus: 'error'
    }));
  }
};

// @desc    Get model performance metrics
// @route   GET /api/sales/metrics
// @access  Private/Admin
const getModelMetrics = async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/metrics`);
    
    if (!response.ok) {
      return res.json({
        status: response.status === 404 ? 'no_models' : 'service_error',
        message: response.status === 404 ? 'No trained models available' : 'Metrics service error',
        main_model: null,
        category_models: {},
        recommendations: ['Train models using POST /api/sales/refresh']
      });
    }
    
    const data = await response.json();
    
    // Add performance interpretation
    if (data.main_model?.metrics) {
      const { r2 } = data.main_model.metrics;
      data.interpretation = {
        quality: getPerformanceLevel(r2),
        message: r2 >= 0.6 ? `Model explains ${Math.round(r2 * 100)}% of variance` : 'Model performance needs improvement'
      };
    }
    
    res.json({ ...data, timestamp: new Date().toISOString() });
    
  } catch (error) {
    console.error('Metrics error:', error);
    res.json(handleServiceError(error, {
      main_model: null,
      category_models: {}
    }));
  }
};

// @desc    Get category quantity forecasts
// @route   GET /api/sales/categories
// @access  Private/Admin
const getCategoryForecasts = async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    if (!validatePeriod(period)) {
      return res.status(400).json({ message: 'Invalid period. Must be: 7days, 15days' });
    }
    
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/categories?period=${period}`, {
      timeout: 20000
    });
    
    if (!response.ok) {
      return res.json({
        status: response.status === 404 ? 'no_category_models' : 'service_error',
        message: response.status === 404 ? 'No category models available' : 'Categories service error',
        categories: [],
        period,
        recommendations: ['Ensure data contains Product Type column', 'Retrain models using POST /api/sales/refresh']
      });
    }
    
    const data = await response.json();
    
    // Add summary statistics
    if (data.categories?.length > 0) {
      data.summary = {
        total_categories: data.categories.length,
        total_predicted_quantity: data.categories.reduce((sum, cat) => sum + cat.total_predicted_quantity, 0),
        avg_accuracy: Math.round(data.categories.reduce((sum, cat) => 
          sum + (cat.model_metrics?.r2 || 0), 0) / data.categories.length * 100),
        top_category: data.categories[0]?.category || 'None'
      };
    }
    
    res.json({ ...data, timestamp: new Date().toISOString() });
    
  } catch (error) {
    console.error('Categories error:', error);
    res.json(handleServiceError(error, {
      categories: [],
      period
    }));
  }
};

// @desc    Get individual category forecast
// @route   GET /api/sales/category/:categoryName
// @access  Private/Admin
const getSingleCategoryForecast = async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { period = '7days' } = req.query;
    
    if (!categoryName) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    if (!validatePeriod(period)) {
      return res.status(400).json({ message: 'Invalid period. Must be: 7days, 15days' });
    }
    
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/sales/category/${encodeURIComponent(categoryName)}/forecast?period=${period}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          message: `No model available for category: ${categoryName}`,
          suggestion: 'Use GET /api/sales/categories to see available categories'
        });
      }
      throw new Error(`Category service error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Add performance assessment
    if (data.metrics) {
      data.performance_assessment = {
        level: getPerformanceLevel(data.metrics.r2),
        accuracy_score: calculateAccuracyScore(data.metrics)
      };
    }
    
    res.json({ ...data, timestamp: new Date().toISOString() });
    
  } catch (error) {
    console.error('Single category error:', error);
    res.status(500).json({
      message: 'Unable to retrieve category forecast',
      error: error.message
    });
  }
};

// @desc    Get comprehensive model comparison and performance data
// @route   GET /api/sales/analysis
// @access  Private/Admin
const getComprehensiveAnalysis = async (req, res) => {
  try {
    // Fetch multiple data sources in parallel
    const [metricsResponse, categoriesResponse, dataStatusResponse] = await Promise.all([
      fetchWithTimeout(`${BASE_URL}/api/sales/metrics`).catch(() => ({ ok: false })),
      fetchWithTimeout(`${BASE_URL}/api/sales/categories?period=7days`).catch(() => ({ ok: false })),
      fetchWithTimeout(`${BASE_URL}/api/sales/data-status`).catch(() => ({ ok: false }))
    ]);
    
    const analysis = {
      timestamp: new Date().toISOString(),
      service_status: 'partial',
      metrics: null,
      categories: [],
      data_status: null,
      overall_performance: 'unknown',
      recommendations: []
    };
    
    // Process metrics data
    if (metricsResponse.ok) {
      const metricsData = await metricsResponse.json();
      analysis.metrics = metricsData;
      analysis.service_status = 'available';
      
      if (metricsData.main_model?.metrics) {
        const mainAccuracy = calculateAccuracyScore(metricsData.main_model.metrics);
        analysis.overall_performance = mainAccuracy.level;
        
        // Category models analysis
        if (metricsData.category_models) {
          const categoryAccuracies = Object.entries(metricsData.category_models).map(([cat, data]) => ({
            category: cat,
            accuracy: calculateAccuracyScore(data.metrics),
            model_type: data.model_params
          }));
          
          analysis.category_performance = {
            total_models: categoryAccuracies.length,
            avg_accuracy: Math.round(categoryAccuracies.reduce((sum, c) => sum + c.accuracy.score, 0) / categoryAccuracies.length),
            best_category: categoryAccuracies.sort((a, b) => b.accuracy.score - a.accuracy.score)[0]?.category || 'None'
          };
        }
      }
    }
    
    // Process categories data
    if (categoriesResponse.ok) {
      const categoriesData = await categoriesResponse.json();
      analysis.categories = categoriesData.categories || [];
    }
    
    // Process data status
    if (dataStatusResponse.ok) {
      const statusData = await dataStatusResponse.json();
      analysis.data_status = {
        data_points: statusData.daily_data_points || 0,
        models_trained: statusData.models_trained || false,
        category_models: statusData.category_models_trained || 0,
        data_quality: statusData.daily_data_points >= 30 ? 'Good' : 'Limited'
      };
      
      // Generate recommendations
      if (statusData.daily_data_points < 30) {
        analysis.recommendations.push('Add more historical data (minimum 30 days)');
      }
      if (!statusData.models_trained) {
        analysis.recommendations.push('Train models using POST /api/sales/refresh');
      }
      if (statusData.category_models_trained === 0) {
        analysis.recommendations.push('Ensure data has Product Type column for category forecasting');
      }
    }
    
    // Overall health assessment
    analysis.health_score = calculateHealthScore(analysis);
    
    res.json(analysis);
    
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json(handleServiceError(error));
  }
};

// @desc    Check forecasting service health and capabilities
// @route   GET /api/sales/health
// @access  Private/Admin
const checkForecastingHealth = async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/health`, { timeout: 5000 });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const healthData = await response.json();
    
    res.json({
      status: 'healthy',
      forecasting_service: healthData,
      capabilities: [
        'Daily forecasting (7-15 days)',
        'Category quantity forecasting', 
        'Model performance metrics',
        'Historical data visualization',
        'Multi-model comparison'
      ],
      supported_periods: ['7days', '15days'],
      metrics: ['MAE', 'MSE', 'RMSE', 'R²'],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    res.json({
      status: 'unhealthy',
      forecasting_service: { status: 'unavailable', error: error.message },
      instructions: [
        'Ensure data.csv exists with Product Type column',
        'Run: python enhanced_forecasting_engine.py',
        'Verify localhost:5001 accessibility'
      ],
      timestamp: new Date().toISOString()
    });
  }
};

// @desc    Refresh forecast models (trigger retrain)
// @route   POST /api/sales/refresh
// @access  Private/Admin
const refreshForecastModels = async (req, res) => {
  try {
    console.log('Initiating model refresh...');
    
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/retrain`, {
      method: 'POST',
      timeout: 180000 // 3 minutes for training
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Refresh failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    console.log('Model refresh completed successfully');
    
    res.json({
      message: 'Forecast models refreshed successfully',
      details: {
        main_model_trained: data.main_model_trained || false,
        category_models_trained: data.category_models_trained || 0,
        categories: data.categories || [],
        training_scope: 'Revenue + Category forecasting'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Refresh error:', error);
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      return res.status(503).json({
        message: 'Forecasting service unavailable',
        error: 'Python service not running'
      });
    }
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(504).json({
        message: 'Model refresh timeout',
        error: 'Training took longer than expected'
      });
    }
    
    res.status(500).json({
      message: 'Failed to refresh models',
      error: error.message
    });
  }
};

// @desc    Get data status and validation
// @route   GET /api/sales/status
// @access  Private/Admin
const getDataStatus = async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/data-status`);
    
    if (!response.ok) {
      throw new Error(`Data status error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Enhanced status interpretation
    const status = {
      ...data,
      data_quality: data.daily_data_points >= 30 ? 'Good' : 'Limited',
      model_readiness: data.models_trained ? 'Ready' : 'Not Ready',
      category_coverage: data.category_models_trained > 0 ? 'Available' : 'Not Available',
      recommendations: [],
      timestamp: new Date().toISOString()
    };
    
    // Generate recommendations
    if (data.daily_data_points < 30) {
      status.recommendations.push('Add more historical data (minimum 30 days)');
    }
    if (!data.models_trained) {
      status.recommendations.push('Train models using POST /api/sales/refresh');
    }
    if (data.category_models_trained === 0) {
      status.recommendations.push('Ensure data includes Product Type column');
    }
    
    res.json(status);
    
  } catch (error) {
    console.error('Status error:', error);
    res.json(handleServiceError(error, {
      data_available: false,
      record_count: 0,
      models_trained: false,
      daily_data_points: 0,
      category_models_trained: 0
    }));
  }
};

// @desc    Validate forecast data integrity
// @route   GET /api/sales/validate
// @access  Private/Admin
const validateForecastData = async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    if (!validatePeriod(period)) {
      return res.status(400).json({ message: 'Invalid period' });
    }
    
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/forecast?period=${period}`);
    
    if (!response.ok) {
      return res.json({
        valid: false,
        status: 'service_error',
        message: 'Forecasting service unavailable'
      });
    }
    
    const data = await response.json();
    
    // Validation checks
    const checks = {
      hasHistoricalData: data.lineGraphData?.some(item => item.actual) || false,
      hasForecastData: data.dailyForecast?.length > 0 || false,
      hasMetrics: !!data.modelInfo?.metrics,
      hasCategoryForecasts: data.categoryForecast?.length > 0 || false,
      historicalDataPoints: data.modelInfo?.totalHistoricalDays || 0,
      forecastDataPoints: data.dailyForecast?.length || 0,
      categoryModels: data.modelInfo?.categoryModels || 0,
      modelTrained: data.modelInfo?.type !== 'No model available'
    };
    
    const issues = [];
    const recommendations = [];
    
    // Generate issues and recommendations
    if (checks.historicalDataPoints < 30) {
      issues.push('Insufficient historical data');
      recommendations.push('Add more historical data (minimum 30 days)');
    }
    
    if (!checks.modelTrained) {
      issues.push('No trained model available');
      recommendations.push('Train models using POST /api/sales/refresh');
    }
    
    if (!checks.hasMetrics) {
      issues.push('Model metrics not available');
      recommendations.push('Retrain models for performance evaluation');
    }
    
    if (checks.categoryModels === 0) {
      recommendations.push('Add Product Type column for category forecasting');
    }
    
    res.json({
      valid: issues.length === 0,
      status: issues.length === 0 ? 'valid' : 'invalid',
      issues,
      checks,
      recommendations,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.json({
      valid: false,
      status: 'error',
      message: error.message,
      recommendations: [
        'Check if forecasting service is running',
        'Verify data.csv exists with valid structure'
      ]
    });
  }
};

// Helper function to calculate overall health score
const calculateHealthScore = (analysis) => {
  let score = 0;
  let maxScore = 0;
  
  // Service availability (30 points)
  maxScore += 30;
  if (analysis.service_status === 'available') score += 30;
  else if (analysis.service_status === 'partial') score += 15;
  
  // Main model performance (25 points)
  maxScore += 25;
  if (analysis.overall_performance === 'excellent') score += 25;
  else if (analysis.overall_performance === 'good') score += 20;
  else if (analysis.overall_performance === 'fair') score += 15;
  else if (analysis.overall_performance !== 'unknown') score += 10;
  
  // Data quality (25 points)
  maxScore += 25;
  if (analysis.data_status?.data_quality === 'Good') score += 25;
  else if (analysis.data_status?.data_points > 0) score += 15;
  
  // Category models (20 points)
  maxScore += 20;
  const categoryCount = analysis.data_status?.category_models || 0;
  if (categoryCount >= 5) score += 20;
  else if (categoryCount >= 3) score += 15;
  else if (categoryCount >= 1) score += 10;
  
  return Math.round((score / maxScore) * 100);
};

export { 
  getSalesForecast,
  getModelMetrics,
  getCategoryForecasts,
  getSingleCategoryForecast,
  getComprehensiveAnalysis,
  checkForecastingHealth,
  refreshForecastModels,
  getDataStatus,
  validateForecastData
};