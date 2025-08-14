import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, Dropdown, Button } from 'react-bootstrap';
import { FaChartLine, FaCalendarAlt, FaArrowUp, FaArrowDown, FaDownload } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Message from '../../components/Message';
import Loader from '../../components/Loader';

const SalesForcastingScreen = () => {
  const [forecastData, setForecastData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('3months');

  // Mock data - replace with your API call
  useEffect(() => {
    const fetchForecastData = async () => {
      try {
        setIsLoading(true);
        // Replace this with your actual API call
        // const response = await fetch(`/api/sales/forecast?period=${selectedPeriod}`);
        // const data = await response.json();
        
        // Mock data for demonstration
        const mockData = {
          summary: {
            predictedRevenue: 245000,
            growthRate: 12.5,
            confidence: 85,
            bestCase: 280000,
            worstCase: 210000
          },
          monthlyForecast: [
            { month: 'Jan 2025', predicted: 45000, actual: 42000, confidence: 90 },
            { month: 'Feb 2025', predicted: 48000, actual: null, confidence: 88 },
            { month: 'Mar 2025', predicted: 52000, actual: null, confidence: 85 },
            { month: 'Apr 2025', predicted: 55000, actual: null, confidence: 82 },
            { month: 'May 2025', predicted: 58000, actual: null, confidence: 80 },
            { month: 'Jun 2025', predicted: 61000, actual: null, confidence: 78 }
          ],
          topProducts: [
            { name: 'Product A', predictedSales: 15000, growth: 8.2 },
            { name: 'Product B', predictedSales: 12000, growth: -2.1 },
            { name: 'Product C', predictedSales: 10000, growth: 15.3 },
            { name: 'Product D', predictedSales: 8500, growth: 5.7 },
            { name: 'Product E', predictedSales: 7200, growth: -1.8 }
          ],
          trends: {
            seasonality: 'High demand expected in Q2',
            marketFactors: ['Economic recovery', 'New product launches', 'Marketing campaigns'],
            risks: ['Supply chain delays', 'Competition increase', 'Economic uncertainty']
          }
        };
        
        setForecastData(mockData);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForecastData();
  }, [selectedPeriod]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) return <Loader />;
  if (error) return <Message variant='danger'>{error}</Message>;
  if (!forecastData) return <Message variant='info'>No forecast data available</Message>;

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
              <Button variant="outline-light" size="sm">
                <FaDownload style={{ marginRight: '8px' }} />
                Export
              </Button>
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
                  <h3 style={styles.metricValue}>{formatCurrency(forecastData.summary.predictedRevenue)}</h3>
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
                  <h3 style={{...styles.metricValue, color: forecastData.summary.growthRate > 0 ? '#28a745' : '#dc3545'}}>
                    {forecastData.summary.growthRate > 0 ? '+' : ''}{forecastData.summary.growthRate}%
                  </h3>
                  <p style={styles.metricLabel}>Growth Rate</p>
                </div>
                {forecastData.summary.growthRate > 0 ? 
                  <FaArrowUp style={{...styles.metricIcon, color: '#28a745'}} /> :
                  <FaArrowDown style={{...styles.metricIcon, color: '#dc3545'}} />
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
                  <h3 style={styles.metricValue}>{forecastData.summary.confidence}%</h3>
                  <p style={styles.metricLabel}>Confidence Level</p>
                </div>
                <div style={{...styles.confidenceBar, width: `${forecastData.summary.confidence}%`}}></div>
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
                  <span style={{...styles.scenarioValue, color: '#28a745'}}>
                    {formatCurrency(forecastData.summary.bestCase)}
                  </span>
                </div>
                <div style={styles.scenarioItem}>
                  <span style={styles.scenarioLabel}>Worst Case</span>
                  <span style={{...styles.scenarioValue, color: '#dc3545'}}>
                    {formatCurrency(forecastData.summary.worstCase)}
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
                <Badge bg="info" style={styles.chartBadge}>Predicted vs Actual</Badge>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={forecastData.monthlyForecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6c757d"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#6c757d"
                    fontSize={12}
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip 
                    formatter={(value) => [`₹${value.toLocaleString()}`, '']}
                    labelStyle={{ color: '#495057' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #dee2e6',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="#007bff" 
                    strokeWidth={3}
                    name="Predicted"
                    dot={{ fill: '#007bff', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#28a745" 
                    strokeWidth={2}
                    name="Actual"
                    dot={{ fill: '#28a745', strokeWidth: 2, r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Top Products Forecast */}
        <Col lg={4} className="mb-4">
          <Card style={styles.chartCard}>
            <Card.Body>
              <h4 style={styles.chartTitle}>Top Products Forecast</h4>
              <div style={styles.productsList}>
                {forecastData.topProducts.map((product, index) => (
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
                ))}
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
                  {forecastData.monthlyForecast.map((item, index) => {
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
                  })}
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
                <p style={styles.insightText}>{forecastData.trends.seasonality}</p>
              </div>

              <div style={styles.insightSection}>
                <h6 style={styles.insightTitle}>Growth Factors</h6>
                <ul style={styles.insightList}>
                  {forecastData.trends.marketFactors.map((factor, index) => (
                    <li key={index} style={styles.insightItem}>{factor}</li>
                  ))}
                </ul>
              </div>

              <div style={styles.insightSection}>
                <h6 style={styles.insightTitle}>Risk Factors</h6>
                <ul style={styles.insightList}>
                  {forecastData.trends.risks.map((risk, index) => (
                    <li key={index} style={{...styles.insightItem, color: '#dc3545'}}>{risk}</li>
                  ))}
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
    marginBottom: '20px'
  },
  chartTitle: {
    fontSize: '1.3rem',
    fontWeight: '600',
    color: '#2c2c2c',
    margin: 0
  },
  chartBadge: {
    padding: '6px 12px',
    fontSize: '0.8rem'
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
    color: '#007bff'
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
    paddingLeft: '16px'
  }
};

// Add bullet points to list items
styles.insightItem['&::before'] = {
  content: '•',
  color: '#667eea',
  position: 'absolute',
  left: 0
};

export default SalesForcastingScreen;