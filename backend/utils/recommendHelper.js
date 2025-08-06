import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';

// Get user's purchase history from orders
const getUserPurchaseHistory = async (userId) => {
  if (!userId) return [];
  
  try {
    const orders = await Order.find({ user: userId }).populate('orderItems.product');
    
    const purchasedProducts = [];
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        if (item.product) {
          purchasedProducts.push({
            _id: item.product._id.toString(),
            name: item.product.name,
            brand: item.product.brand,
            category: item.product.category,
            description: item.product.description,
            price: item.product.price,
            rating: item.product.rating,
            purchaseDate: order.createdAt
          });
        }
      });
    });
    
    // Remove duplicates and sort by recency
    return purchasedProducts
      .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
      .filter((product, index, self) => 
        index === self.findIndex(p => p._id === product._id)
      );
      
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    return [];
  }
};

// Extract key-value pairs from product description
const extractKeyValuePairs = (description) => {
  if (!description) return {};
  
  const keyValuePairs = {};
  const pattern = /([^,:;]+):\s*([^,:;]+)/g;
  let match;
  
  while ((match = pattern.exec(description)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    keyValuePairs[key] = value;
  }
  
  return keyValuePairs;
};

// Calculate exact feature similarity between two products
const calculateFeatureSimilarity = (features1, features2) => {
  if (!features1 || !features2) return 0;
  
  const keys1 = Object.keys(features1);
  const keys2 = Object.keys(features2);
  
  if (keys1.length === 0 || keys2.length === 0) return 0;
  
  let matches = 0;
  let totalComparisons = 0;
  
  keys1.forEach(key1 => {
    const value1 = features1[key1].toLowerCase();
    
    keys2.forEach(key2 => {
      if (key1.toLowerCase() === key2.toLowerCase()) {
        totalComparisons++;
        const value2 = features2[key2].toLowerCase();
        
        if (value1 === value2) {
          matches += 1;
        }
      }
    });
  });
  
  return totalComparisons > 0 ? matches / totalComparisons : 0;
};

// Normalize value between 0 and 1
const normalize = (value, min, max) => {
  return max === min ? 0.5 : (value - min) / (max - min);
};

// Calculate cosine similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  
  return magA && magB ? dot / (magA * magB) : 0;
};

// Build feature vector for traditional similarity
const buildFeatureVector = (product, allCategories, allBrands, priceRange, ratingRange) => {
  const categoryVec = allCategories.map(cat => product.category === cat ? 1 : 0);
  const brandVec = allBrands.map(brand => product.brand === brand ? 1 : 0);
  const priceNorm = normalize(product.price, priceRange.min, priceRange.max);
  const ratingNorm = normalize(product.rating, ratingRange.min, ratingRange.max);
  
  return [...categoryVec, ...brandVec, priceNorm, ratingNorm];
};

// Get weight for a product based on user interaction
const getProductWeight = (productId, cartIds, purchasedIds, viewedProductIds, purchaseHistory, viewedProducts) => {
  // Cart items get highest priority
  if (cartIds.has(productId)) {
    return 1.0;
  }
  
  // Previously purchased items (time-decaying)
  if (purchasedIds.has(productId)) {
    const purchaseItem = purchaseHistory.find(p => p._id === productId);
    const daysSincePurchase = (new Date() - new Date(purchaseItem.purchaseDate)) / (1000 * 60 * 60 * 24);
    return Math.max(0.3, 0.8 - (daysSincePurchase / 180));
  }
  
  // Viewed items (based on view count)
  if (viewedProductIds.has(productId)) {
    const viewedItem = viewedProducts.find(v => v._id.toString() === productId);
    const viewCount = viewedItem.viewCount;
    return Math.min(0.5 + (viewCount * 0.1), 1.0);
  }
  
  // New recommendations
  return 0.6;
};

// Main recommendation function
const getRecommendedProducts = async (requestData) => {
  try {
    const cartItems = requestData.cartItems || [];
    const viewedProducts = requestData.viewedProducts || [];
    const userId = requestData.userId;
    const pageSize = Number(requestData.pageSize) || 8;
    const page = Number(requestData.page) || 1;
       
    // Get purchase history
    const purchaseHistory = await getUserPurchaseHistory(userId);
    
    // If no user activity, return latest products
    if (cartItems.length === 0 && purchaseHistory.length === 0 && viewedProducts.length === 0) {
      const allProducts = await Product.find({}).sort({ createdAt: -1 }); // Get latest products
      const totalCount = allProducts.length;
      const startIndex = (page - 1) * pageSize;
      const paginatedProducts = allProducts.slice(startIndex, startIndex + pageSize);
      return {
        products: paginatedProducts.map(product => ({
          ...product.toObject(),
          exploreToGetRecommendations: true,
          inCart: false,
          previouslyPurchased: false,
          viewCount: 0
        })),
        page,
        pages: Math.ceil(totalCount / pageSize),
        isExploreMode: true
      };
    }
    
    // Build user interest profile
    const allUserItems = [...cartItems];
    
    // Add viewed products to profile
    viewedProducts.forEach(product => {
      allUserItems.push({
        _id: product._id.toString(),
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description,
        price: product.price,
        rating: product.rating
      });
    });
    
    // Add purchase history to profile
    purchaseHistory.slice(0, 10).forEach(product => {
      allUserItems.push(product);
    });
    
    if (allUserItems.length === 0) {
      return { products: [], page: 1, pages: 1, isExploreMode: false };
    }
    
    // Get all products from database
    const products = await Product.find({});
    if (!products.length) {
      return { products: [], page: 1, pages: 1, isExploreMode: false };
    }
    
    // Extract categories, brands, and ranges for normalization
    const allCategories = [...new Set(products.map(p => p.category))];
    const allBrands = [...new Set(products.map(p => p.brand))];
    const priceValues = products.map(p => p.price);
    const ratingValues = products.map(p => p.rating);
    const priceRange = { min: Math.min(...priceValues), max: Math.max(...priceValues) };
    const ratingRange = { min: Math.min(...ratingValues), max: Math.max(...ratingValues) };
    
    // Build user preference vector
    const userVectors = allUserItems
      .map(item => {
        const product = products.find(p => p._id.toString() === item._id);
        return product ? buildFeatureVector(product, allCategories, allBrands, priceRange, ratingRange) : null;
      })
      .filter(Boolean);
    
    if (!userVectors.length) {
      return { products: [], page: 1, pages: 1, isExploreMode: false };
    }
    
    // Calculate average user vector
    const userVector = userVectors[0].map((_, i) =>
      userVectors.reduce((sum, vec) => sum + vec[i], 0) / userVectors.length
    );
    
    // Extract user features for description matching
    const userFeatures = allUserItems.map(item => extractKeyValuePairs(item.description));
    
    // Create lookup sets
    const cartIds = new Set(cartItems.map(i => i._id));
    const purchasedIds = new Set(purchaseHistory.map(p => p._id));
    const viewedProductIds = new Set(viewedProducts.map(v => v._id.toString()));
    
    // Score all products
    const scoredProducts = products.map(product => {
      const productId = product._id.toString();
      
      // Traditional similarity (category, brand, price, rating)
      const vector = buildFeatureVector(product, allCategories, allBrands, priceRange, ratingRange);
      const traditionalSimilarity = cosineSimilarity(userVector, vector);
      
      // Description similarity
      const productFeatures = extractKeyValuePairs(product.description);
      let descriptionSimilarity = 0;
      userFeatures.forEach(userFeature => {
        descriptionSimilarity += calculateFeatureSimilarity(productFeatures, userFeature);
      });
      descriptionSimilarity = descriptionSimilarity / userFeatures.length;
      
      // Combined similarity
      const baseSimilarity = (traditionalSimilarity * 0.4) + (descriptionSimilarity * 0.6);
      
      // Apply user interaction weight
      const weight = getProductWeight(productId, cartIds, purchasedIds, viewedProductIds, purchaseHistory, viewedProducts);
      const finalSimilarity = baseSimilarity * weight;
      
      return {
        ...product.toObject(),
        similarity: finalSimilarity,
        inCart: cartIds.has(productId),
        previouslyPurchased: purchasedIds.has(productId),
        viewCount: viewedProducts.find(v => v._id.toString() === productId)?.viewCount || 0
      };
    });
    
    // Sort by similarity and paginate
    const sortedProducts = scoredProducts.sort((a, b) => b.similarity - a.similarity);
    const totalPages = Math.ceil(sortedProducts.length / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = sortedProducts.slice(startIndex, startIndex + pageSize);
    
    return {
      products: paginatedProducts,
      page,
      pages: totalPages,
      isExploreMode: false
    };
    
  } catch (error) {
    console.error('Error in getRecommendedProducts:', error);
    return { products: [], page: 1, pages: 1, isExploreMode: false };
  }
};

export default getRecommendedProducts;