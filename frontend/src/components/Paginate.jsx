import { Pagination } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Paginate = ({ pages, page, isAdmin = false, keyword = '' }) => {
  console.log('Paginate props:', { pages, page, isAdmin, keyword });
  
  return (
    pages > 1 && (
      <Pagination>
        {[...Array(pages).keys()].map((x) => {
          const targetUrl = !isAdmin
            ? keyword
              ? `/search/${keyword}/page/${x + 1}`
              : `/page/${x + 1}`
            : `/admin/productlist/page/${x + 1}`;
          
          console.log(`Generating URL for page ${x + 1}:`, targetUrl);
          
          return (
            <Pagination.Item 
              key={x + 1} 
              active={x + 1 === page}
              // Remove the as={Link} - this might be causing issues
            >
              <Link 
                to={targetUrl}
                
  style={{ 
    textDecoration: 'none', 
    color: 'inherit',
    padding: '0.75rem 1rem', // Bigger clickable area
    display: 'inline-block'
  }}
            
                onClick={() => console.log('React Router Link clicked:', targetUrl)}
              >
                {x + 1}
              </Link>
            </Pagination.Item>
          );
        })}
      </Pagination>
    )
  );
};

export default Paginate;
