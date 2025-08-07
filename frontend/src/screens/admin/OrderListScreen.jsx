import { Table, Button, Card, Badge } from 'react-bootstrap';
import { FaTimes, FaCheck, FaShoppingCart, FaEye } from 'react-icons/fa';
import Message from '../../components/Message';
import Loader from '../../components/Loader';
import { useGetOrdersQuery } from '../../slices/ordersApiSlice';
import { Link } from 'react-router-dom';

const OrderListScreen = () => {
  const { data: orders, isLoading, error } = useGetOrdersQuery();

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) return <Loader />;
  if (error) return <Message variant='danger'>{error?.data?.message || error.error}</Message>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Body>
          <div style={styles.headerContent}>
            <FaShoppingCart style={styles.headerIcon} />
            <div>
              <h1 style={styles.title}>Orders Management</h1>
              <p style={styles.subtitle}>View and manage customer orders</p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Orders Table */}
      <Card style={styles.tableCard} className="mt-4">
        <Table hover responsive style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeader}>Order ID</th>
              <th style={styles.tableHeader}>Customer</th>
              <th style={styles.tableHeader}>Date</th>
              <th style={styles.tableHeader}>Total</th>
              <th style={styles.tableHeader}>Payment Method</th>
              <th style={styles.tableHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr 
                key={order._id}
                style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc'
                }}
              >
                <td style={styles.tableCell}>
                  <code style={styles.orderId}>
                    {order._id}
                  </code>
                </td>
                <td style={styles.tableCell}>
                  <div style={styles.customerName}>
                    {order.user ? order.user.name : 'N/A'}
                  </div>
                </td>
                <td style={styles.tableCell}>
                  <span style={styles.dateText}>
                    {formatDate(order.createdAt)}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <span style={styles.totalPrice}>
                     ₹ {order.totalPrice}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  {order.paymentMethod ? (
                    <div style={styles.paymentMethod}>
                      <Badge bg="info" style={styles.infoBadge}>
                        {order.paymentMethod}
                      </Badge>
                    </div>
                  ) : (
                    <span style={styles.noPaymentMethod}>N/A</span>
                  )}
                </td>
                <td style={styles.tableCell}>
                  <Button
                    as={Link}
                    to={`/order/${order._id}`}
                    style={styles.detailsButton}
                    size="sm"
                  >
                    <FaEye style={styles.buttonIcon} />
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  },

  // Header Styles
  headerCard: {
    background: 'linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%)',
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    color: 'white'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  headerIcon: {
    fontSize: '2.5rem',
    color: 'white'
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: 'white'
  },
  subtitle: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.7)',
    margin: '0'
  },

  // Table Styles
  tableCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    overflow: 'hidden'
  },
  table: {
    marginBottom: 0,
    borderCollapse: 'separate',
    borderSpacing: 0
  },
  tableHead: {
    backgroundColor: '#f8f9fa'
  },
  tableHeader: {
    padding: '16px',
    fontWeight: '600',
    color: '#495057',
    borderBottom: '2px solid #dee2e6',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tableCell: {
    padding: '16px',
    verticalAlign: 'middle',
    borderBottom: '1px solid #e9ecef'
  },

  // Content Styles
  orderId: {
    backgroundColor: '#e9ecef',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: '#495057',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    maxWidth: '200px'
  },
  customerName: {
    fontWeight: '600',
    color: '#212529',
    fontSize: '0.95rem'
  },
  dateText: {
    color: '#6c757d',
    fontSize: '0.9rem'
  },
  totalPrice: {
    fontWeight: '700',
    fontSize: '1.1rem',
    color: '#28a745'
  },
  
  // Status Styles
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px'
  },
  statusDate: {
    fontSize: '0.75rem',
    color: '#6c757d'
  },
  successBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    fontSize: '0.8rem'
  },
  dangerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    fontSize: '0.8rem'
  },
  warningBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    fontSize: '0.8rem',
    backgroundColor: '#ffc107',
    color: '#212529'
  },
  infoBadge: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  badgeIcon: {
    fontSize: '0.7rem'
  },

  // Payment Method Styles
  paymentMethod: {
    display: 'flex',
    alignItems: 'center'
  },
  noPaymentMethod: {
    color: '#6c757d',
    fontStyle: 'italic',
    fontSize: '0.9rem'
  },

  // Button Styles
  detailsButton: {
    background: 'linear-gradient(45deg, #17a2b8, #138496)',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: '600'
  },
  buttonIcon: {
    fontSize: '0.8rem'
  }
};

export default OrderListScreen;