import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Row, Col, Table, Badge, Dropdown } from 'react-bootstrap';
import { FaChartLine, FaCalendarAlt, FaArrowUp, FaArrowDown, FaCaretDown } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Constants
const MOCK_DATA = {
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
  topProducts: []
};

const PERIOD_OPTIONS = {
  '7days': '7 Days',
  '15days': '15 Days'
};

const REVENUE_SCENARIOS = {
  'predicted': { label: 'Expected Revenue', key: 'predictedRevenue', description: 'Most likely outcome' },
  'best': { label: 'Best Case', key: 'bestCase', description: 'Optimistic estimate' },
  'worst': { label: 'Worst Case', key: 'worstCase', description: 'Conservative estimate' }
};

// Utility functions
const formatCurrency = (amount) => {
  if (!amount) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric'
  });
};

const formatDateWithYear = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Components
const ForecastingLoader = () => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev === '...' ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" 
         style={{ height: '60vh', backgroundColor: '#f8f9fa' }}>
      <div style={{
        width: '60px',
        height: '60px',
        border: '6px solid #e3e3e3',
        borderTop: '6px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px'
      }}></div>
      <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#667eea' }}>
        Forecasting{dots}
      </h3>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div style={{
      backgroundColor: '#ffffff',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      border: '1px solid #e2e8f0',
      maxWidth: '300px'
    }}>
      <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#2c2c2c', margin: '0 0 8px 0' }}>
        Date: {formatDateWithYear(label)}
      </p>
      {payload.map((entry, index) => (
        <p key={index} style={{ fontSize: '0.85rem', fontWeight: '500', margin: '4px 0', color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
          {entry.payload.confidence && (
            <span style={{ fontSize: '0.8rem', marginLeft: '8px' }}>
              ({entry.payload.confidence}% confidence)
            </span>
          )}
        </p>
      ))}
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, hasData }) => {
  const iconColor = color || '#667eea';
  const valueColor = color || '#2c2c2c';
  
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center h-100">
          <div>
            <h3 className="mb-1" style={{ fontSize: '1.8rem', fontWeight: '700', color: valueColor }}>
              {hasData ? value : 'No Data'}
            </h3>
            <p className="mb-0 text-muted" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
              {title}
            </p>
            {title === 'Avg Confidence' && hasData && (
              <div style={{
                height: '4px',
                backgroundColor: '#28a745',
                borderRadius: '2px',
                marginTop: '10px',
                width: value,
                transition: 'width 0.3s ease'
              }}></div>
            )}
          </div>
          <Icon style={{ fontSize: '2.5rem', color: iconColor, opacity: 0.7 }} />
        </div>
      </Card.Body>
    </Card>
  );
};
const RevenueMetricCard = ({ displayData, hasData, selectedScenario, onScenarioChange }) => {
  const currentScenario = REVENUE_SCENARIOS[selectedScenario];
  const currentValue = displayData.summary[currentScenario.key];
  
  return (
    <Card className="border-0 shadow-sm h-100">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center h-100">
          <div className="flex-grow-1">
            <Dropdown>
              <Dropdown.Toggle 
                as="div"
                style={{ 
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  position: 'relative'
                }}
              >
                <h3 className="mb-1" style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2c2c2c' }}>
                  {hasData ? formatCurrency(currentValue) : 'No Data'}
                </h3>
                <FaCaretDown style={{ 
                  fontSize: '1rem', 
                  color: '#6c757d',
                  marginLeft: '4px',
                  transition: 'color 0.2s ease'
                }} />
              </Dropdown.Toggle>
              
              <Dropdown.Menu style={{
                minWidth: '280px',
                padding: '8px 0',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                marginTop: '8px'
              }}>
                {Object.entries(REVENUE_SCENARIOS).map(([key, scenario]) => (
                  <Dropdown.Item 
                    key={key} 
                    onClick={() => onScenarioChange(key)}
                    active={selectedScenario === key}
                    style={{
                      padding: '12px 20px',
                      margin: '4px 8px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: selectedScenario === key ? '#f0f9ff' : 'transparent',
                      borderLeft: selectedScenario === key ? '3px solid #667eea' : '3px solid transparent',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedScenario !== key) {
                        e.target.style.backgroundColor = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedScenario !== key) {
                        e.target.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '0.95rem',
                        color: key === 'predicted' ? '#16a34a' :
                               key === 'best' ? '#2563eb' :
                               key === 'worst' ? '#dc3545' : '#2c2c2c',
                        marginBottom: '4px'
                      }}>
                        {scenario.label}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: key === 'predicted' ? '#16a34a' :
                               key === 'best' ? '#2563eb' :
                               key === 'worst' ? '#dc3545' : '#16a34a',
                        fontWeight: '600',
                        marginBottom: '2px'
                      }}>
                        {hasData ? formatCurrency(displayData.summary[scenario.key]) : 'No Data'}
                      </div>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#6c757d', 
                        fontStyle: 'italic',
                        lineHeight: '1.3'
                      }}>
                        {scenario.description}
                      </div>
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            
            <p className="mb-0 text-muted" style={{ 
              fontSize: '0.9rem', 
              fontWeight: '500',
              marginTop: '4px'
            }}>
              {currentScenario.label}
            </p>
            <small className="text-muted" style={{ 
              fontSize: '0.8rem', 
              fontStyle: 'italic',
              color: '#6c757d'
            }}>
              {currentScenario.description}
            </small>
          </div>
          <FaChartLine style={{ 
            fontSize: '2.5rem', 
            color: '#667eea', 
            opacity: 0.7,
            marginLeft: '16px'
          }} />
        </div>
      </Card.Body>
      
      <style jsx>{`
        .dropdown-toggle::after {
          display: none !important;
        }
        
        .dropdown-item:hover {
          background-color: transparent !important;
        }
        
        .dropdown-item.active {
          background-color: transparent !important;
        }
      `}</style>
    </Card>
  );
};
const SalesForcastingScreen = () => {
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedScenario, setSelectedScenario] = useState('predicted');

  // Fetch data
  useEffect(() => {
    const fetchForecastData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sales/forecast?period=${selectedPeriod}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setForecastData(data && Object.keys(data).length > 0 ? data : null);
      } catch (err) {
        console.error('Error fetching forecast data:', err);
        setForecastData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForecastData();
  }, [selectedPeriod]);

  // Memoized values
  const displayData = useMemo(() => forecastData || MOCK_DATA, [forecastData]);
  const hasData = useMemo(() => forecastData && Object.keys(forecastData).length > 0, [forecastData]);
  
  const chartInterval = useMemo(() => {
    if (!displayData.lineGraphData?.length) return 0;
    return Math.max(1, Math.floor(displayData.lineGraphData.length / 20));
  }, [displayData.lineGraphData]);

  const growthIcon = useMemo(() => {
    if (!hasData) return FaChartLine;
    const growth = displayData.summary.growthRate;
    return growth > 0 ? FaArrowUp : growth < 0 ? FaArrowDown : FaChartLine;
  }, [hasData, displayData.summary.growthRate]);

  const growthColor = useMemo(() => {
    if (!hasData) return '#6c757d';
    const growth = displayData.summary.growthRate;
    return growth > 0 ? '#28a745' : growth < 0 ? '#dc3545' : '#6c757d';
  }, [hasData, displayData.summary.growthRate]);

  // Event handlers
  const handlePeriodChange = useCallback((period) => {
    setSelectedPeriod(period);
  }, []);

  const handleScenarioChange = useCallback((scenario) => {
    setSelectedScenario(scenario);
  }, []);

  if (isLoading) return <ForecastingLoader />;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <Card className="border-0 mb-4" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '15px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        color: 'white'
      }}>
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: '20px' }}>
            <div className="d-flex align-items-center flex-grow-1">
              <FaChartLine style={{ fontSize: '3rem', marginRight: '20px' }} />
              <div>
                <h1 className="mb-2" style={{ fontSize: '2.5rem', fontWeight: '700' }}>
                  Daily Sales Forecasting
                </h1>
                <p className="mb-0" style={{ fontSize: '1.1rem', opacity: 0.8 }}>
                  Complete historical data & predictive analytics for daily sales performance
                </p>
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
          <RevenueMetricCard
            displayData={displayData}
            hasData={hasData}
            selectedScenario={selectedScenario}
            onScenarioChange={handleScenarioChange}
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
            icon={growthIcon}
            color={growthColor}
            hasData={hasData}
          />
        </Col>
        <Col lg={3} md={6}>
          <MetricCard
            title="Avg Confidence"
            value={hasData ? `${displayData.summary.confidence}%` : 'No Data'}
            icon={FaChartLine}
            hasData={hasData}
          />
        </Col>
      </Row>

      {/* Main Chart */}
      <Row className="mb-4">
        <Col lg={12}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: '15px' }}>
                <div>
                  <h4 className="mb-0" style={{ fontSize: '1.3rem', fontWeight: '600', color: '#2c2c2c' }}>
                    Complete Sales History & Forecast
                    {forecastData?.modelInfo?.dateRange && (
                      <small className="d-block text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                        {forecastData.modelInfo.dateRange} ({forecastData.modelInfo.totalHistoricalDays} days)
                      </small>
                    )}
                  </h4>
                </div>
                <div className="d-flex gap-4 align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#2563eb', borderRadius: '2px' }}></div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Historical Sales</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#16a34a', borderRadius: '2px' }}></div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Predicted Sales</span>
                  </div>
                </div>
              </div>
              
              <div style={{ width: '100%', minHeight: '600px', position: 'relative' }}>
                {hasData && displayData.lineGraphData?.length ? (
                  <ResponsiveContainer width="100%" height={600}>
                    <LineChart data={displayData.lineGraphData} margin={{ top: 20, right: 30, left: 60, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={formatDate}
                        interval={chartInterval}
                      />
                      <YAxis 
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                        width={60}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#2563eb"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
                        connectNulls={false}
                        name="Historical Sales"
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#16a34a"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 7, stroke: '#16a34a', strokeWidth: 2 }}
                        connectNulls={false}
                        name="Predicted Sales"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center bg-light rounded border-2 border-dashed" 
                       style={{ padding: '60px 20px', minHeight: '600px', borderColor: '#dee2e6' }}>
                    <FaChartLine style={{ fontSize: '4rem', color: '#6c757d', marginBottom: '20px' }} />
                    <p className="mb-0 text-muted text-center" style={{ fontSize: '1.1rem', fontWeight: '500' }}>
                      No forecast data available for the selected period
                    </p>
                  </div>
                )}
              </div>
              
              {/* Data Summary */}
              {hasData && forecastData?.modelInfo && (
                <div className="mt-4 p-3 bg-light rounded border-top border-primary border-3">
                  <div className="d-flex justify-content-around align-items-center flex-wrap" style={{ gap: '15px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#495057', textAlign: 'center' }}>
                      <strong>Total Data Points:</strong> {forecastData.modelInfo.totalHistoricalDays || forecastData.modelInfo.dataPoints}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#495057', textAlign: 'center' }}>
                      <strong>Model:</strong> {forecastData.modelInfo.type}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#495057', textAlign: 'center' }}>
                      <strong>Last Updated:</strong> {forecastData.modelInfo.lastDataDate}
                    </span>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Secondary Content - Only Top Products */}
      <Row className="g-4 mb-4">
        <Col lg={12}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h4 className="mb-4" style={{ fontSize: '1.3rem', fontWeight: '600', color: '#2c2c2c' }}>
                Top Products Forecast
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {hasData && displayData.topProducts?.length ? (
                  displayData.topProducts.map((product, index) => (
                    <div key={index} className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#2c2c2c' }}>
                          {product.name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                          {formatCurrency(product.predictedSales)}
                        </div>
                      </div>
                      <Badge bg={product.growth > 0 ? 'success' : 'danger'} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                        {product.growth > 0 ? '+' : ''}{product.growth}%
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted p-4">
                    <p className="mb-0">No product forecast data available</p>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Forecast Details Table */}
      <Row>
        <Col lg={12}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <h4 className="mb-4" style={{ fontSize: '1.3rem', fontWeight: '600', color: '#2c2c2c' }}>
                Daily Forecast Details
              </h4>
              <Table hover responsive className="mb-0" style={{ fontSize: '0.9rem' }}>
                <thead className="bg-light">
                  <tr>
                    {['Date', 'Day', 'Predicted Sales', 'Confidence', 'Weekend'].map((header) => (
                      <th key={header} className="p-3 fw-semibold text-muted border-bottom-2" 
                          style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasData && displayData.dailyForecast?.length ? (
                    displayData.dailyForecast.map((item, index) => (
                      <tr key={index}>
                        <td className="p-3 border-bottom">{formatDate(item.date)}</td>
                        <td className="p-3 border-bottom">
                          <Badge bg={item.is_weekend ? 'warning' : 'primary'} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                            {item.day_name}
                          </Badge>
                        </td>
                        <td className="p-3 border-bottom">
                          <span className="fw-semibold" style={{ color: '#16a34a' }}>
                            {formatCurrency(item.predicted)}
                          </span>
                        </td>
                        <td className="p-3 border-bottom">
                          <Badge 
                            bg={item.confidence > 80 ? 'success' : item.confidence > 70 ? 'warning' : 'danger'}
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          >
                            {item.confidence}%
                          </Badge>
                        </td>
                        <td className="p-3 border-bottom">
                          <Badge bg={item.is_weekend ? 'warning' : 'light'} text={item.is_weekend ? 'dark' : 'dark'}>
                            {item.is_weekend ? 'Weekend' : 'Weekday'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-3 text-center text-muted border-bottom">
                        No forecast data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SalesForcastingScreen;