import { Row, Col } from 'react-bootstrap';
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

const HomeScreen = () => {
  const { pageNumber, keyword } = useParams();
  const { cartItems } = useSelector((state) => state.cart);
    const userId = useSelector(selectCurrentUserId);

  // Call both hooks unconditionally
  const searched = useGetProductsQuery({ keyword, pageNumber });
  const recommended = useGetProductRecommendationQuery({
    keyword,
    pageNumber,
    cartItems,
    userId
  });

  // Select correct hook result
  const isSearch = Boolean(keyword);
  const data = isSearch ? searched.data : recommended.data;
  const isLoading = isSearch ? searched.isLoading : recommended.isLoading;
  const error = isSearch ? searched.error : recommended.error;

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
          <h1>{isSearch ? 'Search Results' : 'Recommended Products'}</h1>
          <Row>
            {data?.products?.map((product) => (
              <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
                <Product product={product} showInCartFlag = {true} />
              </Col>
            ))}
          </Row>
          <Paginate
            pages={data?.pages}
            page={data?.page}
            keyword={keyword ? keyword : ''}
          />
        </>
      )}
    </>
  );
};

export default HomeScreen;
