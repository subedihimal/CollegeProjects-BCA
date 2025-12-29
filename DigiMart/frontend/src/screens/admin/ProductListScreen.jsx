import { Table, Button, Row, Col, Card, Badge } from 'react-bootstrap';
import { FaEdit, FaPlus, FaTrash, FaBox, FaDollarSign } from 'react-icons/fa';
import { Link, useParams } from 'react-router-dom';
import Message from '../../components/Message';
import Loader from '../../components/Loader';
import Paginate from '../../components/Paginate';
import {
  useGetProductsQuery,
  useDeleteProductMutation,
  useCreateProductMutation,
} from '../../slices/productsApiSlice';
import { toast } from 'react-toastify';

const ProductListScreen = () => {
  const { pageNumber } = useParams()
  const currentPage = Number(pageNumber) || 1;
  const { data, isLoading, error, refetch } = useGetProductsQuery({
    pageNumber: currentPage,
  });

  const [deleteProduct, { isLoading: loadingDelete }] =
    useDeleteProductMutation();

  const deleteHandler = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        refetch();
        toast.success('Product deleted successfully');
      } catch (err) {
        toast.error(err?.data?.message || err.error);
      }
    }
  };

  const [createProduct, { isLoading: loadingCreate }] =
    useCreateProductMutation();

  const createProductHandler = async () => {
    if (window.confirm('Are you sure you want to create a new product?')) {
      try {
        await createProduct();
        refetch();
        toast.success('Product created successfully');
      } catch (err) {
        toast.error(err?.data?.message || err.error);
      }
    }
  };

  // Style objects
  const headerCardStyle = {
    background: 'linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%)',
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  };

  const tableCardStyle = {
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  };

  const tableStyle = {
    marginBottom: 0,
    borderCollapse: 'separate',
    borderSpacing: 0,
  };

  const createButtonStyle = {
    background: 'linear-gradient(45deg, #28a745, #20c997)',
    border: 'none',
    borderRadius: '20px',
    padding: '10px 20px',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(40, 167, 69, 0.2)',
    transition: 'all 0.3s ease',
  };

  const editButtonStyle = {
    background: 'linear-gradient(45deg, #17a2b8, #138496)',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    transition: 'all 0.2s ease',
  };

  const deleteButtonStyle = {
    background: 'linear-gradient(45deg, #dc3545, #c82333)',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    transition: 'all 0.2s ease',
  };

  return (
    <>
      {/* Header Section */}
      <Card style={headerCardStyle} className="mb-4">
        <Card.Body>
          <Row className='align-items-center py-2'>
            <Col>
              <div className="d-flex align-items-center">
                <FaBox className="me-3" style={{ fontSize: '2rem', color: 'white' }} />
                <div>
                  <h1 className="mb-1" style={{ color: 'white', fontWeight: '700', fontSize: '2.5rem' }}>
                    Products Management
                  </h1>
                  <p className="mb-0" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem' }}>
                    Manage your product catalog
                  </p>
                </div>
              </div>
            </Col>
            <Col className='text-end'>
                              <Button 
                style={createButtonStyle}
                onClick={createProductHandler}
              >
                <FaPlus className="me-2" /> Create Product
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {loadingCreate && <Loader />}
      {loadingDelete && <Loader />}
      
      {isLoading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error.data.message}</Message>
      ) : (
        <>
          {/* Products Table */}
          <Card style={tableCardStyle}>
            <Table hover responsive style={tableStyle}>
              <thead style={{ backgroundColor: '#f8f9fa' }}>
                <tr>
                  <th style={{ 
                    padding: '20px 16px', 
                    fontWeight: '600', 
                    color: '#495057', 
                    borderBottom: '2px solid #dee2e6',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Product ID
                  </th>
                  <th style={{ 
                    padding: '20px 16px', 
                    fontWeight: '600', 
                    color: '#495057', 
                    borderBottom: '2px solid #dee2e6',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Name
                  </th>
                  <th style={{ 
                    padding: '20px 16px', 
                    fontWeight: '600', 
                    color: '#495057', 
                    borderBottom: '2px solid #dee2e6',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textAlign: 'center'
                  }}>
                    ₹ Price
                  </th>
                  <th style={{ 
                    padding: '20px 16px', 
                    fontWeight: '600', 
                    color: '#495057', 
                    borderBottom: '2px solid #dee2e6',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textAlign: 'center'
                  }}>
                    Category
                  </th>
                  <th style={{ 
                    padding: '20px 16px', 
                    fontWeight: '600', 
                    color: '#575549ff', 
                    borderBottom: '2px solid #dee2e6',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textAlign: 'center'
                  }}>
                    Brand
                  </th>
                  <th style={{ 
                    padding: '20px 16px', 
                    fontWeight: '600', 
                    color: '#495057', 
                    borderBottom: '2px solid #dee2e6',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textAlign: 'center'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((product, index) => (
                  <tr 
                    key={product._id}
                    style={{ 
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc',
                    }}
                  >
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <code style={{ 
                        backgroundColor: '#e9ecef', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#574949ff'
                      }}>
                        {(product._id)}
                      </code>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: '600', color: '#212529', fontSize: '1rem' }}>
                        {product.name}
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: '700', 
                        fontSize: '1.1rem', 
                        color: '#28a745',
                        background: 'linear-gradient(45deg, #d4edda, #c3e6cb)',
                        padding: '6px 12px',
                        borderRadius: '15px',
                        display: 'inline-block'
                      }}>
                        ₹{product.price}
                      </span>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <Badge 
                        style={{ 
                          fontSize: '0.8rem',
                          padding: '8px 12px',
                          borderRadius: '12px'
                        }}
                      >
                        {product.category}
                      </Badge>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <Badge 
                        style={{ 
                          fontSize: '0.8rem',
                          padding: '8px 12px',
                          borderRadius: '12px',
                          border: 'none'
                        }}
                      >
                        {product.brand}
                      </Badge>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <div className="d-flex justify-content-center gap-2">
                        <Button
                          as={Link}
                          to={`/admin/product/${product._id}/edit`}
                          size="sm"
                          style={editButtonStyle}
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          size="sm"
                          style={deleteButtonStyle}
                          onClick={() => deleteHandler(product._id)}
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          
          {/* Pagination */}
          <div className="mt-4">
            <Paginate pages={data.pages} page={currentPage} isAdmin={true} />
          </div>
        </>
      )}
    </>
  );
};

export default ProductListScreen;