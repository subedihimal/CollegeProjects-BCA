import asyncHandler from '../middleware/asyncHandler.js';
import generateToken from '../utils/generateToken.js';
import User from '../models/userModel.js';
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_MESSAGE,
  DEMO_ADMIN_NAME,
  DEMO_ADMIN_PASSWORD,
  isDemoAdminEmail,
} from '../config/demoAdmin.js';

const findUserByEmail = (email) =>
  isDemoAdminEmail(email)
    ? User.findOne({ email: { $regex: /^mockAdmin@gmail\.com$/i } })
    : User.findOne({ email });

const ensureDemoAdmin = async (email, password) => {
  if (!isDemoAdminEmail(email) || password !== DEMO_ADMIN_PASSWORD) {
    return findUserByEmail(email);
  }

  let user = await findUserByEmail(DEMO_ADMIN_EMAIL);

  if (!user) {
    return User.create({
      name: DEMO_ADMIN_NAME,
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      isAdmin: true,
    });
  }

  let shouldSave = false;
  if (user.name !== DEMO_ADMIN_NAME) {
    user.name = DEMO_ADMIN_NAME;
    shouldSave = true;
  }
  if (!user.isAdmin) {
    user.isAdmin = true;
    shouldSave = true;
  }
  if (!(await user.matchPassword(DEMO_ADMIN_PASSWORD))) {
    user.password = DEMO_ADMIN_PASSWORD;
    shouldSave = true;
  }

  if (shouldSave) {
    await user.save();
  }

  return user;
};

const userResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  isAdmin: user.isAdmin,
  isDemoAdmin: isDemoAdminEmail(user.email),
});

// @desc    Auth user & get token
// @route   POST /api/users/auth
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await ensureDemoAdmin(email, password);

  if (user && (await user.matchPassword(password))) {
    generateToken(res, user._id);

    res.json(userResponse(user));
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  res.status(403);
  throw new Error(DEMO_ADMIN_MESSAGE);
});

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
const logoutUser = (req, res) => {
  res.clearCookie('jwt');
  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json(userResponse(user));
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json(userResponse(updatedUser));
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password');
  res.json(users);
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user.isAdmin) {
      res.status(400);
      throw new Error('Can not delete admin user');
    }
    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User removed' });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});
// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.isAdmin = Boolean(req.body.isAdmin);

    const updatedUser = await user.save();

    res.json(userResponse(updatedUser));
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

export {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
  getUserById,
  updateUser,
};
