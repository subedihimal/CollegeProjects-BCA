import { RECOMMEND_URL } from '../constants'
import { apiSlice } from './apiSlice';

export const productsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    //Recommended Products
    getProductRecommendation: builder.query({
      query: ({ pageNumber, cartItems, userId, viewedProducts }) => ({
        url: RECOMMEND_URL,
        method: 'POST',
        body: { pageNumber, cartItems, userId, viewedProducts }, // Add viewedProducts here
      }),
      keepUnusedDataFor: 5,
      providesTags: ['Products'],
    }),
  }),
});

export const {
  useGetProductRecommendationQuery,
} = productsApiSlice;