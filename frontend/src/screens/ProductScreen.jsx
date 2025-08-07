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
import Rating from '../components/Rating';
import Loader from '../components/Loader';
import Message from '../components/Message';
import Meta from '../components/Meta';
import { addToCart } from '../slices/cartSlice';
import { trackProductView } from '../slices/productViewsSlice';

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
  purchaseCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    background: '#ffffff',
    position: 'sticky',
    top: '20px',
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
  priceSection: {
    marginBottom: '30px'
  },
  price: {
    fontSize: '2.2rem',
    fontWeight: '700',
    color: '#28a745',
    background: 'linear-gradient(45deg, #d4edda, #c3e6cb)',
    padding: '12px 24px',
    borderRadius: '15px',
    display: 'inline-block',
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
  productInfoGrid: {
    display: 'flex',
    gap: '40px',
    marginBottom: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #e9ecef'
  },
  infoColumn: {
    flex: '1'
  },
  infoColumnTitle: {
    color: '#2c3e50',
    marginBottom: '15px',
    fontWeight: '600',
    fontSize: '1.1rem'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #f8f9fa'
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

  // Purchase Card Styles (Legacy - kept for compatibility)
  purchaseCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    background: '#ffffff',
    position: 'sticky',
    top: '20px',
  },
  purchaseTitle: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '20px',
    textAlign: 'center'
  },
  purchasePriceSection: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  purchasePrice: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#28a745'
  },
  stockStatus: {
    fontSize: '0.9rem',
    fontWeight: '600',
    marginTop: '5px'
  },
  quantitySection: {
    marginBottom: '20px'
  },
  quantityLabel: {
    fontWeight: '600',
    color: '#495057',
    marginBottom: '8px',
    fontSize: '0.95rem'
  },
  quantitySelect: {
    borderRadius: '8px',
    border: '1px solid #dee2e6'
  },
  addToCartButton: {
    background: 'linear-gradient(45deg, #007bff, #0056b3)',
    border: 'none',
    borderRadius: '12px',
    padding: '12px',
    fontWeight: '600',
    fontSize: '1.1rem',
    width: '100%',
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