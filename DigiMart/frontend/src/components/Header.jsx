import { Navbar, Nav, Container, NavDropdown, Badge } from 'react-bootstrap';
import { FaShoppingCart, FaUser, FaStore } from 'react-icons/fa';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useLogoutMutation } from '../slices/usersApiSlice';
import { logout } from '../slices/authSlice';
import SearchBox from './SearchBox';
import { resetCart } from '../slices/cartSlice';

const Header = () => {
  const { cartItems } = useSelector((state) => state.cart);
  const { userInfo } = useSelector((state) => state.auth);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [logoutApiCall] = useLogoutMutation();

  const logoutHandler = async () => {
    try {
      await logoutApiCall().unwrap();
      dispatch(logout());
      dispatch(resetCart());
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header>
      <Navbar 
        bg='dark' 
        variant='dark' 
        expand='lg' 
        collapseOnSelect
        className="shadow-sm"
        style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important',
          borderBottom: '3px solid #f8f9fa'
        }}
      >
        <Container>
          <Navbar.Brand 
            as={Link} 
            to='/' 
            className="fw-bold d-flex align-items-center"
            style={{ 
              fontSize: '1.5rem',
              textDecoration: 'none',
              color: '#ffffff !important',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            <div 
              className="me-2 d-flex align-items-center justify-content-center"
              style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(45deg, #ff6b6b, #ff8e53)',
                borderRadius: '50%',
                boxShadow: '0 4px 15px rgba(255, 107, 107, 0.3)'
              }}
            >
              <FaStore style={{ color: 'white', fontSize: '1.2rem' }} />
            </div>
            <span className="ms-1">DigiMart</span>
          </Navbar.Brand>
          
          <Navbar.Toggle 
            aria-controls='basic-navbar-nav'
            style={{
              borderColor: 'rgba(255,255,255,0.3)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}
          />
          
          <Navbar.Collapse id='basic-navbar-nav'>
            <Nav className='ms-auto align-items-center'>
              <div className="me-3">
                <SearchBox />
              </div>
              
              <Nav.Link 
                as={Link} 
                to='/cart'
                className="position-relative me-3"
                style={{ 
                  color: '#ffffff !important',
                  textDecoration: 'none',
                  fontSize: '1rem',
                  fontWeight: '500',
                  padding: '8px 16px',
                  borderRadius: '25px',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <FaShoppingCart className="me-2" /> 
                Cart
                {cartItems.length > 0 && (
                  <Badge 
                    pill 
                    bg='danger' 
                    className="position-absolute"
                    style={{ 
                      top: '-5px',
                      right: '-5px',
                      fontSize: '0.7rem',
                      minWidth: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4)'
                    }}
                  >
                    {cartItems.reduce((a, c) => a + c.qty, 0)}
                  </Badge>
                )}
              </Nav.Link>
              
              {userInfo ? (
                <NavDropdown title={userInfo.name} id='username' className="me-3">
                  <NavDropdown.Item as={Link} to='/profile'>
                    <FaUser className="me-2" />
                    Profile
                  </NavDropdown.Item>
                  <NavDropdown.Item onClick={logoutHandler}>
                    Logout
                  </NavDropdown.Item>
                </NavDropdown>
              ) : (
                <Nav.Link 
                  as={Link} 
                  to='/login'
                  style={{ 
                    color: '#ffffff !important',
                    textDecoration: 'none',
                    fontSize: '1rem',
                    fontWeight: '500',
                    padding: '8px 16px',
                    borderRadius: '25px',
                    transition: 'all 0.3s ease',
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <FaUser className="me-2" /> 
                  Sign In
                </Nav.Link>
              )}

              {/* Admin Links */}
              {userInfo && userInfo.isAdmin && (
                <NavDropdown title='Admin' id='adminmenu'>
                  <NavDropdown.Item as={Link} to='/admin/productlist'>
                    Products
                  </NavDropdown.Item>
                  <NavDropdown.Item as={Link} to='/admin/orderlist'>
                    Orders
                  </NavDropdown.Item>
                  <NavDropdown.Item as={Link} to='/admin/userlist'>
                    Users
                  </NavDropdown.Item>
                  <NavDropdown.Item as={Link} to='/admin/salesforcasting'>
                    Sales
                  </NavDropdown.Item>
                </NavDropdown>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </header>
  );
};

export default Header;