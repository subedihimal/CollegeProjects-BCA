import React, { useEffect, useState } from 'react';
import { Table, Form, Button, Row, Col, Card, Badge } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { FaUser, FaEnvelope, FaLock, FaShoppingBag, FaEye } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Message from '../components/Message';
import Loader from '../components/Loader';
import { useProfileMutation } from '../slices/usersApiSlice';
import { useGetMyOrdersQuery } from '../slices/ordersApiSlice';
import { setCredentials } from '../slices/authSlice';
import { Link } from 'react-router-dom';

const ProfileScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { userInfo } = useSelector((state) => state.auth);
  const { data: orders, isLoading, error } = useGetMyOrdersQuery();
  const [updateProfile, { isLoading: loadingUpdateProfile }] = useProfileMutation();
  const dispatch = useDispatch();

  useEffect(() => {
    setName(userInfo.name);
    setEmail(userInfo.email);
  }, [userInfo.email, userInfo.name]);

  const submitHandler = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (password && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      const res = await updateProfile({
        name: name.trim(),
        email: email.trim(),
        password,
      }).unwrap();
      dispatch(setCredentials({ ...res }));
      toast.success('Profile updated successfully');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getOrderStats = () => {
    if (!orders) return { total: 0, paid: 0, delivered: 0, totalSpent: 0 };
    
    return {
      total: orders.length,
      paid: orders.filter(order => order.isPaid).length,
      delivered: orders.filter(order => order.isDelivered).length,
      totalSpent: orders.reduce((sum, order) => sum + (order.isPaid ? parseFloat(order.totalPrice) : 0), 0)
    };
  };

  const stats = getOrderStats();

  return (
    <div style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Body>
          <div style={styles.headerContent}>
            <FaUser style={styles.headerIcon} />
            <div>
              <h1 style={styles.title}>My Profile</h1>
              <p style={styles.subtitle}>Manage your account and view order history</p>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Row className="mt-4">
        <Col lg={4}>
          {/* Profile Form */}
          <Card style={styles.profileCard}>
            <Card.Body style={styles.profileBody}>
              <h3 style={styles.profileTitle}>Account Information</h3>
              
              <Form onSubmit={submitHandler}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>
                    <FaUser style={styles.labelIcon} />
                    Full Name
                  </Form.Label>
                  <Form.Control
                    type='text'
                    placeholder='Enter your name'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.input}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>
                    <FaEnvelope style={styles.labelIcon} />
                    Email Address
                  </Form.Label>
                  <Form.Control
                    type='email'
                    placeholder='Enter your email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>
                    <FaLock style={styles.labelIcon} />
                    New Password
                  </Form.Label>
                  <Form.Control
                    type='password'
                    placeholder='Enter new password (optional)'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={styles.input}
                  />
                  <Form.Text style={styles.helpText}>
                    Leave blank to keep current password
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={styles.label}>
                    <FaLock style={styles.labelIcon} />
                    Confirm Password
                  </Form.Label>
                  <Form.Control
                    type='password'
                    placeholder='Confirm new password'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={styles.input}
                  />
                </Form.Group>

                <Button
                  type='submit'
                  disabled={loadingUpdateProfile}
                  style={styles.updateButton}
                >
                  {loadingUpdateProfile ? 'Updating...' : 'Update Profile'}
                </Button>
                {loadingUpdateProfile && <Loader />}
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          {/* Orders Table */}
          <Card style={styles.ordersCard}>
            <Card.Body>
              <div style={styles.ordersHeader}>
                <FaShoppingBag style={styles.ordersIcon} />
                <h3 style={styles.ordersTitle}>My Orders</h3>
              </div>

              {isLoading ? (
                <Loader />
              ) : error ? (
                <Message variant='danger'>
                  {error?.data?.message || error.error}
                </Message>
              ) : orders.length === 0 ? (
                <div style={styles.emptyOrders}>
                  <FaShoppingBag style={styles.emptyIcon} />
                  <h4 style={styles.emptyTitle}>No orders yet</h4>
                  <p style={styles.emptyText}>Start shopping to see your orders here!</p>
                  <Link to="/" style={styles.shopButton}>
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <Table hover responsive style={styles.table}>
                  <thead style={styles.tableHead}>
                    <tr>
                      <th style={styles.tableHeader}>Order ID</th>
                      <th style={styles.tableHeader}>Date</th>
                      <th style={styles.tableHeader}>Total</th>
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
                          <Button
                            as={Link}
                            to={`/order/${order._id}`}
                            size="sm"
                            style={styles.detailsButton}
                          >
                            <FaEye style={styles.buttonIcon} />
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
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
    maxWidth: '1400px',
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

  // Profile Card Styles
  profileCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    position: 'sticky',
    top: '20px'
  },
  profileBody: {
    padding: '25px'
  },
  profileTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '20px',
    fontSize: '1.3rem'
  },
  label: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '8px',
    fontSize: '0.95rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  labelIcon: {
    fontSize: '0.9rem',
    color: '#495057'
  },
  input: {
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '0.95rem',
    transition: 'border-color 0.2s ease'
  },
  helpText: {
    fontSize: '0.8rem',
    color: '#6c757d',
    marginTop: '4px'
  },
  updateButton: {
    background: 'linear-gradient(45deg, #28a745, #20c997)',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: '600',
    width: '100%'
  },

  // Stats Card Styles
  statsCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  statsTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '15px',
    textAlign: 'center'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px'
  },
  statItem: {
    textAlign: 'center',
    padding: '10px'
  },
  statNumber: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#28a745',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '0.8rem',
    color: '#6c757d'
  },

  // Orders Card Styles
  ordersCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  ordersHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #f8f9fa'
  },
  ordersIcon: {
    fontSize: '1.5rem',
    color: '#495057'
  },
  ordersTitle: {
    fontSize: '1.4rem',
    fontWeight: '600',
    color: '#2c3e50',
    margin: '0'
  },

  // Table Styles
  table: {
    marginBottom: 0
  },
  tableHead: {
    backgroundColor: '#f8f9fa'
  },
  tableHeader: {
    padding: '12px',
    fontWeight: '600',
    color: '#495057',
    borderBottom: '2px solid #dee2e6',
    fontSize: '0.85rem',
    textTransform: 'uppercase'
  },
  tableCell: {
    padding: '12px',
    verticalAlign: 'middle',
    borderBottom: '1px solid #e9ecef'
  },

  // Content Styles
  orderId: {
    backgroundColor: '#e9ecef',
    padding: '3px 6px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: '#495057',
    fontFamily: 'monospace'
  },
  dateText: {
    color: '#6c757d',
    fontSize: '0.85rem'
  },
  totalPrice: {
    fontWeight: '700',
    fontSize: '1rem',
    color: '#28a745'
  },

  // Status Styles
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '3px'
  },
  statusDate: {
    fontSize: '0.7rem',
    color: '#6c757d'
  },
  successBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    fontSize: '0.75rem'
  },
  dangerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    fontSize: '0.75rem'
  },
  warningBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    fontSize: '0.75rem',
    backgroundColor: '#ffc107',
    color: '#212529'
  },
  badgeIcon: {
    fontSize: '0.6rem'
  },

  // Button Styles
  detailsButton: {
    background: 'linear-gradient(45deg, #17a2b8, #138496)',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '600'
  },
  buttonIcon: {
    fontSize: '0.7rem'
  },

  // Empty State
  emptyOrders: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6c757d'
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '20px',
    color: '#dee2e6'
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#495057'
  },
  emptyText: {
    fontSize: '1rem',
    marginBottom: '20px'
  },
  shopButton: {
    background: 'linear-gradient(45deg, #007bff, #0056b3)',
    color: 'white',
    textDecoration: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    display: 'inline-block'
  }
};

export default ProfileScreen;