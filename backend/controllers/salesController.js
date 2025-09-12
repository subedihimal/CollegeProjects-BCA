// @desc    Get sales forecast data (Daily: 7 or 15 days) with complete historical data
// @route   GET /api/sales/forecast
// @access  Private/Admin
const getSalesForecast = async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    // Validate period parameter
    if (!['7days', '15days'].includes(period)) {
      return res.status(400).json({
        message: 'Invalid period. Must be one of: 7days, 15days'
      });
    }
    
    // Call the Python ARIMA forecasting engine
    const forecastResponse = await fetch(
      `http://localhost:5001/api/sales/forecast?period=${period}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    
    // Handle service unavailable
    if (!forecastResponse.ok) {
      return res.status(200).json(getEmptyForecastResponse(
        forecastResponse.status === 500 ? 'Forecasting engine error' : 'Service temporarily unavailable'
      ));
    }
    
    // Parse and return forecast data
    const forecastData = await forecastResponse.json();
    forecastData.serviceStatus = 'success';
    forecastData.timestamp = new Date().toISOString();
    forecastData.period = period;
        
    res.json(forecastData);
    
  } catch (error) {
    console.error('Error in getSalesForecast:', error);
    
    // Handle connection errors gracefully
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      return res.status(200).json(getEmptyForecastResponse('Forecasting service not running'));
    }
    
    res.status(500).json({
      message: 'Unable to generate sales forecast',
      error: error.message,
      serviceStatus: 'error'
    });
  }
};

// @desc    Get data status for forecasting engine
// @route   GET /api/sales/data-status
// @access  Private/Admin
const getDataStatus = async (req, res) => {
  try {
    const statusResponse = await fetch('http://localhost:5001/api/sales/data-status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    
    if (!statusResponse.ok) {
      throw new Error(`Data status service error: ${statusResponse.status}`);
    }
    
    const statusData = await statusResponse.json();
    statusData.timestamp = new Date().toISOString();
    
    res.json(statusData);
    
  } catch (error) {
    console.error('Error in getDataStatus:', error);
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      return res.status(200).json({
        status: 'error',
        message: 'Forecasting service not running',
        data_available: false,
        record_count: 0,
        models_trained: false,
        daily_data_points: 0,
        serviceStatus: 'unavailable'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @desc    Check forecasting service health
// @route   GET /api/sales/health
// @access  Private/Admin
const checkForecastingHealth = async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const healthResponse = await fetch('http://localhost:5001/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    
    res.json({
      status: 'healthy',
      forecasting_service: healthData,
      capabilities: {
        daily_forecasting: true,
        periods_supported: ['7days', '15days'],
        features: ['ARIMA modeling', 'Complete historical data', 'Weekend adjustments', 'Full data range visualization']
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(200).json({
      status: 'unhealthy',
      forecasting_service: { status: 'unavailable', error: error.message },
      timestamp: new Date().toISOString(),
      instructions: [
        'Ensure data.csv exists in forecasting directory',
        'Run: python forecastingengine.py',
        'Verify localhost:5001 accessibility',
        'Check data contains records from 2023 onwards'
      ]
    });
  }
};

// @desc    Refresh forecast models (trigger retrain)
// @route   POST /api/sales/refresh
// @access  Private/Admin
const refreshForecastModels = async (req, res) => {
  try {
    console.log('Initiating model refresh...');
    
    const refreshResponse = await fetch('http://localhost:5001/api/sales/retrain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000, // 2 minutes for retraining
    });
    
    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json().catch(() => ({}));
      throw new Error(`Refresh failed: ${refreshResponse.status}, ${errorData.message || 'Unknown error'}`);
    }
    
    const refreshData = await refreshResponse.json();
    console.log('Model refresh completed');
    
    res.json({
      message: 'Forecast models refreshed successfully',
      details: refreshData,
      timestamp: new Date().toISOString(),
      note: 'All historical data from 2023 onwards will be included'
    });
    
  } catch (error) {
    console.error('Error refreshing models:', error);
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      return res.status(503).json({
        message: 'Forecasting service unavailable',
        error: 'Python service not running'
      });
    }
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(504).json({
        message: 'Model refresh timeout',
        error: 'Operation took longer than expected'
      });
    }
    
    res.status(500).json({
      message: 'Failed to refresh models',
      error: error.message
    });
  }
};

// @desc    Get historical data summary for visualization
// @route   GET /api/sales/history-summary
// @access  Private/Admin
const getHistorySummary = async (req, res) => {
  try {
    const statusResponse = await fetch('http://localhost:5001/api/sales/data-status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    
    if (!statusResponse.ok) {
      throw new Error(`History summary service error: ${statusResponse.status}`);
    }
    
    const statusData = await statusResponse.json();
    
    // Get a sample forecast to extract date range information
    const forecastResponse = await fetch('http://localhost:5001/api/sales/forecast?period=7days', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    
    let dateRangeInfo = {};
    if (forecastResponse.ok) {
      const forecastData = await forecastResponse.json();
      dateRangeInfo = {
        dateRange: forecastData.modelInfo?.dateRange || 'Unknown',
        totalDays: forecastData.modelInfo?.totalHistoricalDays || 0,
        lastDataDate: forecastData.modelInfo?.lastDataDate || 'Unknown'
      };
    }
    
    res.json({
      status: 'success',
      ...statusData,
      ...dateRangeInfo,
      message: 'Complete historical data available for visualization',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in getHistorySummary:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Unable to retrieve history summary',
      error: error.message
    });
  }
};

// @desc    Get sample historical data for testing
// @route   GET /api/sales/sample-data
// @access  Private/Admin
const getSampleData = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    // This would typically fetch from your database
    // For now, it calls the Python service to get some sample data
    const forecastResponse = await fetch('http://localhost:5001/api/sales/forecast?period=7days', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    
    if (!forecastResponse.ok) {
      throw new Error('Unable to fetch sample data');
    }
    
    const forecastData = await forecastResponse.json();
    
    // Return a sample of the historical data
    const sampleHistoricalData = forecastData.lineGraphData
      ? forecastData.lineGraphData.filter(item => item.type === 'historical').slice(-limit)
      : [];
    
    res.json({
      status: 'success',
      sampleData: sampleHistoricalData,
      totalHistoricalPoints: forecastData.modelInfo?.totalHistoricalDays || 0,
      dateRange: forecastData.modelInfo?.dateRange || 'Unknown',
      message: `Showing last ${Math.min(limit, sampleHistoricalData.length)} historical data points`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in getSampleData:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Unable to retrieve sample data',
      error: error.message
    });
  }
};

// Helper function to generate empty forecast response
const getEmptyForecastResponse = (reason = 'Service unavailable') => ({
  summary: {
    predictedRevenue: 0,
    growthRate: 0,
    confidence: 0,
    bestCase: 0,
    worstCase: 0,
    dailyAverage: 0
  },
  dailyForecast: [],
  lineGraphData: [],
  topProducts: [],
  modelInfo: {
    type: 'No model available',
    dataPoints: 0,
    forecastHorizon: 'N/A',
    lastDataDate: 'N/A',
    totalHistoricalDays: 0,
    dateRange: 'N/A'
  },
  serviceStatus: 'unavailable',
  message: reason,
  note: 'Please ensure the Python forecasting service is running and data.csv contains historical data from 2023 onwards'
});

// Helper function to validate forecast response
const validateForecastResponse = (data) => {
  const requiredFields = ['summary', 'dailyForecast', 'lineGraphData', 'modelInfo'];
  const summaryFields = ['predictedRevenue', 'growthRate', 'confidence', 'bestCase', 'worstCase', 'dailyAverage'];
  
  // Check main structure
  for (const field of requiredFields) {
    if (!data[field]) {
      console.warn(`Missing field in forecast response: ${field}`);
      return false;
    }
  }
  
  // Check summary fields
  for (const field of summaryFields) {
    if (data.summary[field] === undefined || data.summary[field] === null) {
      console.warn(`Missing summary field: ${field}`);
      return false;
    }
  }
  
  // Validate data arrays
  if (!Array.isArray(data.dailyForecast) || !Array.isArray(data.lineGraphData)) {
    console.warn('Invalid array structure in forecast response');
    return false;
  }
  
  return true;
};

// @desc    Validate forecast data integrity
// @route   GET /api/sales/validate
// @access  Private/Admin
const validateForecastData = async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    
    const forecastResponse = await fetch(
      `http://localhost:5001/api/sales/forecast?period=${period}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    
    if (!forecastResponse.ok) {
      return res.json({
        valid: false,
        message: 'Forecasting service unavailable',
        status: 'service_error'
      });
    }
    
    const forecastData = await forecastResponse.json();
    const isValid = validateForecastResponse(forecastData);
    
    const validation = {
      valid: isValid,
      status: isValid ? 'valid' : 'invalid',
      checks: {
        hasHistoricalData: forecastData.lineGraphData?.some(item => item.type === 'historical') || false,
        hasForecastData: forecastData.lineGraphData?.some(item => item.type === 'forecast') || false,
        historicalDataPoints: forecastData.modelInfo?.totalHistoricalDays || 0,
        forecastDataPoints: forecastData.dailyForecast?.length || 0,
        dateRangeCoverage: forecastData.modelInfo?.dateRange || 'Unknown',
        modelTrained: !!forecastData.modelInfo?.type && forecastData.modelInfo.type !== 'No model available'
      },
      recommendations: []
    };
    
    // Add recommendations based on validation
    if (validation.checks.historicalDataPoints < 30) {
      validation.recommendations.push('Consider adding more historical data for better predictions');
    }
    
    if (!validation.checks.modelTrained) {
      validation.recommendations.push('Model needs to be trained with valid data');
    }
    
    if (!validation.checks.hasHistoricalData) {
      validation.recommendations.push('No historical data available for visualization');
    }
    
    res.json(validation);
    
  } catch (error) {
    console.error('Error in validateForecastData:', error);
    
    res.json({
      valid: false,
      status: 'error',
      message: error.message,
      checks: {},
      recommendations: ['Check if forecasting service is running', 'Verify data.csv exists and contains valid data']
    });
  }
};

export { 
  getSalesForecast,
  getDataStatus,
  checkForecastingHealth,
  refreshForecastModels,
  getHistorySummary,
  getSampleData,
  validateForecastData
};