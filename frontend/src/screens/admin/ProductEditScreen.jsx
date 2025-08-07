import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Form, Button, Card, Row, Col } from 'react-bootstrap';
import Message from '../../components/Message';
import Loader from '../../components/Loader';
import { toast } from 'react-toastify';
import {
  useGetProductDetailsQuery,
  useUpdateProductMutation,
  useUploadProductImageMutation,
} from '../../slices/productsApiSlice';

const ProductEditScreen = () => {
  const { id: productId } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [countInStock, setCountInStock] = useState(0);
  const [description, setDescription] = useState('');

  const { data: product, isLoading, error } = useGetProductDetailsQuery(productId);
  const [updateProduct, { isLoading: loadingUpdate }] = useUpdateProductMutation();
  const [uploadProductImage, { isLoading: loadingUpload }] = useUploadProductImageMutation();

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price);
      setImage(product.image);
      setBrand(product.brand);
      setCategory(product.category);
      setCountInStock(product.countInStock);
      setDescription(product.description);
    }
  }, [product]);

  const submitHandler = async (e) => {
    e.preventDefault();
    try {
      await updateProduct({
        productId,
        name,
        price,
        image,
        brand,
        category,
        description,
        countInStock,
      }).unwrap();
      toast.success('Product updated successfully');
      navigate('/admin/productlist');
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  const uploadFileHandler = async (e) => {
    const formData = new FormData();
    formData.append('image', e.target.files[0]);
    try {
      const res = await uploadProductImage(formData).unwrap();
      toast.success('Image uploaded successfully');
      setImage(res.image);
    } catch (err) {
      toast.error(err?.data?.message || err.error);
    }
  };

  if (isLoading) return <Loader />;
  if (error) return <Message variant='danger'>{error?.data?.message || error.error}</Message>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Body>
          <Link to='/admin/productlist' style={styles.backButton}>
            ← Go Back
          </Link>
          <h1 style={styles.title}>Edit Product</h1>
          <p style={styles.subtitle}>Update product information</p>
        </Card.Body>
      </Card>

      {loadingUpdate && <Loader />}

      {/* Form */}
      <Card style={styles.formCard} className="mt-4">
        <Card.Body style={styles.formBody}>
          <Form onSubmit={submitHandler}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>Product Name</Form.Label>
                  <Form.Control
                    type='text'
                    placeholder='Enter product name'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.input}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>Price (₹)</Form.Label>
                  <Form.Control
                    type='number'
                    step='0.01'
                    placeholder='Enter price'
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    style={styles.input}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>Brand</Form.Label>
                  <Form.Control
                    type='text'
                    placeholder='Enter brand'
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    style={styles.input}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>Category</Form.Label>
                  <Form.Control
                    type='text'
                    placeholder='Enter category'
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={styles.input}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>Stock Quantity</Form.Label>
                  <Form.Control
                    type='number'
                    placeholder='Enter stock count'
                    value={countInStock}
                    onChange={(e) => setCountInStock(e.target.value)}
                    style={styles.input}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>Image URL</Form.Label>
                  <Form.Control
                    type='text'
                    placeholder='Enter image URL'
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    style={styles.input}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label style={styles.label}>Upload Image</Form.Label>
                  <Form.Control
                    type='file'
                    accept='image/*'
                    onChange={uploadFileHandler}
                    style={styles.fileInput}
                  />
                  {loadingUpload && <Loader />}
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group className="mb-4">
                  <Form.Label style={styles.label}>Description</Form.Label>
                  <Form.Control
                    as='textarea'
                    rows={4}
                    placeholder='Enter product description'
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={styles.textarea}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Button
                  type='submit'
                  disabled={loadingUpdate}
                  style={styles.submitButton}
                >
                  {loadingUpdate ? 'Updating...' : 'Update Product'}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px'
  },

  // Header Styles
  headerCard: {
    background: 'linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%)',
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    color: 'white'
  },
  backButton: {
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    marginBottom: '10px',
    display: 'block'
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: 'white'
  },
  subtitle: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.7)',
    margin: '0'
  },

  // Form Styles
  formCard: {
    border: 'none',
    borderRadius: '15px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  formBody: {
    padding: '30px'
  },
  label: {
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '8px',
    fontSize: '0.95rem'
  },
  input: {
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '0.95rem',
    transition: 'border-color 0.2s ease'
  },
  textarea: {
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '0.95rem',
    resize: 'vertical',
    transition: 'border-color 0.2s ease'
  },
  fileInput: {
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '0.95rem'
  },
  submitButton: {
    background: 'linear-gradient(45deg, #28a745, #20c997)',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 30px',
    fontSize: '1.1rem',
    fontWeight: '600',
    width: '100%'
  }
};

export default ProductEditScreen;