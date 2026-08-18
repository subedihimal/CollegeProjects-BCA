export const DEMO_ADMIN_EMAIL = 'mockAdmin@gmail.com';
export const DEMO_ADMIN_PASSWORD = 'admin';
export const DEMO_ADMIN_NAME = 'Demo Admin';

export const DEMO_ADMIN_MESSAGE =
  'This is a demo admin. If you want full administrative privileges, contact the owner, Himal.';

export const isDemoAdminEmail = (email = '') =>
  email.trim().toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase();

