import { Card, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectProductViewCount } from '../slices/productViewsSlice';
import Rating from './Rating';

const Product = ({ product, showInCartFlag = false }) => {
  const viewCount = useSelector(selectProductViewCount(product._id));

  return (
    <div className="position-relative">
      <Card className='my-3 p-3 rounded'>
        <Link to={`/product/${product._id}`}>
          <Card.Img src={product.image} variant='top' />
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

          <Card.Text as='h3'>${product.price}</Card.Text>
        </Card.Body>
      </Card>

      {/* View count badge - positioned outside the card to not affect height */}
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