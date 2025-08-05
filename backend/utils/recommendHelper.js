import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';

// Get user's purchase history from orders
const getUserPurchaseHistory = async (userId) => {
  if (!userId) return [];
  
  try {
    // Get user's orders (paid or unpaid)
    const orders = await Order.find({ 
      user: userId,
    }).populate('orderItems.product');
    
    // Extract all products from order items
    const purchasedProducts = [];
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        if (item.product) {
          purchasedProducts.push({
            _id: item.product._id,
            name: item.product.name,
            brand: item.product.brand,
            category: item.product.category,
            description: item.product.description,
            price: item.product.price,
            rating: item.product.rating,
            purchaseDate: order.createdAt,
            quantity: item.qty
          });
        }
      });
    });
    
    // Sort by purchase date (most recent first) and remove duplicates
    const uniqueProducts = purchasedProducts
      .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
      .filter((product, index, self) => 
        index === self.findIndex(p => p._id.toString() === product._id.toString())
      );
    
    return uniqueProducts;
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    return [];
  }
};

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

// Simple function to extract key-value pairs exactly as written in description
const extractKeyValuePairs = (description) => {
  if (!description) return {};
  
  const keyValuePairs = {};
  
  // Extract "Key: Value" patterns (handles commas, semicolons, and end of string)
  const pattern = /([^,:;]+):\s*([^,:;]+)/g;
  let match;
  
  while ((match = pattern.exec(description)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    
    // Store as key-value pair (keeping original case for better matching)
    keyValuePairs[key] = value;
  }
  
  return keyValuePairs;
};

// Calculate similarity between two key-value feature sets
const calculateFeatureSimilarity = (features1, features2) => {
  if (!features1 || !features2) return 0;
  
  const keys1 = Object.keys(features1);
  const keys2 = Object.keys(features2);
  
  if (keys1.length === 0 || keys2.length === 0) return 0;
  
  let matches = 0;
  let totalComparisons = 0;
  
  // Check each key-value pair from features1
  keys1.forEach(key1 => {
    const value1 = features1[key1].toLowerCase();
    
    // Check if same key exists in features2
    keys2.forEach(key2 => {
      if (key1.toLowerCase() === key2.toLowerCase()) {
        totalComparisons++;
        const value2 = features2[key2].toLowerCase();
        
        // Exact match gets full point
        if (value1 === value2) {
          matches += 1;
        }
        // Partial match (one contains the other) gets half point
        else if (value1.includes(value2) || value2.includes(value1)) {
          matches += 0.5;
        }
      }
    });
  });
  
  return totalComparisons > 0 ? matches / totalComparisons : 0;
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
    // Extract data from request
    const cartItems = requestData.cartItems || [];
    const keyword = requestData.keyword || {};
    const pageSize = Number(requestData.pageSize) || 8;
    const page = Number(requestData.page) || 1;
    const userId = requestData.userId;
    const viewedProducts = requestData.viewedProducts || []; // Add viewed products
    
    // Get user's purchase history
    const purchaseHistory = await getUserPurchaseHistory(userId);
    
    // If no cart items, no purchase history, and no viewed products, return latest products with explore flag
    if (cartItems.length === 0 && purchaseHistory.length === 0 && viewedProducts.length === 0) {
      const count = await Product.countDocuments({ ...keyword });
      const products = await Product.find({ ...keyword })
        .sort({ createdAt: -1 }) // Sort by latest products
        .limit(pageSize)
        .skip(pageSize * (page - 1));
      
      // Add explore flag to each product
      const productsWithExploreFlag = products.map(product => ({
        ...product.toObject(),
        exploreToGetRecommendations: true, // Flag for frontend
        inCart: false,
        previouslyPurchased: false
      }));
      
      return {
        products: productsWithExploreFlag,
        page,
        pages: Math.ceil(count / pageSize),
        isExploreMode: true // Flag for frontend to show explore message
      };
    }
    
    // Combine cart items with recent purchases and viewed products for better recommendations
    const allUserItems = [...cartItems];
    
    // Add viewed products to recommendation base (weight by view count)
    if (viewedProducts.length > 0) {
      const viewedProductsForRecommendation = viewedProducts.map((product) => {
        // Progressive weighting based on view count
        let viewWeight;
        if (product.viewCount === 1) {
          viewWeight = 0.2; // Single view - low influence
        } else if (product.viewCount <= 3) {
          viewWeight = 0.4; // 2-3 views - moderate influence
        } else if (product.viewCount <= 5) {
          viewWeight = 0.6; // 4-5 views - good influence
        } else if (product.viewCount <= 10) {
          viewWeight = 0.8; // 6-10 views - strong influence
        } else {
          viewWeight = 1.0; // 10+ views - maximum influence
        }
        
        return {
          _id: product._id.toString(),
          name: product.name,
          brand: product.brand,
          category: product.category,
          description: product.description,
          price: product.price,
          rating: product.rating,
          weight: viewWeight,
          viewCount: product.viewCount,
          lastViewed: product.lastViewed
        };
      });
      
      allUserItems.push(...viewedProductsForRecommendation);
    }
    
    // If cart is empty but user has purchase history or viewed products, use them for recommendations
    if (cartItems.length === 0 && (purchaseHistory.length > 0 || viewedProducts.length > 0)) {
      // Use recent purchases for recommendations
      if (purchaseHistory.length > 0) {
        const recentPurchases = purchaseHistory.slice(0, 10).map((product, index) => {
          const recencyWeight = 1 - (index * 0.1);
          return {
            _id: product._id.toString(), // Convert ObjectId to string
            name: product.name,
            brand: product.brand,
            category: product.category,
            description: product.description,
            price: product.price,
            rating: product.rating,
            weight: recencyWeight,
            purchaseDate: product.purchaseDate
          };
        });
        
        allUserItems.push(...recentPurchases);
      }
    }
    // If cart has items and user has purchase history or viewed products, combine all
    else if (cartItems.length > 0 && (purchaseHistory.length > 0 || viewedProducts.length > 0)) {
      // Add purchase history
      if (purchaseHistory.length > 0) {
        const recentPurchases = purchaseHistory.slice(0, 10).map((product, index) => {
          const recencyWeight = 1 - (index * 0.1);
          return {
            _id: product._id.toString(), // Convert ObjectId to string
            name: product.name,
            brand: product.brand,
            category: product.category,
            description: product.description,
            price: product.price,
            rating: product.rating,
            weight: recencyWeight,
            purchaseDate: product.purchaseDate
          };
        });
        
        allUserItems.push(...recentPurchases);
      }
    }
    
    // If still no user items (shouldn't happen), return empty
    if (allUserItems.length === 0) {
      return {
        products: [],
        page: 1,
        pages: 1,
        isExploreMode: false
      };
    }
    
    // If user items exist, do recommendation logic
    const products = await Product.find({});

    if (!products.length) {
      return {
        products: [],
        page: 1,
        pages: 1
      };
    }

    const allCategories = [...new Set(products.map((p) => p.category))];
    const allBrands = [...new Set(products.map((p) => p.brand))];

    const priceValues = products.map((p) => p.price);
    const ratingValues = products.map((p) => p.rating);
    const priceRange = { min: Math.min(...priceValues), max: Math.max(...priceValues) };
    const ratingRange = { min: Math.min(...ratingValues), max: Math.max(...ratingValues) };

    // Build user vector (average of product vectors from cart + purchases)
    const userVectors = allUserItems.map((item) => {
      // Convert ObjectId to string for comparison
      const itemId = item._id.toString();
      const product = products.find((p) => p._id.toString() === itemId);
      return product
        ? buildFeatureVector(product, allCategories, allBrands, priceRange, ratingRange)
        : null;
    }).filter(Boolean);

    // Handle case where no valid user vectors found
    if (!userVectors.length) {
      return {
        products: [],
        page: 1,
        pages: 1
      };
    }

    const userVector = userVectors[0].map((_, i) =>
      userVectors.reduce((sum, vec) => sum + vec[i], 0) / userVectors.length
    );

    // Extract key-value features from all user items (cart + purchases + views)
    const userFeatures = allUserItems.map(item => 
      extractKeyValuePairs(item.description)
    );

    // Create sets for quick lookup
    const cartIds = new Set(cartItems.map((i) => i._id));
    const purchasedIds = new Set(purchaseHistory.map((p) => p._id.toString()));
    const viewedProductIds = new Set(viewedProducts.map((v) => v._id.toString())); // Changed name to avoid conflict

    // Compute similarity of all products to user preferences
    const scored = products.map((product) => {
      const vector = buildFeatureVector(product, allCategories, allBrands, priceRange, ratingRange);
      const cosineSim = cosineSimilarity(userVector, vector);
      
      // Calculate advanced feature similarity
      const productFeatures = extractKeyValuePairs(product.description);
      let featureSimilarity = 0;
      
      userFeatures.forEach(userFeature => {
        featureSimilarity += calculateFeatureSimilarity(productFeatures, userFeature);
      });
      featureSimilarity = featureSimilarity / userFeatures.length;
      
      // Advanced weighting system with view count influence
      let itemWeight = 1.0;
      
      // Current cart items get highest priority
      if (cartIds.has(product._id.toString())) {
        itemWeight = 1.0;
      }
      // Previously purchased items get reduced weight based on recency
      else if (purchasedIds.has(product._id.toString())) {
        const purchaseItem = purchaseHistory.find(p => p._id.toString() === product._id.toString());
        const daysSincePurchase = (new Date() - new Date(purchaseItem.purchaseDate)) / (1000 * 60 * 60 * 24);
        itemWeight = Math.max(0.3, 0.8 - (daysSincePurchase / 180)); // Reduce weight over 6 months
      }
      // Viewed items get progressive weight based on view count
      else if (viewedProductIds.has(product._id.toString())) {
        const viewedItem = viewedProducts.find(v => v._id.toString() === product._id.toString());
        const viewCount = viewedItem.viewCount;
        
        // Progressive view count weighting - more views = exponentially higher weight
        if (viewCount === 1) {
          itemWeight = 0.3; // Single view - minimal influence
        } else if (viewCount <= 3) {
          itemWeight = 0.5; // 2-3 views - moderate influence
        } else if (viewCount <= 5) {
          itemWeight = 0.7; // 4-5 views - good influence
        } else if (viewCount <= 10) {
          itemWeight = 0.85; // 6-10 views - strong influence
        } else {
          itemWeight = 0.95; // 10+ views - very strong influence (almost as high as cart)
        }
      }
      // New recommendations get standard weight
      else {
        itemWeight = 0.9;
      }
      
      // Combine cosine similarity with feature similarity (weighted)
      const combinedSimilarity = ((cosineSim * 0.4) + (featureSimilarity * 0.6)) * itemWeight;
      
      return { 
        product, 
        similarity: combinedSimilarity, 
        cosineSim, 
        featureSimilarity,
        features: productFeatures
      };
    });

    // Sort all products by similarity and add flags
    const allRecommended = scored
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => ({
        ...item.product.toObject(),
        similarity: item.similarity,
        inCart: cartIds.has(item.product._id.toString()),
        previouslyPurchased: purchasedIds.has(item.product._id.toString()),
        viewCount: viewedProducts.find(v => v._id.toString() === item.product._id.toString())?.viewCount || 0
      }));
    
    // Calculate pagination
    const totalRecommended = allRecommended.length;
    const totalPages = Math.ceil(totalRecommended / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Get products for current page
    const paginatedRecommended = allRecommended.slice(startIndex, endIndex);
    
    // Return in the format expected by getProducts function
    return {
      products: paginatedRecommended,
      page: page,
      pages: totalPages,
      isExploreMode: false // Not in explore mode when we have recommendations
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