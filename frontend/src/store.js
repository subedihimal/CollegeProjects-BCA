import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { apiSlice } from './slices/apiSlice';
import cartSliceReducer from './slices/cartSlice';
import authReducer from './slices/authSlice';
import productViewsReducer from './slices/productViewsSlice';

// Combine all reducers
const appReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  cart: cartSliceReducer,
  auth: authReducer,
  productViews: productViewsReducer,
});

// Root reducer that resets state on logout
const rootReducer = (state, action) => {
  // When logout action is dispatched, reset entire Redux state
  if (action.type === 'auth/logout') {
    // Clear localStorage items
    localStorage.removeItem('userInfo');
    localStorage.removeItem('cart');
    localStorage.removeItem('productViews');
    
    // Reset state to undefined (will reinitialize with initial state)
    return appReducer(undefined, action);
  }
  
  return appReducer(state, action);
};

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: true,
});

export default store;