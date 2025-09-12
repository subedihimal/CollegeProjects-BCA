import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, Dropdown, Button } from 'react-bootstrap';
import { FaChartLine, FaCalendarAlt, FaArrowUp, FaArrowDown, FaDownload } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Loader from '../../components/Loader';

const SalesForcastingScreen = () => {
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('3months');

  useEffect(() => {
    const fetchForecastData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sales/forecast?period=${selectedPeriod}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || Object.keys(data).length === 0) {
          setForecastData(null);
          setError(null); // Don't set as error, just no data
        } else {
          setForecastData(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching forecast data:', err);
        setForecastData(null);
        setError(null); // Don't show error, just render with no data
      } finally {
        setIsLoading(false);
      }
    };

    fetchForecastData();
  }, [selectedPeriod]);

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={styles.tooltipContainer}>
          <p style={styles.tooltipLabel}>{`Month: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{
              ...styles.tooltipValue,
              color: entry.color
            }}>
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Mock data structure for when there's no data
  const mockData = {
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
      seasonality: 'No data available',
      marketFactors: ['No data available'],
      risks: ['No data available']
    }
  };

  const displayData = forecastData || mockData;
  const hasData = forecastData && Object.keys(forecastData).length > 0;

  if (isLoading) return <Loader />;

  return (
    <div style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Body>
          <div style={styles.headerContent}>
            <FaChartLine style={styles.headerIcon} />
            <div style={styles.headerText}>
              <h1 style={styles.title}>Sales Forecasting</h1>
              <p style={styles.subtitle}>Predictive analytics for future sales performance</p>
            </div>
            <div style={styles.headerControls}>
              <Dropdown>
                <Dropdown.Toggle variant="outline-light" id="period-dropdown">
                  <FaCalendarAlt style={{ marginRight: '8px' }} />
                  {selectedPeriod === '3months' ? '3 Months' : 
                   selectedPeriod === '6months' ? '6 Months' : '1 Year'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => setSelectedPeriod('3months')}>3 Months</Dropdown.Item>
                  <Dropdown.Item onClick={() => setSelectedPeriod('6months')}>6 Months</Dropdown.Item>
                  <Dropdown.Item onClick={() => setSelectedPeriod('1year')}>1 Year</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Key Metrics */}
      <Row className="mt-4">
        <Col lg={3} md={6} className="mb-3">
          <Card style={styles.metricCard}>
            <Card.Body style={styles.metricBody}>
              <div style={styles.metricContent}>
                <div>
                  <h3 style={styles.metricValue}>
                    {hasData ? formatCurrency(displayData.summary.predictedRevenue) : 'No Data'}
                  </h3>
                  <p style={styles.metricLabel}>Predicted Revenue</p>
                </div>
                <FaChartLine style={styles.metricIcon} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={3} md={6} className="mb-3">
          <Card style={styles.metricCard}>
            <Card.Body style={styles.metricBody}>
              <div style={styles.metricContent}>
                <div>
                  <h3 style={{
                    ...styles.metricValue, 
                    color: hasData ? (displayData.summary.growthRate > 0 ? '#28a745' : '#dc3545') : '#6c757d'
                  }}>
                    {hasData ? `${displayData.summary.growthRate > 0 ? '+' : ''}${displayData.summary.growthRate}%` : 'No Data'}
                  </h3>
                  <p style={styles.metricLabel}>Growth Rate</p>
                </div>
                {hasData && displayData.summary.growthRate > 0 ? 
                  <FaArrowUp style={{...styles.metricIcon, color: '#28a745'}} /> :
                  hasData && displayData.summary.growthRate < 0 ?
                  <FaArrowDown style={{...styles.metricIcon, color: '#dc3545'}} /> :
                  <FaChartLine style={styles.metricIcon} />
                }
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={3} md={6} className="mb-3">
          <Card style={styles.metricCard}>
            <Card.Body style={styles.metricBody}>
              <div style={styles.metricContent}>
                <div>
                  <h3 style={styles.metricValue}>
                    {hasData ? `${displayData.summary.confidence}%` : 'No Data'}
                  </h3>
                  <p style={styles.metricLabel}>Confidence Level</p>
                </div>
                <div style={{
                  ...styles.confidenceBar, 
                  width: hasData ? `${displayData.summary.confidence}%` : '0%'
                }}></div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={3} md={6} className="mb-3">
          <Card style={styles.metricCard}>
            <Card.Body style={styles.metricBody}>
              <div style={styles.scenarioContent}>
                <div style={styles.scenarioItem}>
                  <span style={styles.scenarioLabel}>Best Case</span>
                  <span style={{...styles.scenarioValue, color: hasData ? '#28a745' : '#6c757d'}}>
                    {hasData ? formatCurrency(displayData.summary.bestCase) : 'No Data'}
                  </span>
                </div>
                <div style={styles.scenarioItem}>
                  <span style={styles.scenarioLabel}>Worst Case</span>
                  <span style={{...styles.scenarioValue, color: hasData ? '#dc3545' : '#6c757d'}}>
                    {hasData ? formatCurrency(displayData.summary.worstCase) : 'No Data'}
                  </span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row className="mt-4">
        {/* Sales Forecast Chart */}
        <Col lg={8} className="mb-4">
          <Card style={styles.chartCard}>
            <Card.Body>
              <div style={styles.chartHeader}>
                <h4 style={styles.chartTitle}>Monthly Sales Forecast</h4>
                <div style={styles.chartLegend}>
                  <div style={styles.legendItem}>
                    <div style={{...styles.legendColor, backgroundColor: '#2563eb'}}></div>
                    <span style={styles.legendText}>Actual Sales</span>
                  </div>
                  <div style={styles.legendItem}>
                    <div style={{...styles.legendColor, backgroundColor: '#16a34a'}}></div>
                    <span style={styles.legendText}>Predicted Sales</span>
                  </div>
                </div>
              </div>
              <div style={styles.chartContainer}>
                {hasData && displayData.monthlyForecast && displayData.monthlyForecast.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart
                      data={displayData.monthlyForecast}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 20,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="month" 
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ fill: '#2563eb', strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, stroke: '#2563eb', strokeWidth: 2 }}
                        connectNulls={false}
                        name="Actual Sales"
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#16a34a"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ fill: '#16a34a', strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, stroke: '#16a34a', strokeWidth: 2 }}
                        name="Predicted Sales"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={styles.chartPlaceholder}>
                    <FaChartLine style={styles.chartPlaceholderIcon} />
                    <p style={styles.chartPlaceholderText}>
                      No forecast data available for the selected period
                    </p>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Top Products Forecast */}
        <Col lg={4} className="mb-4">
          <Card style={styles.chartCard}>
            <Card.Body>
              <h4 style={styles.chartTitle}>Top Products Forecast</h4>
              <div style={styles.productsList}>
                {hasData && displayData.topProducts && displayData.topProducts.length > 0 ? (
                  displayData.topProducts.map((product, index) => (
                    <div key={index} style={styles.productItem}>
                      <div style={styles.productInfo}>
                        <span style={styles.productName}>{product.name}</span>
                        <span style={styles.productSales}>{formatCurrency(product.predictedSales)}</span>
                      </div>
                      <Badge 
                        bg={product.growth > 0 ? 'success' : 'danger'}
                        style={styles.productGrowth}
                      >
                        {product.growth > 0 ? '+' : ''}{product.growth}%
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div style={styles.noDataMessage}>
                    <p>No product forecast data available</p>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Forecast Details Table */}
      <Row className="mt-4">
        <Col lg={8} className="mb-4">
          <Card style={styles.tableCard}>
            <Card.Body>
              <h4 style={styles.chartTitle}>Detailed Forecast</h4>
              <Table hover responsive style={styles.table}>
                <thead style={styles.tableHead}>
                  <tr>
                    <th style={styles.tableHeader}>Month</th>
                    <th style={styles.tableHeader}>Predicted Sales</th>
                    <th style={styles.tableHeader}>Actual Sales</th>
                    <th style={styles.tableHeader}>Confidence</th>
                    <th style={styles.tableHeader}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {hasData && displayData.monthlyForecast && displayData.monthlyForecast.length > 0 ? (
                    displayData.monthlyForecast.map((item, index) => {
                      const variance = item.actual ? ((item.predicted - item.actual) / item.actual * 100) : null;
                      return (
                        <tr key={index} style={styles.tableRow}>
                          <td style={styles.tableCell}>{item.month}</td>
                          <td style={styles.tableCell}>
                            <span style={styles.predictedValue}>{formatCurrency(item.predicted)}</span>
                          </td>
                          <td style={styles.tableCell}>
                            {item.actual ? formatCurrency(item.actual) : 
                              <span style={styles.pendingValue}>Pending</span>
                            }
                          </td>
                          <td style={styles.tableCell}>
                            <Badge 
                              bg={item.confidence > 85 ? 'success' : item.confidence > 75 ? 'warning' : 'danger'}
                              style={styles.confidenceBadge}
                            >
                              {item.confidence}%
                            </Badge>
                          </td>
                          <td style={styles.tableCell}>
                            {variance !== null ? (
                              <span style={{
                                color: Math.abs(variance) < 5 ? '#28a745' : Math.abs(variance) < 15 ? '#ffc107' : '#dc3545',
                                fontWeight: '600'
                              }}>
                                {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" style={{...styles.tableCell, textAlign: 'center', color: '#6c757d'}}>
                        No forecast data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        {/* Market Insights */}
        <Col lg={4} className="mb-4">
          <Card style={styles.insightsCard}>
            <Card.Body>
              <h4 style={styles.chartTitle}>Market Insights</h4>
              
              <div style={styles.insightSection}>
                <h6 style={styles.insightTitle}>Seasonality</h6>
                <p style={styles.insightText}>
                  {hasData ? displayData.trends.seasonality : 'No seasonality data available'}
                </p>
              </div>

              <div style={styles.insightSection}>
                <h6 style={styles.insightTitle}>Growth Factors</h6>
                <ul style={styles.insightList}>
                  {hasData && displayData.trends.marketFactors ? 
                    displayData.trends.marketFactors.map((factor, index) => (
                      <li key={index} style={styles.insightItem}>{factor}</li>
                    )) : 
                    <li style={styles.insightItem}>No growth factor data available</li>
                  }
                </ul>
              </div>

              <div style={styles.insightSection}>
                <h6 style={styles.insightTitle}>Risk Factors</h6>
                <ul style={styles.insightList}>
                  {hasData && displayData.trends.risks ? 
                    displayData.trends.risks.map((risk, index) => (
                      <li key={index} style={{...styles.insightItem, color: '#dc3545'}}>{risk}</li>
                    )) :
                    <li style={{...styles.insightItem, color: '#6c757d'}}>No risk factor data available</li>
                  }
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px'
  },

  // Header Styles
  headerCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
    color: 'white'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '20px'
  },
  headerText: {
    flex: 1
  },
  headerIcon: {
    fontSize: '3rem',
    color: 'white',
    marginRight: '20px'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: 'white'
  },
  subtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.8)',
    margin: '0'
  },
  headerControls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },

  // Metric Cards
  metricCard: {
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    height: '120px'
  },
  metricBody: {
    padding: '20px'
  },
  metricContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%'
  },
  metricValue: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#2c2c2c',
    margin: '0 0 5px 0'
  },
  metricLabel: {
    fontSize: '0.9rem',
    color: '#6c757d',
    margin: 0,
    fontWeight: '500'
  },
  metricIcon: {
    fontSize: '2.5rem',
    color: '#667eea',
    opacity: 0.7
  },
  confidenceBar: {
    height: '4px',
    backgroundColor: '#28a745',
    borderRadius: '2px',
    marginTop: '10px',
    transition: 'width 0.3s ease'
  },
  scenarioContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%'
  },
  scenarioItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scenarioLabel: {
    fontSize: '0.85rem',
    color: '#6c757d',
    fontWeight: '500'
  },
  scenarioValue: {
    fontSize: '1.1rem',
    fontWeight: '700'
  },

  // Chart Cards
  chartCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px'
  },
  chartTitle: {
    fontSize: '1.3rem',
    fontWeight: '600',
    color: '#2c2c2c',
    margin: 0
  },
  chartLegend: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  legendColor: {
    width: '12px',
    height: '12px',
    borderRadius: '2px'
  },
  legendText: {
    fontSize: '0.85rem',
    color: '#64748b',
    fontWeight: '500'
  },
  chartContainer: {
    width: '100%',
    minHeight: '350px'
  },
  chartPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '2px dashed #dee2e6',
    minHeight: '350px'
  },
  chartPlaceholderIcon: {
    fontSize: '4rem',
    color: '#6c757d',
    marginBottom: '20px'
  },
  chartPlaceholderText: {
    fontSize: '1.1rem',
    color: '#6c757d',
    margin: 0,
    fontWeight: '500',
    textAlign: 'center'
  },

  // Tooltip Styles
  tooltipContainer: {
    backgroundColor: '#ffffff',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0'
  },
  tooltipLabel: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#2c2c2c',
    margin: '0 0 8px 0'
  },
  tooltipValue: {
    fontSize: '0.85rem',
    fontWeight: '500',
    margin: '4px 0'
  },

  // No Data Message
  noDataMessage: {
    textAlign: 'center',
    color: '#6c757d',
    fontSize: '0.95rem',
    fontStyle: 'italic',
    padding: '20px'
  },

  // Products List
  productsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '20px'
  },
  productItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px'
  },
  productInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  productName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#2c2c2c'
  },
  productSales: {
    fontSize: '0.85rem',
    color: '#6c757d'
  },
  productGrowth: {
    fontSize: '0.8rem',
    padding: '4px 8px'
  },

  // Table Styles
  tableCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  table: {
    marginBottom: 0,
    fontSize: '0.9rem'
  },
  tableHead: {
    backgroundColor: '#f8f9fa'
  },
  tableHeader: {
    padding: '16px',
    fontWeight: '600',
    color: '#495057',
    borderBottom: '2px solid #dee2e6',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tableRow: {
    transition: 'background-color 0.2s ease'
  },
  tableCell: {
    padding: '16px',
    verticalAlign: 'middle',
    borderBottom: '1px solid #e9ecef'
  },
  predictedValue: {
    fontWeight: '600',
    color: '#16a34a'
  },
  pendingValue: {
    color: '#6c757d',
    fontStyle: 'italic'
  },
  confidenceBadge: {
    fontSize: '0.8rem',
    padding: '4px 8px'
  },

  // Insights Card
  insightsCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    height: 'fit-content'
  },
  insightSection: {
    marginBottom: '20px'
  },
  insightTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#2c2c2c',
    marginBottom: '8px'
  },
  insightText: {
    fontSize: '0.9rem',
    color: '#6c757d',
    lineHeight: '1.5',
    margin: 0
  },
  insightList: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  },
  insightItem: {
    fontSize: '0.85rem',
    color: '#6c757d',
    padding: '4px 0',
    position: 'relative',
    paddingLeft: '16px',
    '&::before': {
      content: '•',
      color: '#667eea',
      position: 'absolute',
      left: 0
    }
  }
};

export default SalesForcastingScreen;