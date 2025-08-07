import React from 'react';
import { Table, Button, Card, Badge } from 'react-bootstrap';
import { FaTrash, FaEdit, FaCheck, FaTimes, FaUsers } from 'react-icons/fa';
import Message from '../../components/Message';
import Loader from '../../components/Loader';
import {
  useDeleteUserMutation,
  useGetUsersQuery,
} from '../../slices/usersApiSlice';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

const UserListScreen = () => {
  const { data: users, refetch, isLoading, error } = useGetUsersQuery();
  const [deleteUser] = useDeleteUserMutation();

  const deleteHandler = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser(id);
        refetch();
        toast.success('User deleted successfully');
      } catch (err) {
        toast.error(err?.data?.message || err.error);
      }
    }
  };

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
            <FaUsers style={styles.headerIcon} />
            <div>
              <h1 style={styles.title}>User Management</h1>
              <p style={styles.subtitle}>Manage user accounts and permissions</p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Users Table */}
      <Card style={styles.tableCard} className="mt-4">
        <Table hover responsive style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeader}>User ID</th>
              <th style={styles.tableHeader}>Name</th>
              <th style={styles.tableHeader}>Email</th>
              <th style={styles.tableHeader}>Role</th>
              <th style={styles.tableHeader}>Joined</th>
              <th style={styles.tableHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr 
                key={user._id}
                style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc'
                }}
              >
                <td style={styles.tableCell}>
                  <code style={styles.userId}>
                    {user._id.substring(0, 8)}...{user._id.substring(user._id.length - 4)}
                  </code>
                </td>
                <td style={styles.tableCell}>
                  <div style={styles.userName}>
                    {user.name}
                  </div>
                </td>
                <td style={styles.tableCell}>
                  <a href={`mailto:${user.email}`} style={styles.emailLink}>
                    {user.email}
                  </a>
                </td>
                <td style={styles.tableCell}>
                  {user.isAdmin ? (
                    <Badge bg="primary" style={styles.adminBadge}>
                      <FaCheck style={styles.badgeIcon} />
                      Admin
                    </Badge>
                  ) : (
                    <Badge bg="secondary" style={styles.userBadge}>
                      <FaTimes style={styles.badgeIcon} />
                      User
                    </Badge>
                  )}
                </td>
                <td style={styles.tableCell}>
                  <span style={styles.dateText}>
                    {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <div style={styles.actionButtons}>
                    {!user.isAdmin ? (
                      <>
                        <Button
                          as={Link}
                          to={`/admin/user/${user._id}/edit`}
                          size="sm"
                          style={styles.editButton}
                        >
                          <FaEdit style={styles.buttonIcon} />
                        </Button>
                        <Button
                          size="sm"
                          style={styles.deleteButton}
                          onClick={() => deleteHandler(user._id)}
                        >
                          <FaTrash style={styles.buttonIcon} />
                        </Button>
                      </>
                    ) : (
                      <span style={styles.adminText}>Protected</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        {users.length === 0 && (
          <div style={styles.emptyState}>
            <FaUsers style={styles.emptyIcon} />
            <h4 style={styles.emptyTitle}>No users found</h4>
            <p style={styles.emptyText}>There are no users in the system yet.</p>
          </div>
        )}
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
  userId: {
    backgroundColor: '#e9ecef',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    color: '#495057',
    fontFamily: 'monospace'
  },
  userName: {
    fontWeight: '600',
    color: '#212529',
    fontSize: '1rem'
  },
  emailLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontSize: '0.95rem'
  },
  dateText: {
    color: '#6c757d',
    fontSize: '0.9rem'
  },

  // Badge Styles
  adminBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  badgeIcon: {
    fontSize: '0.7rem'
  },

  // Action Styles
  actionButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  editButton: {
    background: 'linear-gradient(45deg, #17a2b8, #138496)',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center'
  },
  deleteButton: {
    background: 'linear-gradient(45deg, #dc3545, #c82333)',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center'
  },
  buttonIcon: {
    fontSize: '0.8rem',
    color: 'white'
  },
  adminText: {
    color: '#6c757d',
    fontSize: '0.9rem',
    fontStyle: 'italic'
  },

  // Empty State
  emptyState: {
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
    margin: '0'
  }
};

export default UserListScreen;