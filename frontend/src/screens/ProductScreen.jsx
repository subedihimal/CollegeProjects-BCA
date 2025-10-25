import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Image, Card, Button, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import {
  useGetProductDetailsQuery,
  useCreateReviewMutation,
} from '../slices/productsApiSlice';
import { useGetProductRecommendationQuery } from '../slices/recommendApiSlice';
import Rating from '../components/Rating';
import Loader from '../components/Loader';
import Message from '../components/Message';
import Meta from '../components/Meta';
import Product from '../components/Product';
import { addToCart } from '../slices/cartSlice';
import { trackProductView } from '../slices/productViewsSlice';
import { selectCurrentUserId } from '../slices/authSlice';
import { selectViewedProducts } from '../slices/productViewsSlice';
import { FaInfoCircle } from 'react-icons/fa';

// Shared animations CSS
const animations = `
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

// Product Card with Explanation Overlay
const ProductCardWithOverlay = ({ product, showInCartFlag, productRank }) => {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'visible' }}>
      <style dangerouslySetInnerHTML={{ __html: animations }} />
      
      <div onClick={() => showOverlay && setShowOverlay(false)} style={{ position: 'relative' }}>
        <Product product={product} showInCartFlag={showInCartFlag} />
        
        {/* Info Button - Only show for recommended products with explanation */}
        {product.scoringDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOverlay(!showOverlay);
            }}
            style={{
              position: 'absolute',
              bottom: '15px',
              right: '15px',
              background: 'rgba(0, 123, 255, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 30,
              boxShadow: '0 4px 12px rgba(0, 123, 255, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.background = 'rgba(0, 123, 255, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(0, 123, 255, 0.9)';
            }}
          >
            <FaInfoCircle size={20} />
          </button>
        )}
      </div>
      
      {/* Explanation Overlay */}
      {product.scoringDetails && (
        <div
          onClick={() => setShowOverlay(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(0, 123, 255, 0.97) 0%, rgba(0, 86, 179, 0.97) 100%)',
            backdropFilter: 'blur(10px)',
            borderRadius: '8px',
            padding: '20px',
            color: 'white',
            opacity: showOverlay ? 1 : 0,
            transform: showOverlay ? 'scale(1)' : 'scale(0.95)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: showOverlay ? 'auto' : 'none',
            overflow: 'auto',
            zIndex: 20,
            boxShadow: showOverlay ? '0 20px 60px rgba(0, 0, 0, 0.4)' : 'none',
            cursor: 'pointer'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '16px', animation: showOverlay ? 'slideDown 0.5s ease-out' : 'none' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              Why This Product?
            </div>
            {productRank && (
              <div style={{
                fontSize: '14px',
                marginBottom: '8px',
                padding: '6px 12px',
                background: 'rgba(255, 215, 0, 0.3)',
                borderRadius: '12px',
                display: 'inline-block',
                border: '1px solid rgba(255, 215, 0, 0.5)'
              }}>
                🏆 Ranked #{productRank}
              </div>
            )}
            <div style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, transparent, white, transparent)', margin: '0 auto' }} />
          </div>

          {/* Similarity Breakdown */}
          {product.scoringDetails && (
            <div style={{ marginBottom: '12px', animation: showOverlay ? 'slideIn 0.6s ease-out 0.1s both' : 'none' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', opacity: 0.9 }}>
                Scoring Breakdown
              </div>
              <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Traditional Match:</span>
                  <span style={{ fontWeight: 'bold', color: '#90EE90' }}>{product.scoringDetails.traditionalSimilarity}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Description Match:</span>
                  <span style={{ fontWeight: 'bold', color: '#90EE90' }}>{product.scoringDetails.descriptionSimilarity}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <span style={{ fontWeight: 'bold' }}>Overall Similarity:</span>
                  <span style={{ fontWeight: 'bold', color: '#00FF7F' }}>{(product.similarity * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Match Breakdown */}
          {product.scoringDetails?.breakdown && (
            <div style={{ marginBottom: '12px', animation: showOverlay ? 'slideIn 0.6s ease-out 0.2s both' : 'none' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', opacity: 0.9 }}>
                Match Details
              </div>
              
              {/* Traditional Matching */}
              {product.scoringDetails.breakdown.traditional && Object.keys(product.scoringDetails.breakdown.traditional).length > 0 && (
                <div style={{ marginBottom: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#FFD700' }}>
                    Traditional Matching ({product.scoringDetails.traditionalSimilarity}%)
                  </div>
                  
                  {/* Category Match */}
                  {product.scoringDetails.breakdown.traditional.category?.match && (
                    <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                      <div style={{ fontWeight: '600', color: '#90EE90' }}>
                        ✓ Category Match (30% contribution)
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                        Matched: {product.scoringDetails.breakdown.traditional.category.value}
                      </div>
                    </div>
                  )}
                  
                  {/* Brand Match */}
                  {product.scoringDetails.breakdown.traditional.brand?.match && (
                    <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                      <div style={{ fontWeight: '600', color: '#90EE90' }}>
                        ✓ Brand Match (30% contribution)
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                        Matched: {product.scoringDetails.breakdown.traditional.brand.value}
                      </div>
                    </div>
                  )}
                  
                  {/* Price Match */}
                  {product.scoringDetails.breakdown.traditional.price && (
                    <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                      <div style={{ fontWeight: '600', color: '#90EE90' }}>
                        ○ Price Similarity (20% contribution)
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                        Product: ${product.scoringDetails.breakdown.traditional.price.productPrice?.toFixed(2)} | 
                        Your avg: ${product.scoringDetails.breakdown.traditional.price.userAvg?.toFixed(2)}
                        {product.scoringDetails.breakdown.traditional.price.similarity != null && 
                          ` (${product.scoringDetails.breakdown.traditional.price.similarity}% match)`
                        }
                      </div>
                    </div>
                  )}
                  
                  {/* Rating Match */}
                  {product.scoringDetails.breakdown.traditional.rating && (
                    <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                      <div style={{ fontWeight: '600', color: '#90EE90' }}>
                        ✓ Rating Similarity (20% contribution)
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                        Product: {product.scoringDetails.breakdown.traditional.rating.productRating?.toFixed(1)}★ | 
                        Your avg: {product.scoringDetails.breakdown.traditional.rating.userAvg?.toFixed(1)}★
                        {product.scoringDetails.breakdown.traditional.rating.similarity != null && 
                          ` (${product.scoringDetails.breakdown.traditional.rating.similarity}% match)`
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Feature Matches */}
              {product.scoringDetails.breakdown.features?.length > 0 && (
                <div style={{ marginBottom: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#FFD700' }}>
                    Feature Matches ({product.scoringDetails.descriptionSimilarity}%)
                  </div>
                  {product.scoringDetails.breakdown.features.map((feature, idx) => (
                    <div key={idx} style={{ marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                      <div style={{ fontWeight: '600', color: '#90EE90', textTransform: 'capitalize' }}>
                        {feature.matchType === 'exact' ? '✓' : '○'} {feature.attribute}
                        {feature.matchType === 'partial' && (
                          <span style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.8 }}>(partial match)</span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                        Product: {feature.productValue} | Your preferences: {feature.userValues}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Badges */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', animation: showOverlay ? 'fadeIn 0.6s ease-out 0.3s both' : 'none' }}>
            {product.inCart && (
              <span style={{ fontSize: '10px', padding: '4px 10px', background: 'linear-gradient(135deg, #2196F3, #1976D2)', borderRadius: '12px', fontWeight: '600', boxShadow: '0 2px 8px rgba(33, 150, 243, 0.4)' }}>
                In Cart
              </span>
            )}
            {product.previouslyPurchased && (
              <span style={{ fontSize: '10px', padding: '4px 10px', background: 'linear-gradient(135deg, #FF9800, #F57C00)', borderRadius: '12px', fontWeight: '600', boxShadow: '0 2px 8px rgba(255, 152, 0, 0.4)' }}>
                Purchased Before
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ProductScreen = () => {
  const { id: productId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const { data: product, isLoading, refetch, error } = useGetProductDetailsQuery(productId);
  const { userInfo } = useSelector((state) => state.auth);
  const [createReview, { isLoading: loadingProductReview }] = useCreateReviewMutation();
  
  // Get data for recommendations
  const { cartItems } = useSelector((state) => state.cart);
  const userId = useSelector(selectCurrentUserId);
  const viewedProducts = useSelector(selectViewedProducts);
  
  // Fetch recommendations based only on current product
  const { data: recommendationsData, isLoading: loadingRecommendations } = useGetProductRecommendationQuery({
    pageNumber: 1,
    cartItems: [],
    userId: null,
    viewedProducts: product ? [{
      productId: product._id,
      productData: {
        _id: product._id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        rating: product.rating,
        description: product.description
      }
    }] : []
  }, {
    skip: !product // Only fetch when product is loaded
  });

  // Track product view when component mounts
  useEffect(() => {
    if (product) {
      dispatch(trackProductView({
        productId: product._id,
        productData: {
          _id: product._id,
          name: product.name,
          image: product.image,
          brand: product.brand,
          category: product.category,
          price: product.price,
          rating: product.rating
        }
      }));
    }
  }, [dispatch, product]);

  const addToCartHandler = () => {
    dispatch(addToCart({ ...product, qty }));
    navigate('/cart');
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    try {
      await createReview({ productId, rating, comment }).unwrap();
      refetch();
      toast.success('Review created successfully');
      setRating(0);
      setComment('');
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  if (isLoading) return <Loader />;
  if (error) return <Message variant='danger'>{error?.data?.message || error.error}</Message>;

  // Filter out current product from recommendations
  const filteredRecommendations = recommendationsData?.products?.filter(
    p => p._id !== productId
  ).slice(0, 4) || [];

  return (
    <>
      <Meta title={product.name} description={product.description} />
      
      <Link style={styles.backButton} to='/'>
        ← Go Back
      </Link>
      
      <Row className="mt-4">
        {/* Product Image */}
        <Col md={5}>
          <div style={styles.imageContainer}>
            <Image src={product.image} alt={product.name} style={styles.image} />
          </div>
        </Col>
        
        {/* Product Info - Full Width */}
        <Col md={7}>
          <Card style={styles.card}>
            <Card.Body>
              <h1 style={styles.title}>{product.name}</h1>
              
              <div style={styles.ratingSection}>
                <Rating value={product.rating} text={`${product.numReviews} reviews`} />
                  <div style={{ ...styles.inforColumn, marginTop: '16px', display: 'flex', gap: '40px' }}>
                    <div>
                      <span style={styles.infoLabel}>Brand: </span>
                      <span style={{ ...styles.infoValue, fontWeight: 'bold' }}>{product.brand}</span>
                    </div>

                    <div>
                      <span style={styles.infoLabel}>Category: </span>
                      <span style={{ ...styles.infoValue, fontWeight: 'bold' }}>{product.category}</span>
                    </div>
                  </div>
          
                
              </div>
              
              <div style={styles.descriptionSection}>
                <h4 style={styles.sectionTitle}>Product Description</h4>
                <p style={styles.description}>{product.description}</p>
              </div>

              {/* Horizontal Purchase Section */}
              <div style={styles.purchaseSection}>
                <div style={styles.purchaseLeft}>
                  <div style={styles.finalPrice}> ₹ {product.price}</div>
                  <div style={styles.stockIndicator}>
                    {product.countInStock > 0 ? `${product.countInStock} units in Stock` : 'Out of Stock'}
                  </div>
                </div>
                
                {product.countInStock > 0 && (
                  <div style={styles.purchaseCenter}>
                    <Form.Label style={styles.quantityLabel}>Quantity:</Form.Label>
                    <Form.Control
                      as='select'
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                      style={styles.quantitySelectHorizontal}
                    >
                      {[...Array(product.countInStock).keys()].map((x) => (
                        <option key={x + 1} value={x + 1}>{x + 1}</option>
                      ))}
                    </Form.Control>
                  </div>
                )}
                
                <div style={styles.purchaseRight}>
                  <Button
                    style={styles.addToCartButtonHorizontal}
                    type='button'
                    disabled={product.countInStock === 0}
                    onClick={addToCartHandler}
                  >
                    {product.countInStock === 0 ? 'Out of Stock' : 'Add To Cart'}
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Recommendations Section */}
      {filteredRecommendations.length > 0 && (
        <Row className="mt-4">
          <Col xs={12}>
            <Card style={styles.card}>
              <Card.Body>
                <h2 style={styles.recommendationsTitle}>
                  You May Also Like
                </h2>
                <p style={styles.recommendationsSubtitle}>
                  Based on your browsing history and preferences
                </p>
                
                {loadingRecommendations ? (
                  <Loader />
                ) : (
                  <Row>
                    {filteredRecommendations.map((recProduct, index) => (
                      <Col key={recProduct._id} sm={12} md={6} lg={3}>
                        <ProductCardWithOverlay 
                          product={recProduct} 
                          showInCartFlag={true}
                          productRank={recProduct.rank}
                        />
                      </Col>
                    ))}
                  </Row>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
      
      {/* Reviews Section */}
      <Row className="mt-4">
        <Col md={8}>
          <Card style={styles.card}>
            <Card.Body>
              <h2 style={styles.reviewsTitle}>
                Customer Reviews ({product.reviews.length})
              </h2>
              
              {product.reviews.length === 0 ? (
                <div style={styles.noReviews}>
                  <h5 style={styles.noReviewsTitle}>No Reviews Yet</h5>
                  <p style={styles.noReviewsText}>Be the first to review this product!</p>
                </div>
              ) : (
                <div style={styles.reviewsContainer}>
                  {product.reviews.map((review, index) => (
                    <div key={review._id} style={{
                      ...styles.reviewItem,
                      borderBottom: index < product.reviews.length - 1 ? '1px solid #e9ecef' : 'none',
                      marginBottom: index < product.reviews.length - 1 ? '20px' : '0'
                    }}>
                      <div style={styles.reviewHeader}>
                        <div>
                          <strong style={styles.reviewerName}>{review.name}</strong>
                          <div style={styles.reviewRating}>
                            <Rating value={review.rating} />
                          </div>
                        </div>
                        <span style={styles.reviewDate}>
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={styles.reviewComment}>{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Write Review */}
        <Col md={4}>
          <Card style={styles.card}>
            <Card.Body style={{ padding: '20px' }}>
              <h3 style={styles.writeReviewTitle}>Write a Review</h3>

              {loadingProductReview && <Loader />}

              {userInfo ? (
                <Form onSubmit={submitHandler}>
                  <Form.Group className='mb-3'>
                    <Form.Label style={styles.formLabel}>Rating</Form.Label>
                    <Form.Control
                      as='select'
                      required
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      style={styles.formControl}
                    >
                      <option value=''>Select...</option>
                      <option value='1'>⭐ 1 - Poor</option>
                      <option value='2'>⭐⭐ 2 - Fair</option>
                      <option value='3'>⭐⭐⭐ 3 - Good</option>
                      <option value='4'>⭐⭐⭐⭐ 4 - Very Good</option>
                      <option value='5'>⭐⭐⭐⭐⭐ 5 - Excellent</option>
                    </Form.Control>
                  </Form.Group>
                  
                  <Form.Group className='mb-3'>
                    <Form.Label style={styles.formLabel}>Review</Form.Label>
                    <Form.Control
                      as='textarea'
                      rows={4}
                      required
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      style={styles.textarea}
                      placeholder="Share your thoughts..."
                    />
                  </Form.Group>
                  
                  <Button
                    disabled={loadingProductReview}
                    type='submit'
                    style={styles.submitButton}
                  >
                    {loadingProductReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </Form>
              ) : (
                <div style={styles.signInPrompt}>
                  <h5 style={styles.signInTitle}>Sign in to review</h5>
                  <p style={styles.signInText}>Share your experience with this product</p>
                  <Link to='/login' style={styles.signInButton}>Sign In</Link>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
};

// All CSS Styles
const styles = {
  // Back Button
  backButton: {
    background: 'linear-gradient(45deg, #6c757d, #495057)',
    border: 'none',
    borderRadius: '25px',
    padding: '8px 20px',
    color: 'white',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  },

  // Image Styles
  imageContainer: {
    height: '500px',
    backgroundColor: '#f8f9fa',
    borderRadius: '15px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    border: '1px solid #e9ecef',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
  },

  // Card Styles
  card: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    background: '#ffffff',
  },

  // Product Info Styles
  title: {
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '20px',
    fontSize: '2.2rem',
    lineHeight: '1.2'
  },
  ratingSection: {
    marginBottom: '25px'
  },
  descriptionSection: {
    marginBottom: '30px'
  },
  sectionTitle: {
    color: '#495057',
    marginBottom: '15px',
    fontWeight: '600',
    fontSize: '1.3rem'
  },
  description: {
    color: '#6c757d',
    lineHeight: '1.8',
    fontSize: '1.1rem',
    marginBottom: '0'
  },
  infoLabel: {
    fontWeight: '600',
    color: '#495057'
  },
  infoValue: {
    color: '#6c757d'
  },

  // Horizontal Purchase Section
  purchaseSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
  },
  purchaseLeft: {
    flex: '0 0 auto'
  },
  finalPrice: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#28a745',
    marginBottom: '5px'
  },
  stockIndicator: {
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  purchaseCenter: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  quantityLabel: {
    fontWeight: '600',
    color: '#495057',
    marginBottom: '0',
    fontSize: '0.95rem'
  },
  quantitySelectHorizontal: {
    borderRadius: '8px',
    border: '1px solid #dee2e6',
    padding: '6px 10px',
    minWidth: '70px'
  },
  purchaseRight: {
    flex: '1'
  },
  addToCartButtonHorizontal: {
    background: 'linear-gradient(45deg, #007bff, #0056b3)',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 25px',
    fontWeight: '600',
    fontSize: '1.1rem',
    width: '100%'
  },

  // Recommendations Styles
  recommendationsTitle: {
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '10px',
    fontSize: '1.8rem'
  },
  recommendationsSubtitle: {
    color: '#6c757d',
    marginBottom: '25px',
    fontSize: '0.95rem'
  },

  // Reviews Styles
  reviewsTitle: {
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '20px'
  },
  noReviews: {
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    border: '1px dashed #dee2e6'
  },
  noReviewsTitle: {
    color: '#6c757d',
    marginBottom: '10px'
  },
  noReviewsText: {
    color: '#6c757d',
    margin: '0'
  },
  reviewsContainer: {
    maxHeight: '600px',
    overflowY: 'auto'
  },
  reviewItem: {
    paddingBottom: '20px'
  },
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px'
  },
  reviewerName: {
    color: '#2c3e50',
    fontSize: '1.1rem'
  },
  reviewRating: {
    margin: '5px 0'
  },
  reviewDate: {
    color: '#6c757d',
    fontSize: '0.9rem',
    backgroundColor: '#f8f9fa',
    padding: '4px 8px',
    borderRadius: '12px'
  },
  reviewComment: {
    color: '#495057',
    margin: '0',
    lineHeight: '1.6',
    fontSize: '0.95rem'
  },

  // Write Review Styles
  writeReviewTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '20px'
  },
  formLabel: {
    fontWeight: '600',
    color: '#495057'
  },
  formControl: {
    borderRadius: '8px',
    border: '1px solid #dee2e6'
  },
  textarea: {
    borderRadius: '8px',
    border: '1px solid #dee2e6',
    resize: 'vertical'
  },
  submitButton: {
    background: 'linear-gradient(45deg, #28a745, #20c997)',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontWeight: '600',
    width: '100%',
    fontSize: '1rem'
  },

  // Sign In Prompt Styles
  signInPrompt: {
    textAlign: 'center',
    padding: '30px 20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    border: '1px solid #dee2e6'
  },
  signInTitle: {
    color: '#495057',
    marginBottom: '15px'
  },
  signInText: {
    color: '#6c757d',
    marginBottom: '20px'
  },
  signInButton: {
    background: 'linear-gradient(45deg, #007bff, #0056b3)',
    color: 'white',
    textDecoration: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    display: 'inline-block'
  }
};

export default ProductScreen; 