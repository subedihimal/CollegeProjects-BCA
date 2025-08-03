import Product from '../models/productModel.js';

// Helper function to normalize a number between min and max
const normalize = (value, min, max) => {
  if (max === min) return 0.5; // Avoid divide-by-zero
  return (value - min) / (max - min);
};

// Cosine similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  return magA && magB ? dot / (magA * magB) : 0;
};

const buildFeatureVector = (product, allCategories, allBrands, priceRange, ratingRange) => {
  const categoryVec = allCategories.map((cat) => (product.category === cat ? 1 : 0));
  const brandVec = allBrands.map((br) => (product.brand === br ? 1 : 0));

  const priceNorm = normalize(product.price, priceRange.min, priceRange.max);
  const ratingNorm = normalize(product.rating, ratingRange.min, ratingRange.max);

  return [...categoryVec, ...brandVec, priceNorm, ratingNorm];
};

const getRecommendedProducts = async (requestData) => {
  try {
    console.log('Request data received:', requestData);
    
    // Extract cartItems from the request data
    const cartItems = requestData.cartItems || requestData || [];
    console.log('Cart items extracted:', cartItems);
    
    const products = await Product.find({});
    console.log('Products found:', products.length);

    if (!products.length) {
      console.log('No products found in database');
      return [];
    }

    if (!cartItems.length) {
      console.log('No cart items, returning popular products');
      // Return top-rated or random products when cart is empty
      const popularProducts = products
        .sort((a, b) => b.rating - a.rating) // Sort by rating
        .slice(0, 8); // Get top 8
      return popularProducts;
    }

    const allCategories = [...new Set(products.map((p) => p.category))];
    const allBrands = [...new Set(products.map((p) => p.brand))];

    const priceValues = products.map((p) => p.price);
    const ratingValues = products.map((p) => p.rating);
    const priceRange = { min: Math.min(...priceValues), max: Math.max(...priceValues) };
    const ratingRange = { min: Math.min(...ratingValues), max: Math.max(...ratingValues) };

    // Build cart vector (average of product vectors in cart)
    const cartVectors = cartItems.map((item) => {
      const product = products.find((p) => p._id.toString() === item._id);
      return product
        ? buildFeatureVector(product, allCategories, allBrands, priceRange, ratingRange)
        : null;
    }).filter(Boolean);

    // Handle case where no valid cart vectors found
    if (!cartVectors.length) {
      console.log('No valid cart vectors found');
      return [];
    }

    console.log('Cart vectors length:', cartVectors.length);

    const cartVector = cartVectors[0].map((_, i) =>
      cartVectors.reduce((sum, vec) => sum + vec[i], 0) / cartVectors.length
    );

    // Compute similarity of all products to cart vector
    const scored = products.map((product) => {
      const vector = buildFeatureVector(product, allCategories, allBrands, priceRange, ratingRange);
      const similarity = cosineSimilarity(cartVector, vector);
      return { product, similarity };
    });

    // Sort and return top results (excluding items already in cart)
    const cartIds = new Set(cartItems.map((i) => i._id));
    const recommended = scored
      .filter((item) => !cartIds.has(item.product._id.toString()))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map((item) => item.product);

    console.log('Recommended products:', recommended.length);
    
    // Return in the format expected by getProducts function
    return {
      products: recommended,
      page: requestData.page || 1,
      pages: Math.ceil(recommended.length / (requestData.pageSize || 8))
    };
    
  } catch (error) {
    console.error('Error in getRecommendedProducts:', error);
    return {
      products: [],
      page: 1,
      pages: 1
    };
  }
};

export default getRecommendedProducts;



//ORGINALL CODE

// import Product from '../models/productModel.js';

// const getRecommendedProducts = async ({ cartItems = [], keyword, pageSize, page }) => {

//     const count = await Product.countDocuments({ ...keyword });
//     const products = await Product.find({ ...keyword })
//     .limit(pageSize)
//     .skip(pageSize * (page - 1));
    
//   return {
//     products,
//     page,
//     pages: Math.ceil(count / pageSize),
//   };
// };

// export default getRecommendedProducts;
