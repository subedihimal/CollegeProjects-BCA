import { Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectProductViewCount } from '../slices/productViewsSlice';
import Rating from './Rating';

const Product = ({ product, showInCartFlag = false }) => {
  const viewCount = useSelector(selectProductViewCount(product._id));

  const cardStyle = {
    transition: 'all 0.3s ease',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    cursor: 'pointer',
  };

  const imageContainerStyle = {
    height: '250px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
  };

  const imageStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    transition: 'transform 0.2s ease',
  };

  const priceStyle = {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#2c3e50',
    margin: '10px 0 0 0'
  };

  return (
    <div className="position-relative">
      <Card 
        className='my-3 p-3' 
        style={cardStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        }}
      >
        <Link to={`/product/${product._id}`}>
          <div style={imageContainerStyle}>
            <Card.Img 
              src={product.image} 
              alt={product.name}
              style={imageStyle}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            />
          </div>
        </Link>

        <Card.Body>
          <Link to={`/product/${product._id}`}>
            <Card.Title as='div' className='product-title'>
              <strong>{product.name}</strong>
            </Card.Title>
          </Link>

          <Card.Text as='div'>
            <Rating
              value={product.rating}
              text={`${product.numReviews} reviews`}
            />
          </Card.Text>
          
          {/* In Cart badge - top right */}
          {showInCartFlag && product.inCart && (
            <div className="position-absolute top-0 end-0 m-2">
              <Badge bg="success">In Cart</Badge>
            </div>
          )}

          {/* Previously Purchased badge - top left */}
          {showInCartFlag && product.previouslyPurchased && (
            <div className="position-absolute top-0 start-0 m-2">
              <Badge bg="danger">Purchase Again</Badge>
            </div>
          )}

          <Card.Text as='h3' style={priceStyle}> ₹ {product.price}</Card.Text>
        </Card.Body>
      </Card>

      {/* View count badge */}
      {viewCount > 0 && (
        <div 
          className="position-absolute" 
          style={{ 
            bottom: '15px', 
            left: '15px',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          <Badge bg="dark" className="small">
            Views: {viewCount}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default Product;