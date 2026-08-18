import jwt from 'jsonwebtoken';
import asyncHandler from './asyncHandler.js';
import User from '../models/userModel.js';
import { DEMO_ADMIN_MESSAGE, isDemoAdminEmail } from '../config/demoAdmin.js';

// User must be authenticated
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Read JWT from the 'jwt' cookie
  token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

// User must be an admin
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
};

// Demo administrators can inspect admin screens, forecasts, and orders, but
// cannot mutate products, users, or their own account.
const blockDemoAdmin = (req, res, next) => {
  if (req.user && isDemoAdminEmail(req.user.email)) {
    res.status(403);
    throw new Error(DEMO_ADMIN_MESSAGE);
  }

  next();
};

export { protect, admin, blockDemoAdmin };
