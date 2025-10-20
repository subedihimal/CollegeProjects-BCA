import React, { useState } from 'react';
import { Row, Col, Badge, Card } from 'react-bootstrap';
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

const UserProfileCarousel = ({ show, onClose, userProfile }) => {
  if (!userProfile) return null;

  return (
    <>
      {/* Carousel Overlay */}
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
        {/* Carousel Container */}
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
          {/* Header with pulse animation */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '30px',
            animation: show ? 'slideDown 0.5s ease-out' : 'none'
          }}>
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

          {/* Categories Section with slide-in animation */}
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
              📱 Preferred Categories
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {userProfile.categories?.map((cat, idx) => (
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

          {/* Brands Section with slide-in animation */}
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
              🏷️ Favorite Brands
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {userProfile.brands?.map((brand, idx) => (
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

          {/* Price Range with slide-in animation */}
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
              💰 Price Range
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>Min</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  ${userProfile.priceRange?.min?.toFixed(2)}
                </div>
              </div>
              <div style={{
                width: '2px',
                background: 'rgba(255, 255, 255, 0.3)'
              }} />
              <div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>Max</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  ${userProfile.priceRange?.max?.toFixed(2)}
                </div>
              </div>
              <div style={{
                width: '2px',
                background: 'rgba(255, 255, 255, 0.3)'
              }} />
              <div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>Average</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  ${userProfile.avgPrice?.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Stats with slide-in animation */}
          <div style={{ 
            marginBottom: '24px',
            animation: show ? 'slideIn 0.6s ease-out 0.4s both' : 'none'
          }}>
            <div style={{ 
              fontSize: '13px', 
              fontWeight: 'bold',
              color: '#90EE90',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '12px'
            }}>
              📊 Activity Stats
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {userProfile.viewedProductsCount || 0}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Viewed Products</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {userProfile.purchaseHistoryCount || 0}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Purchased Items</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {userProfile.cartItemsCount || 0}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Items in Cart</div>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {userProfile.totalItems || 0}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Total Items</div>
              </div>
            </div>
          </div>

          {/* Common Features with slide-in animation */}
          {userProfile.commonFeatures && Object.keys(userProfile.commonFeatures).length > 0 && (
            <div style={{ 
              marginBottom: '24px',
              padding: '16px', 
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              animation: show ? 'slideIn 0.6s ease-out 0.5s both' : 'none',
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
                ⚙️ Common Features
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {Object.entries(userProfile.commonFeatures).map(([key, value]) => {
                  // Handle both array and single value
                  const displayValue = Array.isArray(value) ? value.join(', ') : value;
                  
                  return (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        gap: '12px',
                        alignItems: 'flex-start'
                      }}
                    >
                      <span style={{ fontWeight: '600', minWidth: 'fit-content' }}>{key}:</span>
                      <span style={{ 
                        color: '#90EE90', 
                        fontWeight: '700',
                        textAlign: 'right',
                        flex: 1
                      }}>
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Keyframes for animations */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideDown {
              from {
                opacity: 0;
                transform: translateY(-20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(-20px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
          `}} />
        </div>
      </div>
    </>
  );
};

const ProductCardWithOverlay = ({ product, showInCartFlag, isSearch, productRank }) => {
  const [showOverlay, setShowOverlay] = useState(false);
  // Interpret interaction weight coming from backend (stored as percentage, e.g., 120 for x1.20)
  const interactionPct = product?.scoringDetails?.interactionWeight ?? 100; // default neutral 100
  const interactionMultiplier = (interactionPct / 100).toFixed(2);
  const interactionBoostPercent = Math.round(interactionPct - 100); // 0 means no boost, positive means boost

  return (
    <div 
      style={{ 
        position: 'relative',
        height: '100%',
        overflow: 'visible'
      }}
    >
      <div 
        onClick={() => showOverlay && setShowOverlay(false)}
        style={{ position: 'relative' }}
      >
        <Product product={product} showInCartFlag={showInCartFlag} />
        
        {/* Info Button inside Product wrapper */}
        {!isSearch && product.explanation && (
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
      
      {!isSearch && product.explanation && (
        <>
          {/* Overlay */}
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
            {/* Header with pulse animation */}
            <div style={{ 
              textAlign: 'center', 
              marginBottom: '16px',
              animation: showOverlay ? 'slideDown 0.5s ease-out' : 'none'
            }}>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
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
              <div style={{
                width: '60px',
                height: '3px',
                background: 'linear-gradient(90deg, transparent, white, transparent)',
                margin: '0 auto'
              }} />
            </div>

            {/* Primary Reason with slide-in animation */}
            <div style={{ 
              marginBottom: '14px', 
              padding: '12px', 
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              animation: showOverlay ? 'slideIn 0.6s ease-out 0.1s both' : 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 'bold', 
                color: '#90EE90',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '6px'
              }}>
                Primary Reason
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                {product.explanation.primary.label}
              </div>
            </div>

            {/* Secondary Reasons with staggered animation */}
            {product.explanation.secondary && product.explanation.secondary.length > 0 && (
              <div style={{ 
                marginBottom: '14px',
                animation: showOverlay ? 'slideIn 0.6s ease-out 0.2s both' : 'none'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '8px',
                  opacity: 0.9
                }}>
                  Additional Reasons
                </div>
                {product.explanation.secondary.slice(0, 2).map((reason, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      fontSize: '12px', 
                      marginBottom: '4px',
                      paddingLeft: '12px',
                      position: 'relative',
                      lineHeight: '1.4'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      left: 0,
                      color: '#90EE90'
                    }}>•</span>
                    {reason.label}
                  </div>
                ))}
              </div>
            )}

            {/* Confidence Score with progress bar */}
            <div style={{ 
              marginBottom: '14px',
              animation: showOverlay ? 'slideIn 0.6s ease-out 0.3s both' : 'none'
            }}>
              <div style={{ 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Confidence Score</span>
                <span style={{ fontSize: '14px' }}>{product.explanation.confidenceScore}%</span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${product.explanation.confidenceScore}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #90EE90, #00FF7F)',
                  borderRadius: '3px',
                  transition: 'width 1s ease-out 0.5s',
                  boxShadow: '0 0 10px rgba(144, 238, 144, 0.5)'
                }} />
              </div>
            </div>

            {/* Similarity Breakdown */}
            {product.scoringDetails && (
              <div style={{ 
                marginBottom: '12px',
                animation: showOverlay ? 'slideIn 0.6s ease-out 0.4s both' : 'none'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '8px',
                  opacity: 0.9
                }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Interaction Boost:</span>
                    <span style={{ fontWeight: 'bold', color: '#90EE90' }}>
                      x{interactionMultiplier} ({interactionBoostPercent >= 0 ? '+' : ''}{interactionBoostPercent}%)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                    <span style={{ fontWeight: 'bold' }}>Overall Similarity:</span>
                    <span style={{ fontWeight: 'bold', color: '#00FF7F' }}>{(product.similarity * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Breakdown */}
            {product.scoringDetails?.breakdown && (
              <div style={{ 
                marginBottom: '12px',
                animation: showOverlay ? 'slideIn 0.6s ease-out 0.45s both' : 'none'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '8px',
                  opacity: 0.9
                }}>
                  Match Details
                </div>
                
                {/* Traditional Matching */}
                {product.scoringDetails.breakdown.traditional && (
                  <div style={{ 
                    marginBottom: '10px',
                    padding: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#FFD700' }}>
                      Traditional Matching ({product.scoringDetails.traditionalSimilarity}%)
                    </div>
                    {product.scoringDetails.breakdown.traditional.categoryMatch && (
                      <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                        <div style={{ fontWeight: '600', color: '#90EE90' }}>
                          ✓ Category Match ({product.scoringDetails.breakdown.traditional.categoryContribution}% contribution)
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                          Matched: {product.scoringDetails.breakdown.traditional.matchedCategories?.join(', ')}
                        </div>
                      </div>
                    )}
                    {product.scoringDetails.breakdown.traditional.brandMatch && (
                      <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                        <div style={{ fontWeight: '600', color: '#90EE90' }}>
                          ✓ Brand Match ({product.scoringDetails.breakdown.traditional.brandContribution}% contribution)
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                          Matched: {product.scoringDetails.breakdown.traditional.matchedBrands?.join(', ')}
                        </div>
                      </div>
                    )}
                    {product.scoringDetails.breakdown.traditional.priceRange && (
                      <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                        <div style={{ fontWeight: '600', color: '#90EE90' }}>
                          {product.scoringDetails.breakdown.traditional.priceRange.inRange ? '✓' : '○'} Price Match ({product.scoringDetails.breakdown.traditional.priceContribution}% contribution)
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                          Product: ${product.scoringDetails.breakdown.traditional.priceRange.productPrice} | 
                          Your range: ${product.scoringDetails.breakdown.traditional.priceRange.userMin} - ${product.scoringDetails.breakdown.traditional.priceRange.userMax}
                          {product.scoringDetails.breakdown.traditional.priceRange.percentageDifference !== undefined && (
                            <span> ({product.scoringDetails.breakdown.traditional.priceRange.percentageDifference >= 0 ? '+' : ''}{product.scoringDetails.breakdown.traditional.priceRange.percentageDifference}% vs avg)</span>
                          )}
                        </div>
                      </div>
                    )}
                    {product.scoringDetails.breakdown.traditional.ratingRange && (
                      <div style={{ marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                        <div style={{ fontWeight: '600', color: '#90EE90' }}>
                          ✓ Rating Match ({product.scoringDetails.breakdown.traditional.ratingContribution}% contribution)
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                          Product: {product.scoringDetails.breakdown.traditional.ratingRange.productRating}★ | 
                          Your avg: {product.scoringDetails.breakdown.traditional.ratingRange.userAverage}★
                          {product.scoringDetails.breakdown.traditional.ratingRange.difference !== undefined && (
                            <span> ({product.scoringDetails.breakdown.traditional.ratingRange.difference >= 0 ? '+' : ''}{product.scoringDetails.breakdown.traditional.ratingRange.difference}★ diff)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Feature Matching */}
                {product.scoringDetails.breakdown.features && product.scoringDetails.breakdown.features.length > 0 && (
                  <div style={{ 
                    marginBottom: '10px',
                    padding: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#FFD700' }}>
                      Feature Matches ({product.scoringDetails.descriptionSimilarity}%)
                    </div>
                    {product.scoringDetails.breakdown.features.map((feature, idx) => (
                      <div key={idx} style={{ marginBottom: '3px', paddingLeft: '8px', borderLeft: '2px solid #90EE90' }}>
                        <span style={{ fontWeight: '600', color: '#90EE90' }}>✓ {feature.attribute}:</span> {feature.productValue}
                      </div>
                    ))}
                  </div>
                )}

                {/* Interaction Boost Details */}
                {(product.inCart || product.previouslyPurchased || product.viewCount > 0 || (product.scoringDetails && product.scoringDetails.interactionWeight && product.scoringDetails.interactionWeight !== 100)) && (
                  <div style={{ 
                    marginBottom: '10px',
                    padding: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#FFD700' }}>
                      User Interaction (x{interactionMultiplier} / {interactionBoostPercent >= 0 ? '+' : ''}{interactionBoostPercent}%)
                    </div>
                    {product.inCart && (
                      <div style={{ marginBottom: '3px', color: '#90EE90' }}>
                        ✓ Currently in your cart (100% weight)
                      </div>
                    )}
                    {product.previouslyPurchased && (
                      <div style={{ marginBottom: '3px', color: '#90EE90' }}>
                        ✓ Previously purchased
                      </div>
                    )}
                    {product.viewCount > 0 && (
                      <div style={{ marginBottom: '3px', color: '#90EE90' }}>
                        ✓ Viewed {product.viewCount} time{product.viewCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* All Reasons */}
            {product.explanation?.allReasons && product.explanation.allReasons.length > 0 && (
              <div style={{ 
                marginBottom: '12px',
                animation: showOverlay ? 'slideIn 0.6s ease-out 0.5s both' : 'none'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '8px',
                  opacity: 0.9
                }}>
                  All Ranking Factors
                </div>
                {product.explanation.allReasons.map((reason, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      marginBottom: '8px',
                      padding: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      fontSize: '11px'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontWeight: 'bold', color: '#90EE90' }}>
                        {reason.label}
                      </span>
                      <span style={{ 
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: reason.strength === 'high' || reason.strength === 'very_high' ? '#4CAF50' : reason.strength === 'medium' ? '#FF9800' : '#9E9E9E',
                        borderRadius: '8px'
                      }}>
                        {reason.strength}
                      </span>
                    </div>
                    {reason.details && reason.details.length > 0 && (
                      <div style={{ fontSize: '10px', opacity: 0.9 }}>
                        {reason.details.join(', ')}
                      </div>
                    )}
                    {reason.contributions && reason.contributions.length > 0 && (
                      <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '4px' }}>
                        {reason.contributions.join(' | ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Status Badges with pop animation */}
            <div style={{ 
              display: 'flex', 
              gap: '6px', 
              flexWrap: 'wrap',
              animation: showOverlay ? 'fadeIn 0.6s ease-out 0.5s both' : 'none'
            }}>
              {product.inCart && (
                <span style={{ 
                  fontSize: '10px', 
                  padding: '4px 10px', 
                  background: 'linear-gradient(135deg, #2196F3, #1976D2)',
                  borderRadius: '12px',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.4)'
                }}>
                  In Cart
                </span>
              )}
              {product.previouslyPurchased && (
                <span style={{ 
                  fontSize: '10px', 
                  padding: '4px 10px', 
                  background: 'linear-gradient(135deg, #FF9800, #F57C00)',
                  borderRadius: '12px',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(255, 152, 0, 0.4)'
                }}>
                  Purchased Before
                </span>
              )}
              {product.viewCount > 0 && (
                <span style={{ 
                  fontSize: '10px', 
                  padding: '4px 10px', 
                  background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                  borderRadius: '12px',
                  fontWeight: '600',
                  boxShadow: '0 2px 8px rgba(156, 39, 176, 0.4)'
                }}>
                  Viewed {product.viewCount}×
                </span>
              )}
            </div>

            {/* Keyframes for animations */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes slideDown {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateX(-20px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              @keyframes fadeIn {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }
            `}} />
          </div>
        </>
      )}
    </div>
  );
};

const HomeScreen = () => {
  const { pageNumber, keyword } = useParams();
  const { cartItems } = useSelector((state) => state.cart);
  const userId = useSelector(selectCurrentUserId);
  const viewedProducts = useSelector(selectViewedProducts);
  const viewedProductsArray = Object.values(viewedProducts);

  const searched = useGetProductsQuery({ keyword, pageNumber });

  const recommended = useGetProductRecommendationQuery({
    pageNumber,
    cartItems,
    userId,
    viewedProducts: viewedProductsArray
  });

  // Select correct hook result
  const isSearch = Boolean(keyword);
  const data = isSearch ? searched.data : recommended.data;
  const isLoading = isSearch ? searched.isLoading : recommended.isLoading;
  const error = isSearch ? searched.error : recommended.error;

  // User Profile Carousel state
  const [showProfileCarousel, setShowProfileCarousel] = useState(false);

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
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <h1 className="mb-0">
                {isSearch ? 'Search Results' : 'Recommended Products'}
              </h1>
              
              {/* Profile Info Button - Only show for recommendations */}
              {!isSearch && (
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
            
            {!isSearch && data?.isExploreMode && (
              <Badge bg="success" className="fs-6 px-3 py-2">
                🔍 Explore more to get recommendations
              </Badge>
            )}
          </div>
          
          <Row>
            {data?.products?.map((product, index) => (
              <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
                <ProductCardWithOverlay 
                  product={product} 
                  showInCartFlag={true}
                  isSearch={isSearch}
                  productRank={!isSearch ? ((data?.page - 1) * 8) + index + 1 : null}
                />
              </Col>
            ))}
          </Row>
          <Paginate
            pages={data?.pages}
            page={data?.page}
            keyword={keyword ? keyword : ''}
          />

          {/* User Profile Carousel - Fullscreen overlay display */}
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