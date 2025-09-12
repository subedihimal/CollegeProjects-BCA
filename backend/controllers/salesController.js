// @desc    Get sales forecast data
// @route   GET /api/sales/forecast
// @access  Private/Admin
const getSalesForecast = async (req, res) => {
  try {
    const { period = '3months' } = req.query;
    
    // Validate period parameter
    const validPeriods = ['3months', '6months', '1year'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        message: 'Invalid period. Must be one of: 3months, 6months, 1year'
      });
    }
    
    // Call the Python ARIMA forecasting engine
    const forecastResponse = await fetch(
      `http://localhost:5000/api/sales/forecast?period=${period}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging
        timeout: 30000, // 30 seconds
      }
    );
    
    // Check if the Python service is available
    if (!forecastResponse.ok) {
      if (forecastResponse.status === 500) {
        // Python service returned an error
        const errorData = await forecastResponse.json().catch(() => ({}));
        return res.status(200).json({
          summary: {
            predictedRevenue: 0,
            growthRate: 0,
            confidence: 0,
            bestCase: 0,
            worstCase: 0
          },
          monthlyForecast: [],
          topProducts: [],
          trends: {
            seasonality: 'Forecasting service temporarily unavailable',
            marketFactors: ['Service maintenance in progress'],
            risks: ['Forecasting data not available']
          },
          serviceStatus: 'error',
          message: errorData.error || 'Forecasting engine error'
        });
      }
      
      throw new Error(`Forecasting service responded with status: ${forecastResponse.status}`);
    }
    
    // Parse the forecast data from Python service
    const forecastData = await forecastResponse.json();
    
    // Add metadata about the service call
    forecastData.serviceStatus = 'success';
    forecastData.timestamp = new Date().toISOString();
    forecastData.period = period;
    
    // Log successful forecast generation (for monitoring)
    console.log(`Sales forecast generated successfully for period: ${period}`);
    console.log(`Predicted revenue: ${forecastData.summary?.predictedRevenue || 0}`);
    
    res.json(forecastData);
    
  } catch (error) {
    console.error('Error in getSalesForecast:', error);
    
    // Check if it's a connection error to Python service
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      console.error('Python forecasting service is not running on localhost:5000');
      
      // Return graceful fallback response
      return res.status(200).json({
        summary: {
          predictedRevenue: 0,
          growthRate: 0,
          confidence: 0,
          bestCase: 0,
          worstCase: 0
        },
        monthlyForecast: [],
        topProducts: [],
        trends: {
          seasonality: 'Forecasting service unavailable',
          marketFactors: ['Please start the Python forecasting engine'],
          risks: ['Run: python forecasting_engine.py']
        },
        serviceStatus: 'unavailable',
        message: 'Forecasting service not running. Please start the Python ARIMA engine.',
        troubleshooting: {
          step1: 'Ensure cleaned_customer_data.csv exists',
          step2: 'Run: python forecasting_engine.py',
          step3: 'Verify service is running on localhost:5000'
        }
      });
    }
    
    // Generic error response
    res.status(500).json({
      message: 'Unable to generate sales forecast',
      error: error.message,
      serviceStatus: 'error'
    });
  }
};

// @desc    Get forecasting model information
// @route   GET /api/sales/model-info
// @access  Private/Admin
const getModelInfo = async (req, res) => {
  try {
    const modelResponse = await fetch('http://localhost:5000/api/sales/model-info', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds
    });
    
    if (!modelResponse.ok) {
      throw new Error(`Model info service responded with status: ${modelResponse.status}`);
    }
    
    const modelData = await modelResponse.json();
    
    // Add timestamp
    modelData.timestamp = new Date().toISOString();
    
    res.json(modelData);
    
  } catch (error) {
    console.error('Error in getModelInfo:', error);
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      return res.status(200).json({
        model: 'Service Unavailable',
        parameters: null,
        data_points: 0,
        message: 'Python forecasting service not running',
        serviceStatus: 'unavailable'
      });
    }
    
    res.status(500).json({});
  }
};

// @desc    Check forecasting service health
// @route   GET /api/sales/health
// @access  Private/Admin
const checkForecastingHealth = async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const healthResponse = await fetch('http://localhost:5000/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!healthResponse.ok) {
      throw new Error(`Health check failed with status: ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    
    res.json({
      status: 'healthy',
      forecasting_service: healthData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Forecasting service health check failed:', error);
    
    res.status(200).json({
      status: 'unhealthy',
      forecasting_service: {
        status: 'unavailable',
        error: error.message
      },
      timestamp: new Date().toISOString(),
      instructions: [
        '1. Ensure Python dependencies are installed',
        '2. Run: python forecasting_engine.py',
        '3. Verify localhost:5000 is accessible'
      ]
    });
  }
};

// @desc    Refresh forecast cache (trigger model retrain)
// @route   POST /api/sales/refresh
// @access  Private/Admin
const refreshForecastModels = async (req, res) => {
  try {
    const refreshResponse = await fetch('http://localhost:5000/api/sales/retrain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds for model retraining
    });
    
    if (!refreshResponse.ok) {
      throw new Error(`Refresh failed with status: ${refreshResponse.status}`);
    }
    
    const refreshData = await refreshResponse.json();
    
    res.json({
      message: 'Forecast models refreshed successfully',
      details: refreshData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error refreshing forecast models:', error);
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
      return res.status(503).json({
        message: 'Forecasting service unavailable for refresh',
        error: 'Python service not running'
      });
    }
    
    res.status(500).json({
      message: 'Failed to refresh forecast models',
      error: error.message
    });
  }
};

export { 
  getSalesForecast,
  getModelInfo,
  checkForecastingHealth,
  refreshForecastModels
};