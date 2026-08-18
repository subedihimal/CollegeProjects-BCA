import express from 'express';
import {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
  getUserById,
  updateUser,
} from '../controllers/userController.js';
import { protect, admin, blockDemoAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(registerUser).get(protect, admin, getUsers);
router.post('/auth', authUser);
router.post('/logout', logoutUser);
router
  .route('/profile')
  .get(protect, getUserProfile)
  .put(protect, blockDemoAdmin, updateUserProfile);
router
  .route('/:id')
  .delete(protect, admin, blockDemoAdmin, deleteUser)
  .get(protect, admin, getUserById)
  .put(protect, admin, blockDemoAdmin, updateUser);

export default router;
