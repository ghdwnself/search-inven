import { useState, useEffect } from 'react';
import axios from 'axios';
import ProductCard from './ProductCard';

function SearchView() {
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'

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

  // 카테고리 목록 로드
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await axios.get('/api/categories');
        setCategories(response.data);
      } catch (error) {
        console.error('카테고리 로드 실패:', error);
      }
    }
    fetchCategories();
  }, []);

  // 카테고리 변경 시 서브카테고리 로드
  const handleCategoryChange = async (category) => {
    setSelectedCategory(category);
    setSelectedSubCategory('');
    
    if (category) {
      try {
        const response = await axios.get('/api/subcategories', {
          params: { category }
        });
        setSubCategories(response.data);
      } catch (error) {
        console.error('서브카테고리 로드 실패:', error);
      }
    } else {
      setSubCategories([]);
    }
  };

  // 검색 실행
  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedBrand) params.brand = selectedBrand;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedSubCategory) params.subCategory = selectedSubCategory;
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
            <label className="form-label">카테고리</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">전체 카테고리</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">서브카테고리</label>
            <select
              className="form-select"
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              disabled={!selectedCategory}
            >
              <option value="">전체 서브카테고리</option>
              {subCategories.map((subCategory) => (
                <option key={subCategory} value={subCategory}>
                  {subCategory}
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
        <>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
            >
              📇 카드 뷰
            </button>
            <button
              className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              📊 테이블 뷰
            </button>
          </div>

          {viewMode === 'card' ? (
            <div className="products-grid">
              {products.map((product) => (
                <ProductCard key={product.sku} product={product} />
              ))}
            </div>
          ) : (
            <div className="results-table">
              <table>
                <thead>
                  <tr>
                    <th>이미지</th>
                    <th>SKU</th>
                    <th>브랜드</th>
                    <th>제품명</th>
                    <th>카테고리</th>
                    <th>재고 (Main)</th>
                    <th>재고 (Sub)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const mainInventory = product.inventory?.find(inv => inv.location === 'Main');
                    const subInventory = product.inventory?.find(inv => inv.location === 'Sub');
                    
                    return (
                      <tr key={product.sku}>
                        <td>
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="table-image"
                            />
                          ) : (
                            <div style={{ fontSize: '2rem' }}>📦</div>
                          )}
                        </td>
                        <td>
                          <strong>{product.sku}</strong>
                        </td>
                        <td>{product.brand}</td>
                        <td>{product.name}</td>
                        <td>
                          {product.category}
                          {product.subCategory && ` > ${product.subCategory}`}
                        </td>
                        <td style={{ color: '#2563eb', fontWeight: '500' }}>
                          {mainInventory ? (
                            <>{mainInventory.available}개</>
                          ) : (
                            <span style={{ color: '#adb5bd' }}>-</span>
                          )}
                        </td>
                        <td style={{ color: '#059669', fontWeight: '500' }}>
                          {subInventory ? (
                            <>{subInventory.available}개</>
                          ) : (
                            <span style={{ color: '#adb5bd' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="no-results">
          검색 결과가 없습니다. 다른 조건으로 검색해 보세요.
        </div>
      )}
    </div>
  );
}

export default SearchView;
