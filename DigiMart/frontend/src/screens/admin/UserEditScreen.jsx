import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Button, Card, Row, Col, Alert } from 'react-bootstrap';
import { FaUser, FaEnvelope, FaUserShield, FaSave, FaArrowLeft } from 'react-icons/fa';
import Message from '../../components/Message';
import Loader from '../../components/Loader';
import { toast } from 'react-toastify';
import { useParams } from 'react-router-dom';
import {
  useGetUserDetailsQuery,
  useUpdateUserMutation,
} from '../../slices/usersApiSlice';

const UserEditScreen = () => {
  const { id: userId } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const { data: user, isLoading, error, refetch } = useGetUserDetailsQuery(userId);
  const [updateUser, { isLoading: loadingUpdate }] = useUpdateUserMutation();

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setIsAdmin(user.isAdmin);
    }
  }, [user]);

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
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      await updateUser({ userId, name: name.trim(), email: email.trim(), isAdmin });
      toast.success('User updated successfully');
      refetch();
      navigate('/admin/userlist');
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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
          <Link to='/admin/userlist' style={styles.backButton}>
            <FaArrowLeft style={styles.backIcon} />
            Back to Users
          </Link>
          <h1 style={styles.title}>Edit User</h1>
          <p style={styles.subtitle}>Update user information and permissions</p>
        </Card.Body>
      </Card>

      {loadingUpdate && <Loader />}

      <Row className="mt-4">
        {/* User Form */}
        <Col lg={8}>
          <Card style={styles.formCard}>
            <Card.Body style={styles.formBody}>
              <Form onSubmit={submitHandler}>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-4">
                      <Form.Label style={styles.label}>
                        <FaUser style={styles.labelIcon} />
                        Full Name
                      </Form.Label>
                      <Form.Control
                        type='text'
                        placeholder='Enter full name'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={styles.input}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={12}>
                    <Form.Group className="mb-4">
                      <Form.Label style={styles.label}>
                        <FaEnvelope style={styles.labelIcon} />
                        Email Address
                      </Form.Label>
                      <Form.Control
                        type='email'
                        placeholder='Enter email address'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md={12}>
                    <Form.Group className="mb-4">
                      <div style={styles.checkboxContainer}>
                        <Form.Check
                          type='checkbox'
                          id='admin-checkbox'
                          checked={isAdmin}
                          onChange={(e) => setIsAdmin(e.target.checked)}
                          style={styles.checkbox}
                        />
                        <div style={styles.checkboxLabelContainer}>
                          <Form.Label htmlFor='admin-checkbox' style={styles.checkboxLabel}>
                            <FaUserShield style={styles.shieldIcon} />
                            Administrator Privileges
                          </Form.Label>
                          <p style={styles.checkboxDescription}>
                            Grant administrative access to manage products, orders, and users
                          </p>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <Alert variant="warning" style={styles.adminWarning}>
                          <strong>Warning:</strong> Admin users have full access to all system features including user management.
                        </Alert>
                      )}
                    </Form.Group>
                  </Col>

                  <Col md={12}>
                    <Button
                      type='submit'
                      disabled={loadingUpdate}
                      style={styles.submitButton}
                    >
                      <FaSave style={styles.buttonIcon} />
                      {loadingUpdate ? 'Updating...' : 'Update User'}
                    </Button>
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* User Information Sidebar */}
        <Col lg={4}>
          <Card style={styles.infoCard}>
            <Card.Body style={styles.infoBody}>
              <h5 style={styles.infoTitle}>User Information</h5>
              
              <div style={styles.infoSection}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>User ID:</span>
                  <code style={styles.infoValue}>
                    {user._id}
                  </code>
                </div>
                
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Account Created:</span>
                  <span style={styles.infoValue}>
                    {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                  </span>
                </div>
                
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Last Updated:</span>
                  <span style={styles.infoValue}>
                    {user.updatedAt ? formatDate(user.updatedAt) : 'N/A'}
                  </span>
                </div>
                
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Current Role:</span>
                  <span style={{
                    ...styles.roleValue,
                    color: user.isAdmin ? '#007bff' : '#6c757d'
                  }}>
                    {user.isAdmin ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
              </div>

              <div style={styles.noteSection}>
                <h6 style={styles.noteTitle}>Security Note</h6>
                <p style={styles.noteText}>
                  Changes to user permissions take effect immediately. 
                  Admin users can access all system features.
                </p>
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
    margin: '0 0 8px 0',
    color: 'white'
  },
  subtitle: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.7)',
    margin: '0'
  },

  // Form Styles
  formCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  formBody: {
    padding: '30px'
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

  // Checkbox Styles
  checkboxContainer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    border: '1px solid #e9ecef'
  },
  checkbox: {
    marginTop: '2px'
  },
  checkboxLabelContainer: {
    flex: '1'
  },
  checkboxLabel: {
    fontWeight: '600',
    color: '#2c3e50',
    margin: '0 0 4px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  shieldIcon: {
    fontSize: '0.9rem',
    color: '#007bff'
  },
  checkboxDescription: {
    fontSize: '0.85rem',
    color: '#6c757d',
    margin: '0'
  },
  adminWarning: {
    marginTop: '12px',
    fontSize: '0.85rem'
  },

  // Button Styles
  submitButton: {
    background: 'linear-gradient(45deg, #28a745, #20c997)',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 30px',
    fontSize: '1.1rem',
    fontWeight: '600',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  },
  buttonIcon: {
    fontSize: '1rem'
  },

  // Info Card Styles
  infoCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    height: 'fit-content',
    position: 'sticky',
    top: '20px'
  },
  infoBody: {
    padding: '25px'
  },
  infoTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '20px',
    fontSize: '1.2rem'
  },
  infoSection: {
    marginBottom: '25px'
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    padding: '8px 0'
  },
  infoLabel: {
    fontWeight: '600',
    color: '#495057',
    fontSize: '0.9rem'
  },
  infoValue: {
    color: '#6c757d',
    fontSize: '0.85rem',
    textAlign: 'right',
    fontFamily: 'monospace'
  },
  roleValue: {
    fontWeight: '600',
    fontSize: '0.9rem',
    textAlign: 'right'
  },

  // Note Section
  noteSection: {
    padding: '15px',
    backgroundColor: '#e7f3ff',
    borderRadius: '8px',
    border: '1px solid #b8daff'
  },
  noteTitle: {
    fontWeight: '600',
    color: '#004085',
    marginBottom: '8px',
    fontSize: '0.95rem'
  },
  noteText: {
    fontSize: '0.85rem',
    color: '#004085',
    margin: '0',
    lineHeight: '1.4'
  }
};

export default UserEditScreen;