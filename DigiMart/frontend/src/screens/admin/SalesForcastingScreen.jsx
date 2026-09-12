import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, Button, Card, Row, Col, Table, Badge, Dropdown, Tabs, Tab, ProgressBar } from 'react-bootstrap';
import { FaChartLine, FaCalendarAlt, FaArrowUp, FaArrowDown, FaBoxes, FaChevronDown, FaSyncAlt } from 'react-icons/fa';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Constants
const DEFAULT_REVENUE_SCENARIOS = {
  predicted: { label: 'Point Forecast', key: 'predictedRevenue', color: '#16a34a' },
  best: { label: 'Upper Bound', key: 'bestCase', color: '#2563eb' },
  worst: { label: 'Lower Bound', key: 'worstCase', color: '#dc3545' }
};
const CHART_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'];

// Utility functions
const formatCurrency = (amount) => 
  amount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount) : '$0';

const parseCalendarDate = (dateString) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || '');
  if (!match) return new Date(dateString);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const formatDate = (dateString, options = { month: 'short', day: 'numeric' }) =>
  parseCalendarDate(dateString).toLocaleDateString('en-IN', options);

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const intervalLevelLabel = (forecast) => {
  const interval = forecast?.summary?.interval80;
  const configuredLevel = forecast?.modelInfo?.predictionIntervalLevel;

  if (!interval && !configuredLevel) return null;
  if (typeof configuredLevel === 'string' && configuredLevel.trim()) {
    return configuredLevel.includes('%')
      ? configuredLevel
      : `${configuredLevel}%`;
  }

  const level = toFiniteNumber(interval?.level);
  if (level === undefined) return '80%';
  return `${level <= 1 ? Math.round(level * 100) : Math.round(level)}%`;
};

const useMediaQuery = (query) => {
  const getMatches = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
};


// Components
const Loader = () => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => setDots(prev => prev === '...' ? '' : prev + '.'), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '60vh' }}>
      <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}>
        <span className="visually-hidden">Loading...</span>
      </div>
      <h3 className="text-primary">Forecasting{dots}</h3>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const isForecastBridge = payload[0]?.payload?.isForecastBridge;
  const visibleEntries = payload.filter(
    entry => !(isForecastBridge && String(entry.dataKey).startsWith('future'))
  );
  
  return (
    <div className="forecast-tooltip bg-white p-3 rounded shadow border">
      <p className="fw-bold mb-2 text-dark">
        Date: {formatDate(label, { year: 'numeric', month: 'numeric', day: 'numeric' })}
      </p>
      {visibleEntries.map((entry, index) => (
        <p key={index} className="mb-1" style={{ color: entry.color }}>
          {entry.name}: {Array.isArray(entry.value)
            ? `${formatCurrency(entry.value[0])} to ${formatCurrency(entry.value[1])}`
            : formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color = '#667eea', hasData, progress }) => (
  <Card className="border-0 shadow-sm h-100">
    <Card.Body className="p-3">
      <div className="d-flex justify-content-between align-items-center">
        <div className="flex-grow-1">
          <h3 className="mb-1 fw-bold" style={{ color: hasData ? color : '#6c757d' }}>
            {hasData ? value : 'No Data'}
          </h3>
          <p className="mb-0 text-muted small fw-medium">{title}</p>
          {progress !== undefined && hasData && (
            <ProgressBar now={progress} className="mt-2" style={{ height: '4px' }} />
          )}
        </div>
        <Icon size={32} color={color} style={{ opacity: 0.7 }} />
      </div>
    </Card.Body>
  </Card>
);

const DropdownMetricCard = ({ scenarios, currentKey, onSelect, displayData, hasData, icon: Icon }) => {
  const current = scenarios[currentKey];
  const currentValue = displayData.summary[current.key];
  
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="flex-grow-1">
            <Dropdown>
              <Dropdown.Toggle as="div" className="cursor-pointer">
                <div className="d-flex align-items-center">
                  <h3 className="mb-1 fw-bold text-dark me-2">
                    {hasData ? formatCurrency(currentValue) : 'No Data'}
                  </h3>
                  <FaChevronDown size={12} className="text-muted" />
                </div>
              </Dropdown.Toggle>
              
              <Dropdown.Menu className="shadow border-0 rounded" style={{ minWidth: '280px' }}>
                {Object.entries(scenarios).map(([key, scenario]) => (
                  <Dropdown.Item key={key} onClick={() => onSelect(key)} className="py-2">
                    <div>
                      <div className="fw-semibold mb-1" style={{ color: scenario.color }}>
                        {scenario.label}
                      </div>
                      <div className="fw-bold mb-1" style={{ color: scenario.color }}>
                        {hasData ? formatCurrency(displayData.summary[scenario.key]) : 'No Data'}
                      </div>
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <p className="mb-0 text-muted small fw-medium">{current.label}</p>
          </div>
          <Icon size={32} color="#667eea" style={{ opacity: 0.7 }} />
        </div>
      </Card.Body>
    </Card>
  );
};

const ModelMetricsCard = ({ metrics, hasData }) => {
  const [selectedMetric, setSelectedMetric] = useState('mae');

  if (!hasData || !metrics) {
    return (
      <Card className="border-0 shadow-sm h-100">
        <Card.Body className="p-3 text-center">
          <div className="text-muted mb-2" style={{ fontSize: '14px' }}>Mean Actual: $0</div>
          <p className="text-muted mb-0">Model metrics unavailable</p>
        </Card.Body>
      </Card>
    );
  }

  const metricOptions = {
    mae: { 
      label: 'MAE', 
      value: metrics.mae, 
      normalizedValue: metrics.mae_normalized,
      format: (val) => `$${val?.toFixed(0) || 0}`,
      formatNormalized: (val) => `${(val * 100)?.toFixed(2) || 0}%`,
      description: 'Mean Absolute Error',
      showNormalized: true,
      errorRatio: metrics.mae_normalized
    },
    rmse: { 
      label: 'RMSE', 
      value: metrics.rmse, 
      normalizedValue: metrics.rmse_normalized,
      format: (val) => `$${val?.toFixed(0) || 0}`,
      formatNormalized: (val) => `${(val * 100)?.toFixed(2) || 0}%`,
      description: 'Root Mean Squared Error',
      showNormalized: true,
      errorRatio: metrics.rmse_normalized
    },
    mape: { 
      label: 'MAPE', 
      value: metrics.mape, 
      format: (val) => `${val?.toFixed(1) || 0}%`,
      description: 'Mean Absolute Percentage Error',
      showNormalized: false,
      errorRatio: (metrics.mape || 0) / 100
    }
  };

  const mase = toFiniteNumber(metrics.mase);
  if (mase !== undefined) {
    metricOptions.mase = {
      label: 'MASE',
      value: mase,
      format: (val) => val.toFixed(2),
      description: 'Mean Absolute Scaled Error',
      showNormalized: false,
      baselineRatio: mase
    };
  }

  const wape = toFiniteNumber(metrics.wape);
  if (wape !== undefined) {
    metricOptions.wape = {
      label: 'WAPE',
      value: wape,
      format: (val) => `${val.toFixed(1)}%`,
      description: 'Weighted Absolute Percentage Error',
      showNormalized: false,
      errorRatio: wape / 100
    };
  }

  const rmsse = toFiniteNumber(metrics.rmsse);
  if (rmsse !== undefined) {
    metricOptions.rmsse = {
      label: 'RMSSE',
      value: rmsse,
      format: (val) => val.toFixed(2),
      description: 'Root Mean Squared Scaled Error',
      showNormalized: false,
      baselineRatio: rmsse
    };
  }

  const current = metricOptions[selectedMetric] || metricOptions.mae;
  const metricPerformance = current.baselineRatio !== undefined
    ? current.baselineRatio < 1
      ? { variant: 'success', text: 'Beats Seasonal Naive' }
      : current.baselineRatio <= 1.1
        ? { variant: 'warning', text: 'Near Seasonal Naive' }
        : { variant: 'danger', text: 'Below Seasonal Naive' }
    : null;

  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="flex-grow-1">
            <Dropdown>
              <Dropdown.Toggle as="div" className="cursor-pointer">
                <div className="d-flex align-items-center">
                  <h3 className="mb-1 fw-bold text-dark me-2">{current.format(current.value)}</h3>
                  <FaChevronDown size={12} className="text-muted" />
                </div>
              </Dropdown.Toggle>
              
              <Dropdown.Menu className="shadow border-0 rounded">
                {Object.entries(metricOptions).map(([key, metric]) => (
                  <Dropdown.Item key={key} onClick={() => setSelectedMetric(key)} className="py-2">
                    <div className="fw-semibold text-primary">{metric.label}</div>
                    <div className="fw-bold text-dark">{metric.format(metric.value)}</div>
                    {metric.showNormalized && (
                      <div className="fw-bold text-success">
                        Normalized: {metric.formatNormalized(metric.normalizedValue)}
                      </div>
                    )}
                    <div className="small text-muted">{metric.description}</div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            
            <p className="mb-0 text-muted small fw-medium">{current.description}</p>
            {current.showNormalized && (
              <p className="mb-1 text-success small fw-medium">
                Normalized: {current.formatNormalized(current.normalizedValue)}
              </p>
            )}
            {metricPerformance && (
              <Badge bg={metricPerformance.variant} className="mt-1">{metricPerformance.text}</Badge>
            )}
          </div>
          <div className="text-center">
            <div className="text-info mb-1" style={{ fontSize: '14px', fontWeight: 'bold' }}>
              ${metrics.mean_actual?.toFixed(0) || 0}
            </div>
            <div className="text-muted" style={{ fontSize: '11px' }}>
              Mean Actual
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

const CategoryChart = ({ categories, hasData, isMobile }) => {
  if (!hasData || !categories?.length) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center bg-light rounded" style={{ height: '300px' }}>
        <FaBoxes size={48} color="#6c757d" className="mb-3" />
        <p className="text-muted mb-0">No category data available</p>
      </div>
    );
  }

  const chartData = categories.slice(0, 8).map((cat, index) => ({
    name: cat.category.length > 12 ? cat.category.substring(0, 12) + '...' : cat.category,
    fullName: cat.category,
    quantity: cat.total_predicted_quantity,
    fill: CHART_COLORS[index % CHART_COLORS.length]
  }));

  if (isMobile) {
    return (
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={9} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748b"
            fontSize={9}
            width={82}
            tickLine={false}
          />
          <Tooltip formatter={(value, name, props) => [`${value} units`, props.payload.fullName]} />
          <Bar dataKey="quantity" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          stroke="#64748b"
          fontSize={12}
          textAnchor="middle"
          height={30}
          interval={0}
        />
        <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
        <Tooltip formatter={(value, name, props) => [`${value} units`, props.payload.fullName]} />
        <Bar dataKey="quantity" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const EvaluationPanel = ({ evaluation }) => {
  if (!evaluation?.modelComparison?.length) {
    return <Alert variant="secondary" className="mb-0">Model evaluation is unavailable.</Alert>;
  }

  const tests = evaluation.diagnostics?.ljung_box || [];
  const residualsPass = tests.length > 0 && tests.every((test) => test.p_value >= 0.05);
  const interval80 = evaluation.predictionIntervals?.['80'];
  const interval95 = evaluation.predictionIntervals?.['95'];

  return (
    <div className="forecast-panel p-4">
      <h4 className="mb-2 fw-semibold">Model Evaluation</h4>
      <p className="text-muted small mb-4">
        Orders are selected on rolling validation data. Final-test results are reported only after selection.
      </p>
      <Table hover responsive className="forecast-category-table align-middle">
        <thead className="bg-light">
          <tr>
            <th className="p-3">Model</th>
            <th className="p-3">Validation MASE</th>
            <th className="p-3">Validation RMSE</th>
            <th className="p-3">Final MASE</th>
            <th className="p-3">Final RMSE</th>
          </tr>
        </thead>
        <tbody>
          {evaluation.modelComparison.map((row) => (
            <tr key={row.key}>
              <td className="p-3 fw-semibold">{row.model}</td>
              <td className="p-3">{toFiniteNumber(row.validation?.mase)?.toFixed(3) || 'N/A'}</td>
              <td className="p-3">{formatCurrency(row.validation?.rmse)}</td>
              <td className="p-3">{toFiniteNumber(row.final_test?.mase)?.toFixed(3) || 'N/A'}</td>
              <td className="p-3">{formatCurrency(row.final_test?.rmse)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Row className="g-3 mt-1">
        <Col md={6}>
          <Card className="border-0 bg-light h-100">
            <Card.Body>
              <h6 className="fw-semibold">Residual check</h6>
              <Badge bg={residualsPass ? 'success' : 'warning'} className="mb-2">
                {residualsPass ? 'No significant autocorrelation' : 'Autocorrelation remains'}
              </Badge>
              <div className="small text-muted">
                {tests.map((test) => `Lag ${test.lag}: p=${Number(test.p_value).toFixed(4)}`).join(' | ') || 'No diagnostic results'}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 bg-light h-100">
            <Card.Body>
              <h6 className="fw-semibold">Prediction interval coverage</h6>
              <div className="small text-muted">
                80% interval: {interval80 ? `${(interval80.coverage * 100).toFixed(1)}%` : 'N/A'}
              </div>
              <div className="small text-muted">
                95% interval: {interval95 ? `${(interval95.coverage * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const buildForecastViewModel = (forecastResult, metricsData) => {
  const forecastIsAvailable = Boolean(
    forecastResult &&
    (!forecastResult.serviceStatus || forecastResult.serviceStatus === 'success') &&
    Array.isArray(forecastResult.dailyForecast) &&
    forecastResult.dailyForecast.length > 0
  );
  if (!forecastIsAvailable) {
    throw new Error(forecastResult?.message || 'Forecast data is unavailable');
  }

  let mainModelMetrics = null;
  let categoryModelsCount = forecastResult.modelInfo?.categoryModels || 0;
  let dataPoints = forecastResult.modelInfo?.dataPoints || 0;
  let modelType = forecastResult.modelInfo?.type || 'Unknown';
  let evaluation = null;

  if (
    metricsData?.serviceStatus !== 'unavailable' &&
    metricsData?.main_model
  ) {
    mainModelMetrics = {
      mae: toFiniteNumber(metricsData.main_model.mae),
      rmse: toFiniteNumber(metricsData.main_model.rmse),
      mape: toFiniteNumber(metricsData.main_model.mape),
      mae_normalized: toFiniteNumber(metricsData.main_model.mae_normalized),
      rmse_normalized: toFiniteNumber(metricsData.main_model.rmse_normalized),
      mean_actual: toFiniteNumber(metricsData.main_model.mean_actual),
      mase: toFiniteNumber(metricsData.main_model.mase),
      wape: toFiniteNumber(metricsData.main_model.wape),
      rmsse: toFiniteNumber(metricsData.main_model.rmsse)
    };
    modelType = metricsData.main_model.type || 'Unknown';
    categoryModelsCount =
      metricsData.category_models_count ?? categoryModelsCount;
    dataPoints = metricsData.data_points ?? dataPoints;
    evaluation = {
      modelComparison: Array.isArray(metricsData.model_comparison)
        ? metricsData.model_comparison
        : [],
      diagnostics: metricsData.diagnostics || null,
      predictionIntervals: metricsData.prediction_intervals || null,
      methodology: metricsData.methodology || null
    };
  }

  return {
    ...forecastResult,
    modelInfo: {
      ...forecastResult.modelInfo,
      metrics: mainModelMetrics,
      categoryModels: categoryModelsCount,
      dataPoints,
      modelType
    },
    evaluation
  };
};

const SalesForcastingScreen = () => {
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('predicted');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState(null);
  const [tableAnimate, setTableAnimate] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculationNotice, setRecalculationNotice] = useState(null);
  const isMobile = useMediaQuery('(max-width: 575.98px)');

  // Fetch data
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        setForecastData(null);
        setSelectedDate(null);

        const [forecastResponse, metricsResponse] = await Promise.all([
          fetch('/api/sales/forecast', {
            signal: controller.signal
          }),
          fetch('/api/sales/metrics', {
            signal: controller.signal
          }).catch((error) => {
            if (error.name === 'AbortError') throw error;
            return null;
          })
        ]);

        if (!forecastResponse.ok) {
          const errorData = await forecastResponse.json().catch(() => null);
          throw new Error(errorData?.message || 'Forecast data is unavailable');
        }

        const forecastResult = await forecastResponse.json().catch(() => null);
        const metricsData = metricsResponse?.ok
          ? await metricsResponse.json().catch(() => null)
          : null;

        if (controller.signal.aborted) return;

        setForecastData(buildForecastViewModel(forecastResult, metricsData));
        setSelectedDate(forecastResult.dailyForecast[0].date);
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Error fetching data:', err);
        setForecastData(null);
        setFetchError(err.message || 'Forecast data is temporarily unavailable');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchData();

    return () => controller.abort();
  }, []);

  // Animate table when selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;
    setTableAnimate(true);
    const t = setTimeout(() => setTableAnimate(false), 700);
    return () => clearTimeout(t);
  }, [selectedDate]);

  // Memoized values
  const displayData = useMemo(() => forecastData || {
    summary: { predictedRevenue: 0, growthRate: 0, confidence: 0, bestCase: 0, worstCase: 0, dailyAverage: 0 },
    dailyForecast: [], categoryForecast: [], lineGraphData: [], topProducts: [],
    modelInfo: { metrics: null }, evaluation: null
  }, [forecastData]);
  
  const hasData = useMemo(() => Boolean(forecastData), [forecastData]);
  const hasMetrics = useMemo(() => Boolean(forecastData?.modelInfo?.metrics), [forecastData]);
  const selectedForecastRow = useMemo(() => {
    const forecasts = displayData.dailyForecast || [];
    if (!forecasts.length) return null;
    return forecasts.find((row) => row.date === selectedDate) || forecasts[0];
  }, [displayData.dailyForecast, selectedDate]);

  const revenueScenarios = useMemo(() => {
    const level = intervalLevelLabel(displayData);
    if (!level) return DEFAULT_REVENUE_SCENARIOS;

    return {
      ...DEFAULT_REVENUE_SCENARIOS,
      best: {
        ...DEFAULT_REVENUE_SCENARIOS.best,
        label: `${level} Upper Bound`
      },
      worst: {
        ...DEFAULT_REVENUE_SCENARIOS.worst,
        label: `${level} Lower Bound`
      }
    };
  }, [displayData]);
  
  const chartInterval = useMemo(() => {
    if (!displayData.lineGraphData?.length) return 0;
    const targetTicks = isMobile ? 5 : 20;
    return Math.max(1, Math.floor(displayData.lineGraphData.length / targetTicks));
  }, [displayData.lineGraphData, isMobile]);

  const growthMetrics = useMemo(() => {
    if (!hasData) return { icon: FaChartLine, color: '#6c757d' };
    const growth = displayData.summary.growthRate;
    return {
      icon: growth > 0 ? FaArrowUp : growth < 0 ? FaArrowDown : FaChartLine,
      color: growth > 0 ? '#28a745' : growth < 0 ? '#dc3545' : '#6c757d'
    };
  }, [hasData, displayData.summary.growthRate]);

  // Event handlers
  const handleScenarioChange = useCallback((scenario) => setSelectedScenario(scenario), []);
  const handleRecalculate = useCallback(async () => {
    if (isRecalculating) return;
    setIsRecalculating(true);
    setRecalculationNotice({
      variant: 'info',
      message: 'Recalculating from cleaned_customer_data.csv. This can take one to two minutes.'
    });

    try {
      const response = await fetch('/api/sales/recalculate', {
        method: 'POST'
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || 'Forecast recalculation failed');
      }

      const nextForecast = buildForecastViewModel(
        result.forecast,
        result.metrics
      );
      setForecastData(nextForecast);
      setSelectedDate(result.forecast.dailyForecast[0]?.date || null);
      setFetchError(null);
      const persistenceNote =
        result.persistence === 'temporary'
          ? ' The result is active on this page; commit regenerated artifacts for permanent Vercel storage.'
          : ' The local artifact files were updated.';
      setRecalculationNotice({
        variant: 'success',
        message:
          'Forecast recalculated in ' +
          Number(result.durationSeconds).toFixed(1) +
          ' seconds.' +
          persistenceNote
      });
    } catch (error) {
      setRecalculationNotice({
        variant: 'danger',
        message: error.message || 'Forecast recalculation failed'
      });
    } finally {
      setIsRecalculating(false);
    }
  }, [isRecalculating]);

  if (isLoading) return <Loader />;

  return (
    <div className="forecast-dashboard container-fluid">
      <style>{`
        .cursor-pointer { cursor: pointer; }
        .dropdown-toggle::after { display: none !important; }
        .nav-tabs .nav-link { border: none; color: #6c757d; font-weight: 500; padding: 15px 20px; }
        .nav-tabs .nav-link:hover { border: none; color: #667eea; }
        .nav-tabs .nav-link.active { border: none; color: #667eea; background: transparent; border-bottom: 3px solid #667eea; }
        .fade-in { animation: fadeIn 0.6s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fa-spin { animation: forecastSpin 1s linear infinite; }
        @keyframes forecastSpin { to { transform: rotate(360deg); } }
        .forecast-dashboard { max-width: 1400px; padding: 20px; }
        .forecast-chart { width: 100%; height: 400px; min-width: 0; }
        .forecast-legend { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .forecast-summary-item { min-width: 0; }
        .forecast-summary-item .fw-bold { overflow-wrap: anywhere; }
        .forecast-header-actions { gap: 0.75rem; }
        @media (max-width: 575.98px) {
          .forecast-dashboard { padding: 0; }
          .forecast-dashboard .card-body { padding: 0.9rem; }
          .forecast-dashboard-header { align-items: flex-start !important; gap: 1rem; }
          .forecast-dashboard-header h1 { font-size: 1.5rem; line-height: 1.2; }
          .forecast-dashboard-header p { font-size: 0.85rem; }
          .forecast-header-icon { font-size: 2rem; flex: 0 0 auto; margin-right: 0.65rem !important; }
          .forecast-header-actions, .forecast-period-dropdown, .forecast-recalculate-button { width: 100%; }
          .forecast-dashboard .nav-tabs .nav-link { padding: 0.75rem 0.35rem; font-size: 0.78rem; }
          .forecast-dashboard .nav-tabs svg { margin-right: 0.25rem !important; }
          .forecast-panel { padding: 0.75rem !important; }
          .forecast-panel-heading { align-items: flex-start !important; gap: 0.65rem; }
          .forecast-panel-heading h4 { font-size: 1rem; }
          .forecast-legend { gap: 0.75rem; }
          .forecast-chart { height: 300px; }
          .forecast-tooltip { max-width: 205px; padding: 0.55rem !important; font-size: 0.72rem; }
          .forecast-tooltip p { white-space: normal; }
          .forecast-summary-card .card-body { padding: 0.85rem; }
          .forecast-summary-card h5 { font-size: 1rem; margin-bottom: 1rem !important; }
          .forecast-summary-item { padding: 0.55rem; border-radius: 0.5rem; background: #f8f9fa; height: 100%; }
          .forecast-category-table { font-size: 0.78rem; }
          .forecast-category-table th, .forecast-category-table td { padding: 0.65rem !important; white-space: nowrap; }
          .forecast-rankings-panel { padding: 0.75rem !important; }
        }
      `}</style>

      {fetchError && (
        <Alert variant="warning" role="alert" className="mb-4">
          {fetchError}
        </Alert>
      )}
      {recalculationNotice && (
        <Alert
          variant={recalculationNotice.variant}
          role="status"
          className="mb-4"
          dismissible={!isRecalculating}
          onClose={() => setRecalculationNotice(null)}
        >
          {recalculationNotice.message}
        </Alert>
      )}

      {/* Header */}
      <Card className="border-0 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '15px' }}>
        <Card.Body>
          <div className="forecast-dashboard-header d-flex flex-column flex-md-row align-items-md-center justify-content-between">
            <div className="d-flex align-items-center">
              <FaChartLine size={48} className="forecast-header-icon me-3" />
              <div>
                <h1 className="mb-2 fw-bold">Sales Forecasting Dashboard</h1>
              </div>
            </div>
            <div className="forecast-header-actions d-flex flex-column flex-sm-row">
              <Button
                variant="outline-light"
                className="forecast-recalculate-button"
                onClick={handleRecalculate}
                disabled={isRecalculating}
                title="Rebuild the forecast from cleaned_customer_data.csv"
              >
                <FaSyncAlt
                  className={'me-2 ' + (isRecalculating ? 'fa-spin' : '')}
                />
                {isRecalculating ? 'Recalculating...' : 'Recalculate Forecast'}
              </Button>
              <div className="forecast-period-dropdown btn btn-outline-light">
                <FaCalendarAlt className="me-2" />
                15 Days
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Key Metrics */}
      <Row className="g-3 mb-4">
        <Col lg={3} md={6}>
          <DropdownMetricCard
            scenarios={revenueScenarios}
            currentKey={selectedScenario}
            onSelect={handleScenarioChange}
            displayData={displayData}
            hasData={hasData}
            icon={FaChartLine}
          />
        </Col>
        <Col lg={3} md={6}>
          <MetricCard
            title="Daily Average"
            value={formatCurrency(displayData.summary.dailyAverage)}
            icon={FaCalendarAlt}
            hasData={hasData}
          />
        </Col>
        <Col lg={3} md={6}>
          <MetricCard
            title="Growth Rate"
            value={hasData ? `${displayData.summary.growthRate > 0 ? '+' : ''}${displayData.summary.growthRate}%` : 'No Data'}
            icon={growthMetrics.icon}
            color={growthMetrics.color}
            hasData={hasData}
          />
        </Col>
        <Col lg={3} md={6}>
          <ModelMetricsCard metrics={displayData.modelInfo?.metrics} hasData={hasMetrics} />
        </Col>
      </Row>
      {/* Main Content */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <Tabs activeKey={activeTab} onSelect={setActiveTab} className="nav-fill">
            
            <Tab eventKey="overview" title={<><FaChartLine className="me-2" />Revenue Forecast</>}>
              <div className="forecast-panel p-4">
                <div className="forecast-panel-heading d-flex flex-column flex-sm-row justify-content-between align-items-sm-center mb-4">
                  <h4 className="mb-0 fw-semibold">Sales Forecast Timeline</h4>
                  <div className="forecast-legend">
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#2563eb', borderRadius: '2px' }}></div>
                      <span className="small text-muted">Historical</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '12px', height: '3px', backgroundColor: '#f97316' }}></div>
                      <span className="small text-muted">Final-test prediction</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '12px', height: '3px', backgroundColor: '#16a34a' }}></div>
                      <span className="small text-muted">Future forecast</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#bbf7d0', borderRadius: '2px' }}></div>
                      <span className="small text-muted">80% interval</span>
                    </div>
                  </div>
                </div>
                
                <div className="forecast-chart">
                  {hasData && displayData.lineGraphData?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={displayData.lineGraphData}
                        margin={isMobile
                          ? { top: 10, right: 4, left: -18, bottom: 42 }
                          : { top: 20, right: 30, left: 30, bottom: 60 }}
                        onClick={(e) => {
                          try {
                            const date = e?.activeLabel || e?.payload?.date || null;
                            if (date) setSelectedDate(date);
                          } catch (err) {}
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#64748b"
                          fontSize={isMobile ? 9 : 10}
                          angle={isMobile ? -35 : -45}
                          textAnchor="end"
                          height={isMobile ? 50 : 60}
                          tickFormatter={formatDate}
                          interval={chartInterval}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={isMobile ? 9 : 12}
                          width={isMobile ? 48 : 60}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />

                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="futureInterval80"
                          stroke="none"
                          fill="#86efac"
                          fillOpacity={0.3}
                          name="80% Prediction Interval"
                          connectNulls={false}
                          activeDot={false}
                          isAnimationActive={false}
                        />
                        {/* Blue line - Historical/Actual data from dataset */}
                        <Line 
                          type="monotone" 
                          dataKey="actual" 
                          stroke="#2563eb" 
                          strokeWidth={2.5} 
                          dot={false} 
                          name="Historical Sales"
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                        {/* Orange line - protected rolling final-test predictions */}
                        <Line
                          type="monotone"
                          dataKey="testPredicted"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name="Test Predictions"
                          connectNulls={true}
                          isAnimationActive={false}
                        />
                        {/* Green line - Future forecasts (beyond dataset) - connects from test */}
                        <Line
                          type="monotone"
                          dataKey="futurePredicted"
                          stroke="#16a34a"
                          strokeWidth={2.5}
                          strokeDasharray="8 2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          dot={false}
                          activeDot={false}
                          name="Future Forecast"
                          connectNulls={true}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="d-flex flex-column align-items-center justify-content-center bg-light rounded h-100">
                      <FaChartLine size={64} color="#6c757d" className="mb-3" />
                      <h5 className="text-muted">No forecast data available</h5>
                    </div>
                  )}
                </div>

                {/* Summary + Per-category table (updates when clicking a date on the chart) */}
                {hasData && displayData.dailyForecast?.length > 0 && (
                  <Card className="forecast-summary-card border-0 shadow-sm mt-4">
                    <Card.Body>
                      <h5 className="mb-4 fw-semibold">Forecast Summary for Selected Date</h5>
                      {/* Totals */}
                      <Row className="g-2 mb-3">
                        <Col xs={12} sm={4}>
                          <div className="forecast-summary-item">
                          <div className="small text-muted">Selected Date</div>
                          <div className="fw-bold">{(() => {
                            // Get the effective date (default to first forecast date if selected is before forecast range)
                            const firstForecastDate = displayData.dailyForecast[0].date;
                            const effectiveDate = selectedDate || firstForecastDate;
                            
                            // Check if selected date is in forecast range
                            const isForecastDate = displayData.dailyForecast.some(d => d.date === effectiveDate);
                            
                            return formatDate(isForecastDate ? effectiveDate : firstForecastDate);
                          })()}</div>
                          </div>
                        </Col>
                        <Col xs={12} sm={4}>
                          <div className="forecast-summary-item">
                            <div className="small text-muted">Predicted Revenue</div>
                            <div className="fw-bold text-success">{(() => {
                              const firstForecastDate = displayData.dailyForecast[0].date;
                              const effectiveDate = selectedDate || firstForecastDate;
                              const isForecastDate = displayData.dailyForecast.some(d => d.date === effectiveDate);
                              const dateToUse = isForecastDate ? effectiveDate : firstForecastDate;
                              
                              return formatCurrency((displayData.dailyForecast.find(d => d.date === dateToUse) || {}).predicted || 0);
                            })()}</div>
                            {selectedForecastRow?.lower80 !== undefined &&
                              selectedForecastRow?.upper80 !== undefined && (
                              <div className="small text-muted mt-1">
                                80% interval: {formatCurrency(selectedForecastRow.lower80)} to{' '}
                                {formatCurrency(selectedForecastRow.upper80)}
                              </div>
                            )}
                          </div>
                        </Col>
                        <Col xs={12} sm={4}>
                          <div className="forecast-summary-item">
                          <div className="small text-muted">Total Items (predicted)</div>
                          <div className="fw-bold">{(() => {
                            const firstForecastDate = displayData.dailyForecast[0].date;
                            const effectiveDate = selectedDate || firstForecastDate;
                            const isForecastDate = displayData.dailyForecast.some(d => d.date === effectiveDate);
                            const dateToUse = isForecastDate ? effectiveDate : firstForecastDate;
                            
                            return displayData.categoryForecast.reduce((sum, cat) => {
                              const row = (cat.daily_forecasts || []).find(r => r.date === dateToUse);
                              return sum + (row?.predicted_quantity || 0);
                            }, 0);
                          })()}</div>
                          </div>
                        </Col>
                      </Row>

                      {/* Per-category breakdown */}
                      <Table hover responsive className={`forecast-category-table ${tableAnimate ? 'fade-in' : ''}`}>
                        <thead className="bg-light">
                          <tr>
                            <th className="p-3">Category</th>
                            <th className="p-3">Predicted Items</th>
                            <th className="p-3">Predicted Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayData.categoryForecast.map((cat, idx) => {
                              const firstForecastDate = displayData.dailyForecast[0].date;
                              const effectiveDate = selectedDate || firstForecastDate;
                              const isForecastDate = displayData.dailyForecast.some(d => d.date === effectiveDate);
                              const dateToUse = isForecastDate ? effectiveDate : firstForecastDate;
                              
                              const row = (cat.daily_forecasts || []).find(r => r.date === dateToUse);
                              const qty = row?.predicted_quantity || 0;
                              const amount = row?.predicted_revenue ?? null;
                              return (
                                <tr key={idx}>
                                  <td className="p-3">{cat.category}</td>
                                  <td className="p-3">{qty}</td>
                                  <td className="p-3">{amount !== null ? formatCurrency(amount) : '—'}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                )}
              </div>
            </Tab>

            <Tab eventKey="evaluation" title={<><FaChartLine className="me-2" />Evaluation</>}>
              <EvaluationPanel evaluation={displayData.evaluation} />
            </Tab>

            <Tab eventKey="categories" title={<><FaBoxes className="me-2" />Rankings {hasData && displayData.categoryForecast?.length > 0 && <Badge bg="primary" className="ms-2">{displayData.categoryForecast.length}</Badge>}</>}>
              <div className="forecast-rankings-panel p-4">
                <Row className="g-4">
                  <Col lg={8}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body>
                        <h5 className="mb-4 fw-semibold">Category Forecast</h5>
                        <CategoryChart categories={displayData.categoryForecast} hasData={hasData} isMobile={isMobile} />
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col lg={4}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body>
                        <h5 className="mb-4 fw-semibold">Top Categories</h5>
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {hasData && displayData.categoryForecast?.length ? (
                            displayData.categoryForecast.slice(0, 6).map((category, index) => (
                              <div key={index} className="d-flex justify-content-between align-items-center p-3 mb-2 bg-light rounded">
                                <div>
                                  <div className="fw-semibold">{category.category}</div>
                                  <div className="small text-muted">{category.total_predicted_quantity} units</div>
                                  <div className="small text-success">Avg: {category.daily_average} units/day</div>
                                </div>
                                <div 
                                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                  style={{ width: '30px', height: '30px', backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                >
                                  {index + 1}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center text-muted p-4">
                              <FaBoxes size={32} className="mb-2" />
                              <p className="mb-0">No category data</p>
                            </div>
                          )}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SalesForcastingScreen;
