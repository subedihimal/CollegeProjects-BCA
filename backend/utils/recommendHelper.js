import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';

// Get user's purchase history
const getUserPurchaseHistory = async (userId) => {
  if (!userId) return [];
  try {
    const orders = await Order.find({ user: userId }).populate('orderItems.product');
    const products = [];
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        if (item.product) products.push(item.product);
      });
    });
    return products;
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    return [];
  }
};

// Helper function to ensure product has full details including description
const ensureFullProductDetails = async (productIds) => {
  if (!productIds || productIds.length === 0) return [];
  try {
    const products = await Product.find({ _id: { $in: productIds } });
    return products;
  } catch (error) {
    console.error('Error fetching full product details:', error);
    return [];
  }
};

// Extract features from description (key:value pairs)
const extractFeatures = (description) => {
  if (!description) return {};
  const features = {};
  const pattern = /([^,:;]+):\s*([^,:;]+)/g;
  let match;
  while ((match = pattern.exec(description)) !== null) {
    features[match[1].trim().toLowerCase()] = match[2].trim().toLowerCase();
  }
  return features;
};

// Aggregate features across multiple products
const aggregateFeatures = (featuresList) => {
  const aggregated = {};
  
  featuresList.forEach(features => {
    Object.entries(features).forEach(([key, value]) => {
      if (!aggregated[key]) {
        aggregated[key] = new Set();
      }
      aggregated[key].add(value);
    });
  });
  
  // Convert Sets to comma-separated strings
  const result = {};
  Object.entries(aggregated).forEach(([key, valueSet]) => {
    result[key] = Array.from(valueSet).join(', ');
  });
  
  return result;
};

// Calculate feature match score with multi-value support
const calculateFeatureMatchScore = (productFeature, userFeatureValues) => {
  // userFeatureValues is a string like "2gb, 4gb, 8gb"
  const userValues = userFeatureValues.split(',').map(v => v.trim().toLowerCase());
  const productValue = productFeature.toLowerCase();
  
  // Exact match
  if (userValues.includes(productValue)) {
    return 1.0;
  }
  
  // Partial match (check if product value contains or is contained in user values)
  for (const userValue of userValues) {
    if (productValue.includes(userValue) || userValue.includes(productValue)) {
      return 0.5;
    }
  }
  
  return 0;
};

// Calculate traditional similarity (category, brand, price, rating)
const calculateTraditionalSimilarity = (product, userProfile) => {
  let score = 0;
  const breakdown = {};
  
  // Category match (30%)
  if (userProfile.categories.includes(product.category)) {
    score += 0.3;
    breakdown.category = { match: true, value: product.category };
  }
  
  // Brand match (30%)
  if (userProfile.brands.includes(product.brand)) {
    score += 0.3;
    breakdown.brand = { match: true, value: product.brand };
  }
  
  // Price similarity (20%)
  if (userProfile.avgPrice > 0) {
    const priceDiff = Math.abs(product.price - userProfile.avgPrice) / userProfile.avgPrice;
    const priceScore = Math.max(0, 1 - priceDiff);
    score += priceScore * 0.2;
    breakdown.price = { 
      similarity: Math.round(priceScore * 100),
      userAvg: userProfile.avgPrice,
      productPrice: product.price
    };
  }
  
  // Rating similarity (20%)
  if (userProfile.avgRating > 0) {
    const ratingDiff = Math.abs(product.rating - userProfile.avgRating) / 5;
    const ratingScore = Math.max(0, 1 - ratingDiff);
    score += ratingScore * 0.2;
    breakdown.rating = {
      similarity: Math.round(ratingScore * 100),
      userAvg: userProfile.avgRating,
      productRating: product.rating
    };
  }
  
  return { score, breakdown };
};

// Calculate description similarity with aggregated features
const calculateDescriptionSimilarity = (productFeatures, aggregatedUserFeatures) => {
  if (Object.keys(aggregatedUserFeatures).length === 0) {
    return { score: 0, matches: [] };
  }
  
  const matches = [];
  let totalScore = 0;
  let featureCount = 0;
  
  // Check each product feature against aggregated user features
  Object.entries(productFeatures).forEach(([key, value]) => {
    if (aggregatedUserFeatures[key]) {
      featureCount++;
      const matchScore = calculateFeatureMatchScore(value, aggregatedUserFeatures[key]);
      totalScore += matchScore;
      
      if (matchScore > 0) {
        matches.push({ 
          attribute: key, 
          productValue: value,
          userValues: aggregatedUserFeatures[key],
          matchType: matchScore === 1.0 ? 'exact' : 'partial'
        });
      }
    }
  });
  
  const score = featureCount > 0 ? totalScore / featureCount : 0;
  return { score, matches };
};

// Main recommendation function
const getRecommendedProducts = async (requestData) => {
  try {
    const { cartItems = [], viewedProducts = [], userId, pageSize = 8, page = 1, pageNumber = 1 } = requestData;
    const currentPage = page || pageNumber || 1;
    
    // Get purchase history
    const purchaseHistory = await getUserPurchaseHistory(userId);
    
    // Extract product IDs from all sources
    const cartProductIds = cartItems.map(item => item._id || item).filter(Boolean).slice(-10);
    const viewedProductIds = viewedProducts.map(item => item._id || item).filter(Boolean).slice(-10);
    const purchasedProductIds = purchaseHistory.map(item => item._id).slice(-10);
    
    // Fetch full product details for ALL products (including viewed ones)
    // This ensures we have descriptions for viewed products
    const allProductIds = [...cartProductIds, ...viewedProductIds, ...purchasedProductIds];
    const uniqueProductIds = [...new Set(allProductIds.map(id => id.toString()))];
    
    const fullProducts = await ensureFullProductDetails(uniqueProductIds);
    
    // Create a map of full product details
    const productMap = new Map();
    fullProducts.forEach(product => {
      productMap.set(product._id.toString(), product);
    });
    
    // Combine all user interactions with full details
    const userItems = new Map();
    uniqueProductIds.forEach(id => {
      const product = productMap.get(id.toString());
      if (product && !userItems.has(id.toString())) {
        userItems.set(id.toString(), {
          category: product.category,
          brand: product.brand,
          description: product.description, // Now this will be available for all products
          price: product.price,
          rating: product.rating
        });
      }
    });
    
    const userItemsArray = Array.from(userItems.values());
    
    // No user activity - return latest products
    if (userItemsArray.length === 0) {
      const products = await Product.find({}).sort({ createdAt: -1 }).limit(pageSize).skip((currentPage - 1) * pageSize);
      const total = await Product.countDocuments();
      return {
        products: products.map(p => ({ 
          ...p.toObject(), 
          exploreMode: true,
          inCart: false,
          previouslyPurchased: false,
          similarity: 0,
          scoringDetails: null
        })),
        page: currentPage,
        pages: Math.ceil(total / pageSize),
        userProfile: null
      };
    }
    
    // Extract features from all user items (including viewed products)
    const userFeaturesList = userItemsArray
      .map(i => extractFeatures(i.description))
      .filter(f => Object.keys(f).length > 0);
    
    // Aggregate features with multiple values
    const aggregatedFeatures = aggregateFeatures(userFeaturesList);
    
    // Build user profile
    const validItems = userItemsArray.filter(i => i.price != null && i.rating != null && !isNaN(i.price) && !isNaN(i.rating));
    
    const userProfile = {
      categories: [...new Set(userItemsArray.map(i => i.category))],
      brands: [...new Set(userItemsArray.map(i => i.brand))],
      aggregatedFeatures: aggregatedFeatures,
      avgPrice: validItems.length > 0 ? validItems.reduce((sum, i) => sum + i.price, 0) / validItems.length : 0,
      avgRating: validItems.length > 0 ? validItems.reduce((sum, i) => sum + i.rating, 0) / validItems.length : 0
    };
    
    // Create lookup sets for cart and purchase history
    const cartIds = new Set(cartProductIds.map(i => i.toString()));
    const purchasedIds = new Set(purchasedProductIds.map(p => p.toString()));
    
    // Get all products and score them
    const allProducts = await Product.find({});
    const scoredProducts = allProducts.map((product, index) => {
      const productId = product._id.toString();
      const productFeatures = extractFeatures(product.description);
      
      // Calculate similarities
      const traditional = calculateTraditionalSimilarity(product, userProfile);
      const description = calculateDescriptionSimilarity(productFeatures, userProfile.aggregatedFeatures);
      
      // Final score (weighted: 40% traditional, 60% description)
      const finalScore = (traditional.score * 0.4) + (description.score * 0.6);
      
      // Check if item is in cart or previously purchased
      const inCart = cartIds.has(productId);
      const previouslyPurchased = purchasedIds.has(productId);
      
      return {
        ...product.toObject(),
        rank: 0,
        similarity: Math.round(finalScore * 100) / 100,
        inCart: inCart,
        previouslyPurchased: previouslyPurchased,
        scoring: {
          traditional: Math.round(traditional.score * 100),
          description: Math.round(description.score * 100),
          final: Math.round(finalScore * 100)
        },
        scoringDetails: {
          traditionalSimilarity: Math.round(traditional.score * 100),
          descriptionSimilarity: Math.round(description.score * 100),
          finalScore: Math.round(finalScore * 100),
          breakdown: {
            traditional: traditional.breakdown,
            features: description.matches.slice(0, 5)
          }
        },
        breakdown: {
          traditional: traditional.breakdown,
          descriptionMatches: description.matches.slice(0, 5)
        }
      };
    });
    
    // Sort by similarity and assign ranks
    scoredProducts.sort((a, b) => b.similarity - a.similarity);
    scoredProducts.forEach((p, i) => p.rank = i + 1);
    
    // Paginate
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedProducts = scoredProducts.slice(startIndex, startIndex + pageSize);
    
    return {
      products: paginatedProducts,
      page: currentPage,
      pages: Math.ceil(scoredProducts.length / pageSize),
      userProfile: {
        categories: userProfile.categories,
        brands: userProfile.brands,
        aggregatedFeatures: userProfile.aggregatedFeatures,
        avgPrice: Math.round(userProfile.avgPrice * 100) / 100,
        avgRating: Math.round(userProfile.avgRating * 10) / 10,
        totalInteractions: userItemsArray.length
      }
    };
    
  } catch (error) {
    console.error('Error in recommendations:', error);
    return { products: [], page: requestData.page || requestData.pageNumber || 1, pages: 1, userProfile: null };
  }
};

export default getRecommendedProducts;