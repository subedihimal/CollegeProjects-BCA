import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Row, Col, Image, Card, Button, Badge } from 'react-bootstrap';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaShippingFast, FaCreditCard, FaShoppingCart, FaCheck, FaTimes, FaArrowLeft } from 'react-icons/fa';
import Message from '../components/Message';
import Loader from '../components/Loader';
import {
  useDeliverOrderMutation,
  useGetOrderDetailsQuery,
  useGetPaypalClientIdQuery,
  usePayOrderMutation,
} from '../slices/ordersApiSlice';

const OrderScreen = () => {
  const { id: orderId } = useParams();

  const { data: order, refetch, isLoading, error } = useGetOrderDetailsQuery(orderId);
  const [payOrder, { isLoading: loadingPay }] = usePayOrderMutation();
  const [deliverOrder, { isLoading: loadingDeliver }] = useDeliverOrderMutation();
  const { userInfo } = useSelector((state) => state.auth);
  const [{ isPending }, paypalDispatch] = usePayPalScriptReducer();
  const { data: paypal, isLoading: loadingPayPal, error: errorPayPal } = useGetPaypalClientIdQuery();

  useEffect(() => {
    if (!errorPayPal && !loadingPayPal && paypal.clientId) {
      const loadPaypalScript = async () => {
        paypalDispatch({
          type: 'resetOptions',
          value: {
            'client-id': paypal.clientId,
            currency: 'USD',
          },
        });
        paypalDispatch({ type: 'setLoadingStatus', value: 'pending' });
      };
      if (order && !order.isPaid) {
        if (!window.paypal) {
          loadPaypalScript();
        }
      }
    }
  }, [errorPayPal, loadingPayPal, order, paypal, paypalDispatch]);

  function onApprove(data, actions) {
    return actions.order.capture().then(async function (details) {
      try {
        await payOrder({ orderId, details });
        refetch();
        toast.success('Order is paid');
      } catch (err) {
        toast.error(err?.data?.message || err.error);
      }
    });
  }

  function onError(err) {
    toast.error(err.message);
  }

  function createOrder(data, actions) {
    return actions.order
      .create({
        purchase_units: [
          {
            amount: { value: order.totalPrice },
          },
        ],
      })
      .then((orderID) => {
        return orderID;
      });
  }

  const deliverHandler = async () => {
    await deliverOrder(orderId);
    refetch();
    toast.success('Order marked as delivered');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) return <Loader />;
  if (error) return <Message variant='danger'>{error?.data?.message || error.error}</Message>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Body>
          <Link to='/admin/orderlist' style={styles.backButton}>
            <FaArrowLeft style={styles.backIcon} />
            Back to Orders
          </Link>
          <h1 style={styles.title}>Order Details</h1>
          <div style={styles.orderInfo}>
            <span style={styles.orderId}>#{order._id}</span>
            <span style={styles.orderDate}>Placed on {formatDate(order.createdAt)}</span>
          </div>
        </Card.Body>
      </Card>

      <Row className="mt-4">
        <Col lg={8}>
          {/* Shipping Information */}
          <Card style={styles.card} className="mb-4">
            <Card.Body>
              
              
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Customer:</span>
                  <span style={styles.infoValue}>{order.user.name}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Email:</span>
                  <a href={`mailto:${order.user.email}`} style={styles.emailLink}>
                    {order.user.email}
                  </a>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Address:</span>
                  <span style={styles.infoValue}>
                    {order.shippingAddress.address}, {order.shippingAddress.city} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
                  </span>
                </div>
                {order.isDelivered && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Delivered:</span>
                    <span style={styles.deliveredDate}>{formatDate(order.deliveredAt)}</span>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Payment Information */}
          <Card style={styles.card} className="mb-4">
            <Card.Body>              
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Method:</span>
                  <span style={styles.infoValue}>{order.paymentMethod}</span>
                </div>
                {order.isPaid && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Paid:</span>
                    <span style={styles.paidDate}>{formatDate(order.paidAt)}</span>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Order Items */}
          <Card style={styles.card}>
            <Card.Body>
              <div style={styles.sectionHeader}>
                <FaShoppingCart style={styles.sectionIcon} />
                <h3 style={styles.sectionTitle}>Order Items</h3>
              </div>
              
              {order.orderItems.length === 0 ? (
                <div style={styles.emptyOrder}>
                  <p>Order is empty</p>
                </div>
              ) : (
                <div style={styles.orderItems}>
                  {order.orderItems.map((item, index) => (
                    <div key={index} style={styles.orderItem}>
                      <div style={styles.itemImage}>
                        <Image src={item.image} alt={item.name} style={styles.productImage} />
                      </div>
                      <div style={styles.itemDetails}>
                        <Link to={`/product/${item.product}`} style={styles.productLink}>
                          {item.name}
                        </Link>
                      </div>
                      <div style={styles.itemCalculation}>
                        <span style={styles.calculation}>
                          {item.qty} ×  ₹ {item.price} = <strong> ₹ {(item.qty * item.price).toFixed(2)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {/* Order Summary */}
          <Card style={styles.summaryCard}>
            <Card.Body>
              <h3 style={styles.summaryTitle}>Order Summary</h3>
              
              <div style={styles.summaryItems}>
                <div style={styles.summaryItem}>
                  <span>Items:</span>
                  <span> ₹ {order.itemsPrice}</span>
                </div>
                <div style={styles.summaryItem}>
                  <span>Shipping:</span>
                  <span> ₹ {order.shippingPrice}</span>
                </div>
                <div style={styles.summaryItem}>
                  <span>Tax:</span>
                  <span> ₹ {order.taxPrice}</span>
                </div>
                <div style={styles.summaryTotal}>
                  <span>Total:</span>
                  <span> ₹ {order.totalPrice}</span>
                </div>
              </div>

              {/* PayPal Payment */}
              {!order.isPaid && (
                <div style={styles.paymentSection}>
                  {loadingPay && <Loader />}
                  {isPending ? (
                    <Loader />
                  ) : (
                    <div style={styles.paypalContainer}>
                      <PayPalButtons
                        createOrder={createOrder}
                        onApprove={onApprove}
                        onError={onError}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Admin Delivery Button */}
              {userInfo && userInfo.isAdmin && order.isPaid && !order.isDelivered && (
                <div style={styles.adminSection}>
                  {loadingDeliver && <Loader />}
                  <Button
                    onClick={deliverHandler}
                    disabled={loadingDeliver}
                    style={styles.deliverButton}
                  >
                    <FaShippingFast style={styles.buttonIcon} />
                    Mark as Delivered
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
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
  backButton: {
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    marginBottom: '15px',
    display: 'inline-flex',
    alignItems: 'center'
  },
  backIcon: {
    marginRight: '8px'
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '700',
    margin: '0 0 15px 0',
    color: 'white'
  },
  orderInfo: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  orderId: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  orderDate: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.7)'
  },

  // Card Styles
  card: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  summaryCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    position: 'sticky',
    top: '20px'
  },

  // Section Styles
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #f8f9fa'
  },
  sectionIcon: {
    fontSize: '1.5rem',
    color: '#495057'
  },
  sectionTitle: {
    fontSize: '1.4rem',
    fontWeight: '600',
    color: '#2c3e50',
    margin: '0',
    flex: '1'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  badgeIcon: {
    fontSize: '0.75rem'
  },

  // Info Grid Styles
  infoGrid: {
    display: 'grid',
    gap: '12px'
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '8px 0'
  },
  infoLabel: {
    fontWeight: '600',
    color: '#495057',
    minWidth: '80px'
  },
  infoValue: {
    color: '#212529',
    textAlign: 'right',
    flex: '1'
  },
  emailLink: {
    color: '#007bff',
    textDecoration: 'none'
  },
  deliveredDate: {
    color: '#28a745',
    fontWeight: '600',
    textAlign: 'right',
    flex: '1'
  },
  paidDate: {
    color: '#28a745',
    fontWeight: '600',
    textAlign: 'right',
    flex: '1'
  },

  // Order Items Styles
  orderItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  orderItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
  },
  itemImage: {
    width: '60px',
    height: '60px',
    flexShrink: 0
  },
  productImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px'
  },
  itemDetails: {
    flex: '1'
  },
  productLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '1rem'
  },
  itemCalculation: {
    textAlign: 'right'
  },
  calculation: {
    color: '#495057',
    fontSize: '0.95rem'
  },
  emptyOrder: {
    textAlign: 'center',
    padding: '40px',
    color: '#6c757d'
  },

  // Summary Styles
  summaryTitle: {
    fontSize: '1.4rem',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '20px',
    textAlign: 'center'
  },
  summaryItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '1rem',
    color: '#495057'
  },
  summaryTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#2c3e50',
    borderTop: '2px solid #e9ecef',
    marginTop: '8px'
  },

  // Payment Styles
  paymentSection: {
    marginTop: '20px',
    padding: '20px 0'
  },
  paypalContainer: {
    padding: '10px 0'
  },

  // Admin Styles
  adminSection: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '2px solid #e9ecef'
  },
  deliverButton: {
    background: 'linear-gradient(45deg, #28a745, #20c997)',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: '600',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  buttonIcon: {
    fontSize: '0.9rem'
  }
};

export default OrderScreen;