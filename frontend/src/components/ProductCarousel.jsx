import { Link } from 'react-router-dom';
import { Carousel, Image } from 'react-bootstrap';
import Message from './Message';
import { useGetTopProductsQuery } from '../slices/productsApiSlice';

const ProductCarousel = () => {
  const { data: products, isLoading, error } = useGetTopProductsQuery();

  if (isLoading) return null;
  
  if (error) {
    return <Message variant='danger'>{error?.data?.message || error.error}</Message>;
  }

  const containerStyle = {
    position: 'relative',
    height: '400px',
    background: 'linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    padding: '40px',
    gap: '40px',
  };

  const imageContainerStyle = {
    width: '300px',
    height: '240px',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  };

  const imageStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'contain',
    transition: 'transform 0.3s ease',
  };

  const textContainerStyle = {
    flex: '1',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '20px',
  };

  const titleStyle = {
    fontSize: '2.2rem',
    fontWeight: '600',
    margin: '0',
    color: '#ffffff',
    lineHeight: '1.3',
  };

  const priceStyle = {
    display: 'inline-block',
    backgroundColor: '#ffd700',
    color: '#1a1a1a',
    padding: '10px 20px',
    borderRadius: '20px',
    fontSize: '1.6rem',
    fontWeight: '700',
    alignSelf: 'flex-start',
    boxShadow: '0 3px 12px rgba(255,215,0,0.3)',
  };

  return (
    <Carousel pause='hover' className='mb-4'>
      {products.map((product) => (
        <Carousel.Item key={product._id}>
          <Link to={`/product/${product._id}`} style={{ textDecoration: 'none' }}>
            <div style={containerStyle}>
              {/* Image Section */}
              <div style={imageContainerStyle}>
                <Image 
                  src={product.image} 
                  alt={product.name} 
                  style={imageStyle}
                  onMouseOver={(e) => e.target.style.transform = 'scale(1.03)'}
                  onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                />
              </div>

              {/* Text Section */}
              <div style={textContainerStyle}>
                <h2 style={titleStyle}>
                  {product.name}
                </h2>
                <div style={priceStyle}>
                   ₹ {product.price}
                </div>
              </div>
            </div>
          </Link>
        </Carousel.Item>
      ))}
    </Carousel>
  );
};

export default ProductCarousel;