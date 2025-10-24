import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Row, Col, Table, Badge, Dropdown, Tabs, Tab, ProgressBar } from 'react-bootstrap';
import { FaChartLine, FaCalendarAlt, FaArrowUp, FaArrowDown, FaCog, FaTrophy, FaExclamationTriangle, FaBoxes, FaPercent, FaChevronDown } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Constants
const PERIOD_OPTIONS = { '7days': '7 Days', '15days': '15 Days' };
const REVENUE_SCENARIOS = {
  predicted: { label: 'Expected Revenue', key: 'predictedRevenue', color: '#16a34a' },
  best: { label: 'Best Case', key: 'bestCase', color: '#2563eb' },
  worst: { label: 'Worst Case', key: 'worstCase', color: '#dc3545' }
};
const CHART_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'];

// Utility functions
const formatCurrency = (amount) => 
  amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : '₹0';

const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

const getPerformanceBadge = (r2) => {
  if (r2 >= 0.8) return { variant: 'success', text: 'Excellent' };
  if (r2 >= 0.6) return { variant: 'primary', text: 'Good' };
  if (r2 >= 0.4) return { variant: 'warning', text: 'Fair' };
  return { variant: 'danger', text: 'Poor' };
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
  
  return (
    <div className="bg-white p-3 rounded shadow border">
      <p className="fw-bold mb-2 text-dark">Date: {new Date(label).toLocaleDateString('en-IN')}</p>
      {payload.map((entry, index) => (
        <p key={index} className="mb-1" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
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
          <div className="text-muted mb-2" style={{ fontSize: '14px' }}>Mean Actual: ₹0</div>
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
      format: (val) => `₹${val?.toFixed(0) || 0}`,
      formatNormalized: (val) => `${(val * 100)?.toFixed(2) || 0}%`,
      description: 'Mean Absolute Error',
      showNormalized: true
    },
    rmse: { 
      label: 'RMSE', 
      value: metrics.rmse, 
      normalizedValue: metrics.rmse_normalized,
      format: (val) => `₹${val?.toFixed(0) || 0}`,
      formatNormalized: (val) => `${(val * 100)?.toFixed(2) || 0}%`,
      description: 'Root Mean Squared Error',
      showNormalized: true
    },
    r2: { 
      label: 'R²', 
      value: metrics.r2, 
      format: (val) => `${(val * 100)?.toFixed(1) || 0}%`,
      description: 'Coefficient of Determination',
      showNormalized: false
    }
  };

  const current = metricOptions[selectedMetric];
  const performance = getPerformanceBadge(metrics.r2);

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
            <Badge bg={performance.variant} className="mt-1">{performance.text}</Badge>
          </div>
          <div className="text-center">
            <div className="text-info mb-1" style={{ fontSize: '14px', fontWeight: 'bold' }}>
              ₹{metrics.mean_actual?.toFixed(0) || 0}
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

const CategoryChart = ({ categories, hasData }) => {
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

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip formatter={(value, name, props) => [`${value} units`, props.payload.fullName]} />
        <Bar dataKey="quantity" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const SalesForcastingScreen = () => {
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedScenario, setSelectedScenario] = useState('predicted');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState(null);
  const [tableAnimate, setTableAnimate] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        const [forecastResponse, metricsResponse] = await Promise.all([
          fetch(`http://localhost:5001/api/sales/forecast?period=${selectedPeriod}`).catch(() => ({ ok: false })),
          fetch('http://localhost:5001/api/sales/metrics').catch(() => ({ ok: false }))
        ]);
        
        const forecastData = forecastResponse.ok ? await forecastResponse.json().catch(() => null) : null;
        const metricsData = metricsResponse.ok ? await metricsResponse.json().catch(() => null) : null;
        
        // Extract metrics - simplified structure (removed MSE)
        let mainModelMetrics = null;
        let categoryModelsCount = 0;
        let dataPoints = 0;
        let modelType = 'Unknown';
        
        if (metricsData?.main_model) {
          // Use the metrics directly from main_model (no MSE, with normalized values)
          mainModelMetrics = {
            mae: metricsData.main_model.mae,
            rmse: metricsData.main_model.rmse,
            r2: metricsData.main_model.r2,
            mae_normalized: metricsData.main_model.mae_normalized,
            rmse_normalized: metricsData.main_model.rmse_normalized,
            mean_actual: metricsData.main_model.mean_actual
          };
          modelType = metricsData.main_model.type || 'Unknown';
          categoryModelsCount = metricsData.category_models_count || 0;
          dataPoints = metricsData.data_points || 0;
        }
        
        if (forecastData && Object.keys(forecastData).length > 0) {
          setForecastData({
            ...forecastData,
            modelInfo: {
              ...forecastData.modelInfo,
              metrics: mainModelMetrics,
              categoryModels: categoryModelsCount,
              dataPoints: dataPoints,
              modelType: modelType
            }
          });
          // set default selected date to first forecast date
          if (forecastData.dailyForecast && forecastData.dailyForecast.length > 0) {
            setSelectedDate(forecastData.dailyForecast[0].date);
          }
        } else {
          setForecastData(null);
        }
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setForecastData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedPeriod]);

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
    modelInfo: { metrics: null }
  }, [forecastData]);
  
  const hasData = useMemo(() => Boolean(forecastData), [forecastData]);
  const hasMetrics = useMemo(() => Boolean(forecastData?.modelInfo?.metrics), [forecastData]);
  
  const chartInterval = useMemo(() => {
    if (!displayData.lineGraphData?.length) return 0;
    return Math.max(1, Math.floor(displayData.lineGraphData.length / 20));
  }, [displayData.lineGraphData]);

  const growthMetrics = useMemo(() => {
    if (!hasData) return { icon: FaChartLine, color: '#6c757d' };
    const growth = displayData.summary.growthRate;
    return {
      icon: growth > 0 ? FaArrowUp : growth < 0 ? FaArrowDown : FaChartLine,
      color: growth > 0 ? '#28a745' : growth < 0 ? '#dc3545' : '#6c757d'
    };
  }, [hasData, displayData.summary.growthRate]);

  // Event handlers
  const handlePeriodChange = useCallback((period) => setSelectedPeriod(period), []);
  const handleScenarioChange = useCallback((scenario) => setSelectedScenario(scenario), []);

  if (isLoading) return <Loader />;

  return (
    <div className="container-fluid" style={{ maxWidth: '1400px', padding: '20px' }}>
      <style>{`
        .cursor-pointer { cursor: pointer; }
        .dropdown-toggle::after { display: none !important; }
        .nav-tabs .nav-link { border: none; color: #6c757d; font-weight: 500; padding: 15px 20px; }
        .nav-tabs .nav-link:hover { border: none; color: #667eea; }
        .nav-tabs .nav-link.active { border: none; color: #667eea; background: transparent; border-bottom: 3px solid #667eea; }
        .fade-in { animation: fadeIn 0.6s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <Card className="border-0 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '15px' }}>
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <FaChartLine size={48} className="me-3" />
              <div>
                <h1 className="mb-2 fw-bold">Sales Forecasting Dashboard</h1>
                <p className="mb-0 opacity-75">AI-powered revenue predictions with model performance metrics</p>
                {hasData && displayData.modelInfo?.categoryModels > 0 && (
                  <small className="d-block mt-1 opacity-75">
                    {displayData.modelInfo.categoryModels} Category Models Active
                  </small>
                )}
              </div>
            </div>
            <Dropdown>
              <Dropdown.Toggle variant="outline-light">
                <FaCalendarAlt className="me-2" />
                {PERIOD_OPTIONS[selectedPeriod]}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {Object.entries(PERIOD_OPTIONS).map(([key, label]) => (
                  <Dropdown.Item key={key} onClick={() => handlePeriodChange(key)}>
                    {label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Card.Body>
      </Card>

      {/* Key Metrics */}
      <Row className="g-3 mb-4">
        <Col lg={3} md={6}>
          <DropdownMetricCard
            scenarios={REVENUE_SCENARIOS}
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
              <div className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 className="mb-0 fw-semibold">Sales Forecast Timeline</h4>
                  <div className="d-flex gap-4">
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#2563eb', borderRadius: '2px' }}></div>
                      <span className="small text-muted">Historical</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#16a34a', borderRadius: '2px' }}></div>
                      <span className="small text-muted">Predicted</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ minHeight: '400px' }}>
                  {hasData && displayData.lineGraphData?.length ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart
                        data={displayData.lineGraphData}
                        margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
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
                          fontSize={10}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tickFormatter={formatDate}
                          interval={chartInterval}
                        />
                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2} dot={false} name="Historical Sales" />
                            <Line
                              type="monotone"
                              dataKey="predicted"
                              stroke="#16a34a"
                              strokeWidth={3}
                              strokeDasharray="5 5"
                              dot={{ r: 4 }}
                              name="Predicted Sales"
                            />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="d-flex flex-column align-items-center justify-content-center bg-light rounded" style={{ height: '400px' }}>
                      <FaChartLine size={64} color="#6c757d" className="mb-3" />
                      <h5 className="text-muted">No forecast data available</h5>
                    </div>
                  )}
                </div>

                {/* Summary + Per-category table (updates when clicking a date on the chart) */}
                {hasData && displayData.dailyForecast?.length > 0 && (
                  <Card className="border-0 shadow-sm mt-4">
                    <Card.Body>
                      <h5 className="mb-4 fw-semibold">Forecast Summary for Selected Date</h5>
                      {/* Totals */}
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
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
                        <div>
                            <div className="small text-muted">Predicted Revenue</div>
                            <div className="fw-bold text-success">{(() => {
                              const firstForecastDate = displayData.dailyForecast[0].date;
                              const effectiveDate = selectedDate || firstForecastDate;
                              const isForecastDate = displayData.dailyForecast.some(d => d.date === effectiveDate);
                              const dateToUse = isForecastDate ? effectiveDate : firstForecastDate;
                              
                              return formatCurrency((displayData.dailyForecast.find(d => d.date === dateToUse) || {}).predicted || 0);
                            })()}</div>
                          </div>
                        <div>
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
                      </div>

                      {/* Per-category breakdown */}
                      <Table hover responsive className={tableAnimate ? 'fade-in' : ''}>
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

            <Tab eventKey="categories" title={<><FaBoxes className="me-2" />Rankings {hasData && displayData.categoryForecast?.length > 0 && <Badge bg="primary" className="ms-2">{displayData.categoryForecast.length}</Badge>}</>}>
              <div className="p-4">
                <Row className="g-4">
                  <Col lg={8}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body>
                        <h5 className="mb-4 fw-semibold">Category Forecast</h5>
                        <CategoryChart categories={displayData.categoryForecast} hasData={hasData} />
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