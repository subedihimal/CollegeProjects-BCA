// export const BASE_URL =
//   process.env.NODE_ENV === 'develeopment' ? 'http://localhost:5000' : '';
export const BASE_URL = ''; // If using proxy
export const PRODUCTS_URL = '/api/products';
export const RECOMMEND_URL = '/api/recommend';
export const USERS_URL = '/api/users';
export const ORDERS_URL = '/api/orders';
export const PAYPAL_URL = '/api/config/paypal';

export const DEMO_ADMIN = {
  email: 'mockAdmin@gmail.com',
  password: 'admin',
};

export const DEMO_ADMIN_MESSAGE =
  'This is a demo admin. If you want full administrative privileges, contact the owner, Himal.';

export const isDemoAdmin = (user) =>
  Boolean(
    user &&
      (user.isDemoAdmin ||
        user.email?.toLowerCase() === DEMO_ADMIN.email.toLowerCase())
  );
