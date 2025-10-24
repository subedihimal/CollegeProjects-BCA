import React, { useState } from 'react';
import { Row, Col, Badge } from 'react-bootstrap';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetProductRecommendationQuery } from '../slices/recommendApiSlice';
import { useGetProductsQuery } from '../slices/productsApiSlice';
import { selectCurrentUserId } from '../slices/authSlice';
import Product from '../components/Product';
import Loader from '../components/Loader';
import Message from '../components/Message';
import Paginate from '../components/Paginate';
import ProductCarousel from '../components/ProductCarousel';
import Meta from '../components/Meta';
import { selectViewedProducts } from '../slices/productViewsSlice';
import { FaInfoCircle, FaExclamation } from 'react-icons/fa';

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

// User Profile Carousel Component
const UserProfileCarousel = ({ show, onClose, userProfile }) => {
  if (!userProfile) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: animations }} />
      
      {/* Overlay Background */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: show ? 'rgba(0, 0, 0, 0.6)' : 'transparent',
          zIndex: 999,
          pointerEvents: show ? 'auto' : 'none',
          transition: 'background 0.4s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
      >
        {/* Profile Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 123, 255, 0.97) 0%, rgba(0, 86, 179, 0.97) 100%)',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            opacity: show ? 1 : 0,
            transform: show ? 'scale(1)' : 'scale(0.95)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: show ? 'slideDown 0.5s ease-out' : 'none'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              marginBottom: '8px', 
              textShadow: '0 2px 4px rgba(0,0,0,0.2)' 
            }}>
              Your Shopping Profile
            </div>
            <div style={{
              width: '60px',
              height: '3px',
              background: 'linear-gradient(90deg, transparent, white, transparent)',
              margin: '0 auto'
            }} />
          </div>

          {/* Categories Section */}
          {userProfile.categories?.length > 0 && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              animation: show ? 'slideIn 0.6s ease-out 0.1s both' : 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#90EE90',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px'
              }}>
                📱 Categories
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {userProfile.categories.map((cat, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      color: '#E0F7FF',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Brands Section */}
          {userProfile.brands?.length > 0 && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              animation: show ? 'slideIn 0.6s ease-out 0.2s both' : 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#90EE90',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px'
              }}>
                🏷️ Brands
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {userProfile.brands.map((brand, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      color: '#E0F7FF',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Price and Rating Stats */}
          {(userProfile.avgPrice != null || userProfile.avgRating != null) && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              animation: show ? 'slideIn 0.6s ease-out 0.3s both' : 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#90EE90',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px'
              }}>
                💰 Price and Rating
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px' }}>
                {userProfile.avgPrice != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>
                      Average Price
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFD700' }}>
                      ${userProfile.avgPrice.toFixed(2)}
                    </div>
                  </div>
                )}
                {userProfile.avgRating != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>
                      Average Rating
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFD700' }}>
                      {userProfile.avgRating.toFixed(1)}★
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Aggregated Features Section */}
          {userProfile.aggregatedFeatures && Object.keys(userProfile.aggregatedFeatures).length > 0 && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              animation: show ? 'slideIn 0.6s ease-out 0.4s both' : 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#90EE90',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px'
              }}>
                🔧 Description
              </div>
              
                {Object.entries(userProfile.aggregatedFeatures).map(([key, values], idx) => (
                  <div key={idx} style={{ marginBottom: '8px' }}>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: '#FFD700',
                      textTransform: 'capitalize' 
                    }}>
                      {key}:
                    </span>
                    <span style={{ marginLeft: '8px', color: '#E0F7FF' }}>
                      {values}
                    </span>
                  </div>
                ))}
            
            </div>
          )}

          {/* Total Interactions */}
          {userProfile.totalInteractions != null && (
            <div style={{
              textAlign: 'center',
              fontSize: '13px',
              opacity: 0.8,
              animation: show ? 'fadeIn 0.6s ease-out 0.5s both' : 'none'
            }}>
              Based on {userProfile.totalInteractions} product interaction{userProfile.totalInteractions !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Product Card with Explanation Overlay
const ProductCardWithOverlay = ({ product, showInCartFlag, isSearch, productRank }) => {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'visible' }}>
      <style dangerouslySetInnerHTML={{ __html: animations }} />
      
      <div onClick={() => showOverlay && setShowOverlay(false)} style={{ position: 'relative' }}>
        <Product product={product} showInCartFlag={showInCartFlag} />
        
        {/* Info Button - Only show for recommended products with explanation */}
        {!isSearch && product.scoringDetails && (
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
      {!isSearch && product.scoringDetails && (
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

// Main HomeScreen Component
const HomeScreen = () => {
  const { pageNumber, keyword } = useParams();
  const { cartItems } = useSelector((state) => state.cart);
  const userId = useSelector(selectCurrentUserId);
  const viewedProducts = useSelector(selectViewedProducts);
  const [showProfileCarousel, setShowProfileCarousel] = useState(false);

  // Fetch data based on search or recommendations
  const searched = useGetProductsQuery({ keyword, pageNumber });
  const recommended = useGetProductRecommendationQuery({
    pageNumber: pageNumber || 1,
    cartItems,
    userId,
    viewedProducts: Object.values(viewedProducts)
  });

  // Select correct data source
  const isSearch = Boolean(keyword);
  const { data, isLoading, error } = isSearch ? searched : recommended;

  return (
    <>
      {!keyword ? (
        <ProductCarousel />
      ) : (
        <Link to='/' className='btn btn-light mb-4'>
          Go Back
        </Link>
      )}

      {isLoading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>
          {error?.data?.message || error.error}
        </Message>
      ) : (
        <>
          <Meta />
          
          {/* Header with Profile Button */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <h1 className="mb-0">
                {isSearch ? 'Search Results' : 'Recommended Products'}
              </h1>
              
              {/* Profile Info Button - Only show for recommendations */}
              {!isSearch && data?.userProfile && (
                <button
                  onClick={() => setShowProfileCarousel(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    color: '#007bff',
                    padding: '0 8px',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#0056b3';
                    e.currentTarget.style.transform = 'scale(1.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#007bff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="View your profile used for recommendations"
                >
                  <FaExclamation />
                </button>
              )}
            </div>
            
            {/* Explore Mode Badge */}
            {!isSearch && data?.products?.[0]?.exploreMode && (
              <Badge bg="success" className="fs-6 px-3 py-2">
                🔍 Explore more to get recommendations
              </Badge>
            )}
          </div>
          
          {/* Products Grid */}
          <Row>
            {data?.products?.map((product, index) => (
              <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
                <ProductCardWithOverlay 
                  product={product} 
                  showInCartFlag={true}
                  isSearch={isSearch}
                  productRank={!isSearch && product.rank ? product.rank : null}
                />
              </Col>
            ))}
          </Row>
          
          {/* Pagination */}
          <Paginate
            pages={data?.pages}
            page={data?.page}
            keyword={keyword || ''}
          />

          {/* User Profile Carousel Modal */}
          <UserProfileCarousel
            show={showProfileCarousel}
            onClose={() => setShowProfileCarousel(false)}
            userProfile={data?.userProfile}
          />
        </>
      )}
    </>
  );
};

export default HomeScreen;