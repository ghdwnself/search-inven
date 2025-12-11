import React from 'react';

function ProductCard({ product }) {
  return (
    <div className="product-card">
      <div className="product-image-container">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="product-image"
          />
        ) : (
          <div className="product-image-placeholder">📦</div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-detail">
          <strong>카테고리:</strong> {product.category}
          {product.subCategory && ` > ${product.subCategory}`}
        </p>
        
        {/* 재고 정보 표시 */}
        {product.inventory && product.inventory.length > 0 ? (
          <div style={{ marginTop: '0.5rem' }}>
            {product.inventory.map((inv, idx) => (
              <p key={idx} className="product-detail" style={{ 
                fontSize: '0.813rem',
                color: inv.location === 'Main' ? '#2563eb' : '#059669'
              }}>
                <strong>{inv.location}:</strong> {inv.available}개 재고
                {inv.reserved > 0 && ` (예약 ${inv.reserved})`}
              </p>
            ))}
          </div>
        ) : (
          <p className="product-detail" style={{ color: '#adb5bd', fontSize: '0.813rem' }}>
            재고 정보 없음
          </p>
        )}
        
        <span className="product-sku">{product.sku}</span>
      </div>
    </div>
  );
}

export default ProductCard;
