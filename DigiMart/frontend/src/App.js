import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container } from 'react-bootstrap';
import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { logout, setCredentials } from './slices/authSlice';
import { useLoginMutation } from './slices/usersApiSlice';
import { DEMO_ADMIN } from './constants';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App = () => {
  const dispatch = useDispatch();
  const { userInfo } = useSelector((state) => state.auth);
  const [login] = useLoginMutation();
  const attemptedAutomaticLogin = useRef(false);

  useEffect(() => {
    const expirationTime = localStorage.getItem('expirationTime');
    if (expirationTime) {
      const currentTime = new Date().getTime();

      if (currentTime > expirationTime) {
        dispatch(logout());
      }
    }
  }, [dispatch]);

  useEffect(() => {
    if (attemptedAutomaticLogin.current) return;
    attemptedAutomaticLogin.current = true;

    // Preserve an existing owner/admin session. Automatic demo login is only
    // for visitors who do not already have an authenticated identity.
    if (userInfo) return;

    const loginAsDemoAdmin = async () => {
      try {
        const response = await login(DEMO_ADMIN).unwrap();
        dispatch(setCredentials(response));
      } catch (error) {
        // Keep the public storefront usable if the database is temporarily
        // unavailable. The sign-in screen remains prefilled for a manual retry.
        console.error('Automatic demo login failed:', error);
      }
    };

    loginAsDemoAdmin();
  }, [dispatch, login, userInfo]);

  return (
    <>
      <ToastContainer />
      <Header />
      <main className='py-3'>
        <Container>
          <Outlet />
        </Container>
      </main>
      <Footer />
    </>
  );
};

export default App;
