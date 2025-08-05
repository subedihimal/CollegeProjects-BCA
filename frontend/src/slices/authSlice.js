import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userInfo: localStorage.getItem('userInfo')
    ? JSON.parse(localStorage.getItem('userInfo'))
    : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.userInfo = action.payload;
      localStorage.setItem('userInfo', JSON.stringify(action.payload));
    },
    logout: (state, action) => {
      state.userInfo = null;
      // Clear all localStorage items
      localStorage.removeItem('userInfo');
      localStorage.removeItem('cart');
      localStorage.removeItem('productViews'); // Add this line
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export const selectCurrentUserId = (state) => state.auth.userInfo?._id || null;

export default authSlice.reducer;