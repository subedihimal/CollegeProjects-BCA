import { createSlice } from '@reduxjs/toolkit';

// Function to get initial state from localStorage
const getInitialState = () => {
  const stored = localStorage.getItem('productViews');
  return stored ? JSON.parse(stored) : { viewedProducts: {} };
};

const initialState = getInitialState();

const productViewsSlice = createSlice({
  name: 'productViews',
  initialState,
  reducers: {
    trackProductView: (state, action) => {
      const { productId, productData } = action.payload;
      
      if (state.viewedProducts[productId]) {
        state.viewedProducts[productId].viewCount += 1;
        state.viewedProducts[productId].lastViewed = new Date().toISOString();
      } else {
        state.viewedProducts[productId] = {
          ...productData,
          viewCount: 1,
          firstViewed: new Date().toISOString(),
          lastViewed: new Date().toISOString()
        };
      }
      
      localStorage.setItem('productViews', JSON.stringify(state));
    },
    
    clearProductViews: (state) => {
      state.viewedProducts = {};
      localStorage.removeItem('productViews');
    },
    
    resetProductViewsOnLogout: (state) => {
      state.viewedProducts = {};
      localStorage.removeItem('productViews');
    },
    
    // Add this new action to reinitialize from localStorage
    reinitializeProductViews: (state) => {
      const stored = localStorage.getItem('productViews');
      if (stored) {
        return JSON.parse(stored);
      } else {
        return { viewedProducts: {} };
      }
    }
  },
  extraReducers: (builder) => {
    // Listen for logout action from authSlice
    builder.addCase('auth/logout', (state) => {
      state.viewedProducts = {};
      localStorage.removeItem('productViews');
    });
    // Listen for login action from authSlice
    builder.addCase('auth/setCredentials', (state) => {
      // Reinitialize from localStorage when user logs in
      const stored = localStorage.getItem('productViews');
      if (stored) {
        const parsedState = JSON.parse(stored);
        state.viewedProducts = parsedState.viewedProducts || {};
      } else {
        state.viewedProducts = {};
      }
    });
  }
});

export const { 
  trackProductView, 
  clearProductViews, 
  resetProductViewsOnLogout, 
  reinitializeProductViews 
} = productViewsSlice.actions;

// Selectors
export const selectViewedProducts = (state) => state.productViews.viewedProducts;
export const selectProductViewCount = (productId) => (state) => 
  state.productViews.viewedProducts[productId]?.viewCount || 0;
export const selectMostViewedProducts = (state) => {
  const viewed = state.productViews.viewedProducts;
  return Object.values(viewed)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);
};

export default productViewsSlice.reducer;