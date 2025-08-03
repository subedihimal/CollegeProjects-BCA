import { RECOMMEND_URL } from '../constants'
import { apiSlice } from './apiSlice';

export const productsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    //Recommended Products
    getProductRecommendation: builder.query({
      query: ({ keyword, pageNumber, cartItems }) => ({
        url: RECOMMEND_URL,
        method: 'POST',
        body: { keyword, pageNumber, cartItems  },
      }),
      keepUnusedDataFor: 5,
      providesTags: ['Products'],
    }),
  }),
});

export const {
  useGetProductRecommendationQuery,
} = productsApiSlice;
