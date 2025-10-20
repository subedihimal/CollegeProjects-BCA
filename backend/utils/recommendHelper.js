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
const calculateFeatureSimilarity = (productFeatures, userFeatures) => {
  if (!productFeatures || !userFeatures) return { similarity: 0, matchedFeatures: [], details: [] };
  
  const productKeys = Object.keys(productFeatures);
  const userKeys = Object.keys(userFeatures);
  
  if (productKeys.length === 0 || userKeys.length === 0) return { similarity: 0, matchedFeatures: [], details: [] };
  
  let matches = 0;
  let totalComparisons = 0;
  const matchedFeatures = [];
  const details = [];
  
  // Compare each key in user features with product features
  userKeys.forEach(userKey => {
    const userValue = userFeatures[userKey];
    
    productKeys.forEach(productKey => {
      if (userKey.toLowerCase() === productKey.toLowerCase()) {
        totalComparisons++;
        const productValue = productFeatures[productKey].toLowerCase();
        
        // Handle both array and string values for userValue
        const userValues = Array.isArray(userValue) ? userValue : [userValue];
        
        // Check if any of the user's preferred values match the product value
        const hasMatch = userValues.some(val => val.toLowerCase() === productValue);
        
        if (hasMatch) {
          matches += 1;
          const matchedValue = userValues.find(val => val.toLowerCase() === productValue);
          matchedFeatures.push(`${userKey}: ${matchedValue}`);
          details.push({
            attribute: userKey,
            userValue: matchedValue,
            productValue: productValue
          });
        }
      }
    });
  });
  
  const similarity = totalComparisons > 0 ? matches / totalComparisons : 0;
  return { similarity, matchedFeatures, details };
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

// Extract common features from user's item features (FIXED - supports multiple values)
const extractCommonFeatures = (userFeatures) => {
  if (!userFeatures || userFeatures.length === 0) return {};
  
  const featureCount = {};
  
  // Count occurrences of each key-value pair
  userFeatures.forEach(features => {
    Object.entries(features).forEach(([key, value]) => {
      const featureKey = `${key}: ${value}`;
      featureCount[featureKey] = (featureCount[featureKey] || 0) + 1;
    });
  });
  
  // Filter features that appear in at least 20% of items (or at least once)
  const threshold = Math.max(1, Math.ceil(userFeatures.length * 0.2));
  const commonFeatures = {};
  
  Object.entries(featureCount).forEach(([feature, count]) => {
    if (count >= threshold) {
      const [key, ...valueParts] = feature.split(': ');
      const value = valueParts.join(': '); // Handle values that contain ':'
      
      // Store multiple values as array
      if (commonFeatures[key]) {
        // Add to existing array if not already present
        if (!commonFeatures[key].includes(value)) {
          commonFeatures[key].push(value);
        }
      } else {
        // Create new array with first value
        commonFeatures[key] = [value];
      }
    }
  });
  
  return commonFeatures;
};

// Get traditional similarity breakdown
const getTraditionalSimilarityBreakdown = (userItems, product, allCategories, allBrands, priceRange, ratingRange) => {
  const breakdown = {
    categoryMatch: false,
    brandMatch: false,
    priceRange: null,
    ratingRange: null,
    matchedCategories: [],
    matchedBrands: [],
    categoryContribution: 0,
    brandContribution: 0,
    priceContribution: 0,
    ratingContribution: 0,
    details: {
      userCategories: [],
      userBrands: [],
      categoryMatchCount: 0,
      brandMatchCount: 0
    }
  };
  
  // Track user's categories and brands
  const userCategoriesSet = new Set();
  const userBrandsSet = new Set();
  
  userItems.forEach(userItem => {
    userCategoriesSet.add(userItem.category);
    userBrandsSet.add(userItem.brand);
    
    if (userItem.category === product.category) {
      breakdown.categoryMatch = true;
      breakdown.details.categoryMatchCount++;
      if (!breakdown.matchedCategories.includes(product.category)) {
        breakdown.matchedCategories.push(product.category);
      }
    }
    if (userItem.brand === product.brand) {
      breakdown.brandMatch = true;
      breakdown.details.brandMatchCount++;
      if (!breakdown.matchedBrands.includes(product.brand)) {
        breakdown.matchedBrands.push(product.brand);
      }
    }
  });
  
  breakdown.details.userCategories = Array.from(userCategoriesSet);
  breakdown.details.userBrands = Array.from(userBrandsSet);
  
  // Calculate category contribution to similarity
  const categoryVectorLength = allCategories.length;
  if (breakdown.categoryMatch) {
    // Contribution is based on how many categories match vs total categories
    breakdown.categoryContribution = Math.round((1 / categoryVectorLength) * 100);
  }
  
  // Calculate brand contribution to similarity
  const brandVectorLength = allBrands.length;
  if (breakdown.brandMatch) {
    breakdown.brandContribution = Math.round((1 / brandVectorLength) * 100);
  }
  
  // Price range comparison
  const userPrices = userItems.map(i => i.price);
  const minUserPrice = Math.min(...userPrices);
  const maxUserPrice = Math.max(...userPrices);
  const avgUserPrice = userPrices.reduce((a, b) => a + b, 0) / userPrices.length;
  const priceInRange = product.price >= minUserPrice && product.price <= maxUserPrice;
  
  // Calculate price similarity (how close to user's average price)
  const productPriceNorm = normalize(product.price, priceRange.min, priceRange.max);
  const avgUserPriceNorm = normalize(avgUserPrice, priceRange.min, priceRange.max);
  const priceDifference = Math.abs(productPriceNorm - avgUserPriceNorm);
  const priceSimilarity = 1 - priceDifference;
  
  breakdown.priceRange = {
    inRange: priceInRange,
    userMin: Math.round(minUserPrice * 100) / 100,
    userMax: Math.round(maxUserPrice * 100) / 100,
    userAverage: Math.round(avgUserPrice * 100) / 100,
    productPrice: Math.round(product.price * 100) / 100,
    similarity: Math.round(priceSimilarity * 100),
    percentageDifference: Math.round(((product.price - avgUserPrice) / avgUserPrice) * 100)
  };
  breakdown.priceContribution = Math.round(priceSimilarity * 100);
  
  // Rating comparison
  const userRatings = userItems.map(i => i.rating);
  const avgUserRating = userRatings.reduce((a, b) => a + b, 0) / userRatings.length;
  const minUserRating = Math.min(...userRatings);
  const maxUserRating = Math.max(...userRatings);
  
  // Calculate rating similarity
  const productRatingNorm = normalize(product.rating, ratingRange.min, ratingRange.max);
  const avgUserRatingNorm = normalize(avgUserRating, ratingRange.min, ratingRange.max);
  const ratingDifference = Math.abs(productRatingNorm - avgUserRatingNorm);
  const ratingSimilarity = 1 - ratingDifference;
  
  breakdown.ratingRange = {
    userAverage: Math.round(avgUserRating * 10) / 10,
    userMin: Math.round(minUserRating * 10) / 10,
    userMax: Math.round(maxUserRating * 10) / 10,
    productRating: Math.round(product.rating * 10) / 10,
    similarity: Math.round(ratingSimilarity * 100),
    difference: Math.round((product.rating - avgUserRating) * 10) / 10
  };
  breakdown.ratingContribution = Math.round(ratingSimilarity * 100);
  
  return breakdown;
};

// Get weight for a product based on user interaction
const getProductWeight = (productId, cartIds, purchasedIds, viewedProductIds, purchaseHistory, viewedProducts) => {
  // Use a neutral multiplier of 1.0 by default (no boost).
  // Positive interactions will increase this multiplier (>1.0).

  // Cart items get the strongest positive multiplier
  if (cartIds.has(productId)) {
    return { weight: 1.4, reason: 'in_cart' };
  }

  // Previously purchased items (time-decaying boost)
  if (purchasedIds.has(productId)) {
    const purchaseItem = purchaseHistory.find(p => p._id === productId);
    const daysSincePurchase = (new Date() - new Date(purchaseItem.purchaseDate)) / (1000 * 60 * 60 * 24);
    // Start with a modest boost and decay exponentially to a minimum slightly above neutral
    // prevents previously purchased items from being penalized while still reducing influence over time
    const raw = 1.35 * Math.exp(-daysSincePurchase / 180);
    const weight = Math.max(1.05, raw);
    return { weight, reason: 'previously_purchased', daysSincePurchase: Math.round(daysSincePurchase) };
  }

  // Viewed items (small incremental boost per view, capped)
  // Note: per-product view boosting removed. Views will only be used to build the user profile.

  // New recommendations: neutral multiplier
  return { weight: 1.0, reason: 'new_recommendation' };
};

// Build explanation object for a recommendation
const buildExplanation = (product, traditionalSimilarity, descriptionSimilarity, userInteractionData, traditionalBreakdown, allMatchedDetails) => {
  const reasons = [];
  
  // Add user interaction reasons first (highest priority)
  if (userInteractionData.reason === 'in_cart') {
    reasons.push({
      type: 'user_action',
      label: 'You have this in your cart',
      strength: 'very_high'
    });
  } else if (userInteractionData.reason === 'previously_purchased') {
    reasons.push({
      type: 'user_action',
      label: 'You purchased a similar item before',
      strength: 'high',
      daysAgo: userInteractionData.daysSincePurchase
    });
  } else if (userInteractionData.reason === 'frequently_viewed') {
    reasons.push({
      type: 'user_action',
      label: `You've viewed similar items ${userInteractionData.viewCount} times`,
      strength: 'medium',
      viewCount: userInteractionData.viewCount
    });
  }
  
  // Add traditional similarity reasons with detailed breakdown
  if (traditionalSimilarity > 0.7) {
    const details = [];
    const contributions = [];
    
    if (traditionalBreakdown.categoryMatch) {
      details.push(`Matches your interest in ${traditionalBreakdown.matchedCategories.join(', ')} products`);
      contributions.push(`Category match (${traditionalBreakdown.categoryContribution}% contribution)`);
    }
    if (traditionalBreakdown.brandMatch) {
      details.push(`Same brand you prefer: ${traditionalBreakdown.matchedBrands.join(', ')}`);
      contributions.push(`Brand match (${traditionalBreakdown.brandContribution}% contribution)`);
    }
    if (traditionalBreakdown.priceRange.inRange) {
      details.push(`Within your typical price range (${traditionalBreakdown.priceRange.userMin} - ${traditionalBreakdown.priceRange.userMax})`);
      contributions.push(`Price similarity (${traditionalBreakdown.priceContribution}% contribution)`);
    }
    if (traditionalBreakdown.ratingRange.similarity > 70) {
      details.push(`Similar rating to what you typically choose (${traditionalBreakdown.ratingRange.productRating}★)`);
      contributions.push(`Rating match (${traditionalBreakdown.ratingContribution}% contribution)`);
    }
    
    reasons.push({
      type: 'category_brand_match',
      label: 'Strongly matches your preferences',
      strength: 'high',
      breakdown: traditionalBreakdown,
      details: details,
      contributions: contributions,
      explanationText: details.join('. ')
    });
  } else if (traditionalSimilarity > 0.4) {
    const details = [];
    const contributions = [];
    
    if (traditionalBreakdown.categoryMatch) {
      details.push(`Same ${traditionalBreakdown.matchedCategories.join(', ')} category you browse`);
      contributions.push(`Category (${traditionalBreakdown.categoryContribution}%)`);
    }
    if (traditionalBreakdown.brandMatch) {
      details.push(`Brand: ${traditionalBreakdown.matchedBrands.join(', ')}`);
      contributions.push(`Brand (${traditionalBreakdown.brandContribution}%)`);
    }
    if (traditionalBreakdown.priceRange.similarity > 50) {
      details.push(`Price is ${traditionalBreakdown.priceRange.percentageDifference >= 0 ? '+' : ''}${traditionalBreakdown.priceRange.percentageDifference}% vs your average`);
      contributions.push(`Price (${traditionalBreakdown.priceContribution}%)`);
    }
    
    reasons.push({
      type: 'category_brand_match',
      label: 'Similar to your interests',
      strength: 'medium',
      breakdown: traditionalBreakdown,
      details: details,
      contributions: contributions,
      explanationText: details.join('. ')
    });
  }
  
  // Add description similarity reasons (ensure details are strings)
  const stringifiedMatchedDetails = allMatchedDetails.map(d => {
    if (typeof d === 'string') return d;
    if (d && d.attribute && d.productValue) return `${d.attribute}: ${d.productValue}`;
    try { return JSON.stringify(d); } catch (e) { return String(d); }
  });

  if (descriptionSimilarity > 0.7 && stringifiedMatchedDetails.length > 0) {
    reasons.push({
      type: 'features_match',
      label: 'Has similar features to items you like',
      strength: 'high',
      details: stringifiedMatchedDetails.slice(0, 3),
      matchCount: stringifiedMatchedDetails.length
    });
  } else if (descriptionSimilarity > 0.4 && stringifiedMatchedDetails.length > 0) {
    reasons.push({
      type: 'features_match',
      label: 'Shares some features with your interests',
      strength: 'medium',
      details: stringifiedMatchedDetails.slice(0, 2),
      matchCount: stringifiedMatchedDetails.length
    });
  }
  
  // Calculate accurate confidence score based on actual weighted similarity
  const baseSimilarity = (traditionalSimilarity * 0.4) + (descriptionSimilarity * 0.6);
  const weightedSimilarity = baseSimilarity * userInteractionData.weight;
  
  return {
    primary: reasons[0] || {
      type: 'general',
      label: 'Recommended for you',
      strength: 'medium'
    },
    secondary: reasons.slice(1),
    allReasons: reasons,
    confidenceScore: Math.round(weightedSimilarity * 100),
    matchingSummary: {
      traditionalMatch: Math.round(traditionalSimilarity * 100),
      featureMatch: Math.round(descriptionSimilarity * 100),
      userInteractionBoost: Math.round(userInteractionData.weight * 100)
    }
  };
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
      const allProducts = await Product.find({}).sort({ createdAt: -1 });
      const totalCount = allProducts.length;
      const startIndex = (page - 1) * pageSize;
      const paginatedProducts = allProducts.slice(startIndex, startIndex + pageSize);
      return {
        products: paginatedProducts.map(product => ({
          ...product.toObject(),
          exploreToGetRecommendations: true,
          inCart: false,
          previouslyPurchased: false,
          viewCount: 0,
          similarity: 0,
          explanation: {
            primary: {
              type: 'explore',
              label: 'New products for you to discover',
              strength: 'medium'
            },
            secondary: [],
            allReasons: [],
            confidenceScore: 0
          }
        })),
        page,
        pages: Math.ceil(totalCount / pageSize),
        isExploreMode: true
      };
    }
    
    // Build user interest profile - avoid duplicates
    const seenIds = new Set();
    const allUserItems = [];
    
    // Add cart items first (highest priority)
    cartItems.forEach(item => {
      const id = item._id;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allUserItems.push({
          _id: id,
          name: item.name,
          brand: item.brand,
          category: item.category,
          description: item.description,
          price: item.price,
          rating: item.rating
        });
      }
    });
    
    // Add viewed products
    viewedProducts.forEach(product => {
      const id = product._id.toString();
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allUserItems.push({
          _id: id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          description: product.description,
          price: product.price,
          rating: product.rating
        });
      }
    });
    
    // Add recent purchase history (up to 10 items)
    purchaseHistory.slice(0, 10).forEach(product => {
      const id = product._id;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allUserItems.push(product);
      }
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
    // If an item lacks a description (e.g., lightweight viewed item), fall back to the DB product
    const userFeatures = allUserItems.map(item => {
      let desc = item.description;
      if (!desc) {
        const prod = products.find(p => p._id.toString() === item._id);
        desc = prod?.description || '';
      }
      return extractKeyValuePairs(desc);
    });
    
    // Build accurate user profile object
    const userProfile = {
      categories: [...new Set(allUserItems.map(item => item.category))],
      brands: [...new Set(allUserItems.map(item => item.brand))],
      avgPrice: Math.round(allUserItems.reduce((sum, item) => sum + item.price, 0) / allUserItems.length * 100) / 100,
      priceRange: {
        min: Math.min(...allUserItems.map(item => item.price)),
        max: Math.max(...allUserItems.map(item => item.price))
      },
      avgRating: Math.round((allUserItems.reduce((sum, item) => sum + item.rating, 0) / allUserItems.length) * 10) / 10,
      commonFeatures: extractCommonFeatures(userFeatures),
      totalItems: allUserItems.length,
      cartItemsCount: cartItems.length,
      purchaseHistoryCount: purchaseHistory.length,
      viewedProductsCount: viewedProducts.length
    };
    
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
      const traditionalBreakdown = getTraditionalSimilarityBreakdown(allUserItems, product, allCategories, allBrands, priceRange, ratingRange);
      
      // Description similarity - calculate correctly
      const productFeatures = extractKeyValuePairs(product.description);
      let totalSimilarity = 0;
      let allMatchedDetails = [];
      let validComparisons = 0;
      
      userFeatures.forEach(userFeature => {
        // Only compare if user feature has content
        if (Object.keys(userFeature).length > 0) {
          const { similarity, details } = calculateFeatureSimilarity(productFeatures, userFeature);
          totalSimilarity += similarity;
          allMatchedDetails = [...allMatchedDetails, ...details];
          validComparisons++;
        }
      });
      
      // Calculate average description similarity
      const descriptionSimilarity = validComparisons > 0 ? totalSimilarity / validComparisons : 0;
      
      // Remove duplicate matched details
      const uniqueMatchedDetails = allMatchedDetails.filter((detail, index, self) =>
        index === self.findIndex(d => d.attribute === detail.attribute && d.userValue === detail.userValue)
      );
      
      // Combined similarity (weighted average)
      const baseSimilarity = (traditionalSimilarity * 0.4) + (descriptionSimilarity * 0.6);
      
      // Apply user interaction weight
      const userInteractionData = getProductWeight(productId, cartIds, purchasedIds, viewedProductIds, purchaseHistory, viewedProducts);
      const finalSimilarity = baseSimilarity * userInteractionData.weight;
      
      // Build explanation with accurate data
      const explanation = buildExplanation(
        product,
        traditionalSimilarity,
        descriptionSimilarity,
        userInteractionData,
        traditionalBreakdown,
        uniqueMatchedDetails
      );
      
      return {
        ...product.toObject(),
        similarity: Math.round(finalSimilarity * 1000) / 1000, // Round to 3 decimal places
        inCart: cartIds.has(productId),
        previouslyPurchased: purchasedIds.has(productId),
        viewCount: viewedProducts.find(v => v._id.toString() === productId)?.viewCount || 0,
        explanation,
        scoringDetails: {
          traditionalSimilarity: Math.round(traditionalSimilarity * 100),
          descriptionSimilarity: Math.round(descriptionSimilarity * 100),
          baseSimilarity: Math.round(baseSimilarity * 100),
          interactionWeight: Math.round(userInteractionData.weight * 100),
          finalScore: Math.round(finalSimilarity * 100),
          breakdown: {
            traditional: traditionalBreakdown,
            features: uniqueMatchedDetails.slice(0, 5)
          }
        }
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
      isExploreMode: false,
      userProfile  
    };
    
  } catch (error) {
    console.error('Error in getRecommendedProducts:', error);
    return { products: [], page: 1, pages: 1, isExploreMode: false };
  }
};

export default getRecommendedProducts;