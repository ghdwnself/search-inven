import { useState, useEffect } from 'react';
import axios from 'axios';
import ProductCard from './ProductCard';

function SearchView() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // 브랜드 목록 로드
  useEffect(() => {
    async function fetchBrands() {
      try {
        const response = await axios.get('/api/brands');
        setBrands(response.data);
      } catch (error) {
        console.error('브랜드 로드 실패:', error);
      }
    }
    fetchBrands();
  }, []);

  // 검색 실행
  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedBrand) params.brand = selectedBrand;
      if (searchQuery) params.q = searchQuery;

      const response = await axios.get('/api/products', { params });
      setProducts(response.data);
    } catch (error) {
      console.error('검색 실패:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Enter 키 처리
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div>
      <section className="search-section">
        <h2 className="search-header">재고 조회</h2>
        <div className="search-controls">
          <div className="form-group">
            <label className="form-label">브랜드</label>
            <select
              className="form-select"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
            >
              <option value="">전체 브랜드</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">검색어</label>
            <input
              type="text"
              className="form-input"
              placeholder="제품명 또는 SKU를 입력하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSearch}>
              검색
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      ) : products.length > 0 ? (
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </div>
      ) : (
        <div className="no-results">
          검색 결과가 없습니다. 다른 조건으로 검색해 보세요.
        </div>
      )}
    </div>
  );
}

export default SearchView;
