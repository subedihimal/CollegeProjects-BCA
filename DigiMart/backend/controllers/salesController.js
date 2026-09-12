const BASE_URL = (process.env.FORECAST_API_URL || 'http://localhost:5001').replace(
  /\/$/,
  ''
);

// Forecast responses are served from precomputed artifacts. Keep the timeout
// long enough for a serverless cold start without leaving Express requests open
// for several minutes when the upstream service is unavailable.
const configuredTimeout = Number(process.env.FORECAST_TIMEOUT_MS);
const DEFAULT_TIMEOUT =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 15000;
const configuredRecalculationTimeout = Number(
  process.env.FORECAST_RECALC_TIMEOUT_MS
);
const RECALCULATION_TIMEOUT =
  Number.isFinite(configuredRecalculationTimeout) &&
  configuredRecalculationTimeout > 0
    ? configuredRecalculationTimeout
    : 280000;

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const { timeout, ...fetchOptions } = options;
  const timeoutId = setTimeout(
    () => controller.abort(),
    timeout || DEFAULT_TIMEOUT
  );

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const serviceErrorResponse = (error, fallback) => ({
  status: 'service_unavailable',
  serviceStatus: 'unavailable',
  message:
    error.name === 'AbortError'
      ? 'Forecasting service timed out'
      : 'Forecasting service is unavailable',
  ...fallback,
});

const serviceErrorStatus = (error) =>
  error.name === 'AbortError' ? 504 : 502;

// @desc    Get sales forecast data
// @route   GET /api/sales/forecast
// @access  Private/Admin
const getSalesForecast = async (_req, res) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/forecast`);
    if (!response.ok) {
      throw new Error(`Forecasting service returned ${response.status}`);
    }

    const data = await response.json();
    return res.json({
      ...data,
      serviceStatus: 'success',
      timestamp: new Date().toISOString(),
      period: '15days',
    });
  } catch (error) {
    console.error('Forecast error:', error);
    return res.status(serviceErrorStatus(error)).json(
      serviceErrorResponse(error, {
        period: '15days',
        timestamp: new Date().toISOString(),
        summary: {
          predictedRevenue: 0,
          growthRate: 0,
          bestCase: 0,
          worstCase: 0,
          dailyAverage: 0,
        },
        dailyForecast: [],
        categoryForecast: [],
        lineGraphData: [],
        topProducts: [],
        modelInfo: {
          type: 'No model available',
          metrics: null,
          categoryModels: 0,
        },
      })
    );
  }
};

// @desc    Get forecasting evaluation metrics
// @route   GET /api/sales/metrics
// @access  Private/Admin
const getModelMetrics = async (_req, res) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/sales/metrics`);
    if (!response.ok) {
      throw new Error(`Metrics service returned ${response.status}`);
    }

    const data = await response.json();
    return res.json({
      ...data,
      serviceStatus: 'success',
      timestamp: new Date().toISOString(),
      period: '15days',
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return res.status(serviceErrorStatus(error)).json(
      serviceErrorResponse(error, {
        period: '15days',
        timestamp: new Date().toISOString(),
        main_model: null,
        rolling_validation: [],
        category_models_count: 0,
      })
    );
  }
};

// @desc    Recalculate forecasting artifacts on demand
// @route   POST /api/sales/recalculate
// @access  Private/Admin
const recalculateForecast = async (_req, res) => {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/sales/recalculate`,
      {
        method: 'POST',
        timeout: RECALCULATION_TIMEOUT,
        headers: {
          'X-Forecast-Recalculation-Key':
            process.env.FORECAST_RECALC_SECRET || '',
        },
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.error || 'Forecast recalculation failed',
        status: data?.status || 'recalculation_failed',
      });
    }
    return res.json(data);
  } catch (error) {
    console.error('Forecast recalculation error:', error);
    return res.status(serviceErrorStatus(error)).json(
      serviceErrorResponse(error, {
        status: 'recalculation_failed',
      })
    );
  }
};

export { getSalesForecast, getModelMetrics, recalculateForecast };
