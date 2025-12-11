import { useState } from 'react';
import axios from 'axios';

function BulkSearchView() {
  const [skuText, setSkuText] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleBulkSearch = async () => {
    if (!skuText.trim()) {
      alert('SKU를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 줄바꿈으로 SKU 분리
      const skus = skuText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const response = await axios.post('/api/products/bulk', { skus });
      setProducts(response.data);
    } catch (error) {
      console.error('다중 검색 실패:', error);
      alert('다중 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="search-section">
        <h2 className="search-header">다중 SKU 검색</h2>
        <p style={{ marginBottom: '1rem', color: '#6c757d' }}>
          엑셀에서 SKU를 복사하여 붙여넣으세요. (한 줄에 하나씩)
        </p>
        <div className="bulk-search-area">
          <textarea
            className="form-textarea"
            placeholder="SKU1&#10;SKU2&#10;SKU3&#10;..."
            value={skuText}
            onChange={(e) => setSkuText(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={handleBulkSearch}
            style={{ marginTop: '1rem' }}
          >
            검색
          </button>
        </div>
      </section>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      ) : products.length > 0 ? (
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
      ) : (
        <div className="no-results">
          검색 결과가 없습니다. SKU를 입력해주세요.
        </div>
      )}
    </div>
  );
}

export default BulkSearchView;
