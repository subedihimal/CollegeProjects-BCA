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
              style={{ 
                padding: '0',     // Remove all padding
                margin: '0',      // Remove margin
                border: 'none'    // Remove border conflicts
              }}
            >
              <Link 
                to={targetUrl}
                
              style={{ 
                textDecoration: 'none', 
                color: 'inherit',
                display: 'block',
                width: '100%',
                height: '100%',
                padding: '0.5rem 0.75rem',
                textAlign: 'center',
                position: 'relative',  // This helps cover everything
                zIndex: '1'    
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
