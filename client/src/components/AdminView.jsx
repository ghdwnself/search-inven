import { useState, useEffect } from 'react';
import axios from 'axios';

function AdminView() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'pending' | 'bulk'
  const [pendingProducts, setPendingProducts] = useState([]);
  const [error, setError] = useState('');

  // 신규 등록 폼 상태
  const [formData, setFormData] = useState({
    sku: '',
    brand: '',
    productName: '',
    category: '',
    subCategory: '',
    size: '',
    color: '',
    submittedBy: ''
  });
  const [skuError, setSkuError] = useState('');
  const [skuChecking, setSkuChecking] = useState(false);

  // 엑셀 업로드 상태
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // 승인 처리 상태
  const [approving, setApproving] = useState(false);
  const [approvalProgress, setApprovalProgress] = useState({ current: 0, total: 0 });

  // 데이터 새로고침 상태
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState(null);

  // 카테고리 드롭다운 데이터
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

  // 승인 대기 목록 로드
  const loadPendingProducts = async () => {
    try {
      const response = await axios.get('/api/products/pending');
      setPendingProducts(response.data);
    } catch (error) {
      console.error('승인 대기 목록 로드 실패:', error);
    }
  };

  // 새로고침 상태 조회
  const loadRefreshStatus = async () => {
    try {
      const response = await axios.get('/api/admin/refresh-status');
      setRefreshStatus(response.data);
    } catch (error) {
      console.error('새로고침 상태 로드 실패:', error);
    }
  };

  // 카테고리 목록 로드
  const loadCategories = async () => {
    try {
      const response = await axios.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  // 서브카테고리 목록 로드
  const loadSubCategories = async (category = '') => {
    try {
      const url = category ? `/api/subcategories?category=${category}` : '/api/subcategories';
      const response = await axios.get(url);
      setSubCategories(response.data);
    } catch (error) {
      console.error('서브카테고리 로드 실패:', error);
    }
  };

  // 데이터 새로고침
  const handleRefresh = async (type = 'all') => {
    if (refreshing) return;

    if (!confirm(`${type === 'all' ? '전체' : type} 데이터를 새로고침하시겠습니까?`)) {
      return;
    }

    setRefreshing(true);
    try {
      const response = await axios.post(
        `/api/admin/refresh?type=${type}`,
        {},
        { headers: { 'x-admin-password': password } }
      );
      
      setRefreshStatus({
        lastRefreshTime: response.data.lastRefreshTime,
        productsCount: response.data.productsCount,
        imagesCount: response.data.imagesCount,
        inventoryCount: response.data.inventoryCount
      });
      
      alert(`✅ 새로고침 완료!\n제품: ${response.data.productsCount}개\n이미지: ${response.data.imagesCount}개\n재고: ${response.data.inventoryCount}개`);
      
      // 승인 대기 목록도 새로고침
      loadPendingProducts();
    } catch (error) {
      console.error('데이터 새로고침 실패:', error);
      alert('데이터 새로고침 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadPendingProducts();
      loadRefreshStatus();
      loadCategories();
      loadSubCategories();
    }
  }, [isAuthenticated]);

  // 관리자 인증
  const handleLogin = () => {
    // 임시로 비밀번호만 체크 (실제로는 서버에서 확인)
    if (password === 'admin1234') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('비밀번호가 틀렸습니다');
    }
  };

  // SKU 중복 체크
  const checkSKU = async (sku) => {
    if (!sku) {
      setSkuError('');
      return;
    }

    setSkuChecking(true);
    try {
      const response = await axios.get(`/api/check-sku/${sku}`);
      if (response.data.exists) {
        setSkuError(`이미 존재하는 SKU입니다 (${response.data.location})`);
      } else {
        setSkuError('');
      }
    } catch (error) {
      console.error('SKU 체크 실패:', error);
    } finally {
      setSkuChecking(false);
    }
  };

  // 폼 입력 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // SKU 입력 시 실시간 중복 체크
    if (name === 'sku') {
      checkSKU(value);
    }

    // 카테고리 변경 시 서브카테곣0리 업데이트
    if (name === 'category') {
      setFormData(prev => ({ ...prev, subCategory: '' }));
      loadSubCategories(value);
    }
  };

  // 신규 제품 등록
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (skuError) {
      alert('SKU 중복을 확인해주세요');
      return;
    }

    try {
      const response = await axios.post('/api/products/pending', formData);
      alert(response.data.message);
      
      // 폼 초기화
      setFormData({
        sku: '',
        brand: '',
        productName: '',
        category: '',
        subCategory: '',
        size: '',
        color: '',
        submittedBy: ''
      });
      setSkuError('');
      
      // 승인 대기 목록 갱신
      loadPendingProducts();
    } catch (error) {
      alert(error.response?.data?.error || '등록 실패');
    }
  };

  // 제품 승인
  const handleApprove = async (sku) => {
    try {
      const response = await axios.post(`/api/products/approve/${sku}`, {}, {
        headers: { 'x-admin-password': password }
      });
      return { success: true, sku };
    } catch (error) {
      return { success: false, sku, error: error.response?.data?.error || '승인 실패' };
    }
  };

  // 전체 승인
  const handleApproveAll = async () => {
    if (pendingProducts.length === 0) {
      alert('승인 대기 중인 제품이 없습니다');
      return;
    }

    if (!confirm(`총 ${pendingProducts.length}개의 제품을 모두 승인하시겠습니까?`)) {
      return;
    }

    setApproving(true);
    setApprovalProgress({ current: 0, total: pendingProducts.length });

    const results = {
      success: [],
      failed: []
    };

    // 순차적으로 승인 처리
    for (let i = 0; i < pendingProducts.length; i++) {
      const product = pendingProducts[i];
      setApprovalProgress({ current: i + 1, total: pendingProducts.length });
      
      const result = await handleApprove(product.sku);
      if (result.success) {
        results.success.push(result.sku);
      } else {
        results.failed.push({ sku: result.sku, error: result.error });
      }
    }

    setApproving(false);
    setApprovalProgress({ current: 0, total: 0 });

    // 결과 표시
    let message = `✅ 승인 완료: ${results.success.length}개`;
    if (results.failed.length > 0) {
      message += `\n❌ 실패: ${results.failed.length}개`;
      message += `\n실패 SKU: ${results.failed.map(f => f.sku).join(', ')}`;
    }
    alert(message);
    
    loadPendingProducts();
  };

  // 제품 거부
  const handleReject = async (sku) => {
    if (!confirm(`SKU: ${sku} 제품을 거부하시겠습니까?\n(item_pending 시트에서 삭제됩니다)`)) {
      return;
    }

    try {
      const response = await axios.post(`/api/products/reject/${sku}`, {}, {
        headers: { 'x-admin-password': password }
      });
      alert(response.data.message);
      loadPendingProducts();
    } catch (error) {
      alert(error.response?.data?.error || '거부 실패');
    }
  };

  // 템플릿 다운로드
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get('/api/template/download', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'product_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('템플릿 다운로드 실패');
    }
  };

  // 파일 선택
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        alert('CSV 파일(.csv)만 업로드 가능합니다');
        e.target.value = '';
        return;
      }
      setUploadFile(file);
      setUploadResult(null);
    }
  };

  // 엑셀 업로드
  const handleUpload = async () => {
    if (!uploadFile) {
      alert('파일을 선택해주세요');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await axios.post('/api/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadResult(response.data);
      setUploadFile(null);
      
      // 파일 input 초기화
      const fileInput = document.getElementById('excel-upload');
      if (fileInput) fileInput.value = '';
      
      // 승인 대기 목록 갱신
      loadPendingProducts();
      
      alert(`업로드 완료!\n성공: ${response.data.successCount}개\n중복: ${response.data.duplicateCount}개\n오류: ${response.data.errorCount}개`);
    } catch (error) {
      alert(error.response?.data?.error || '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-box">
          <h2>🔒 관리자 인증</h2>
          <p>신규 제품 등록 및 승인을 위해 관리자 비밀번호를 입력하세요.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="관리자 비밀번호"
            className="password-input"
          />
          {error && <p className="error-message">{error}</p>}
          <button onClick={handleLogin} className="login-button">
            로그인
          </button>
        </div>
      </div>
    );
  }

  // 관리자 화면
  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🛠 관리자 페이지</h1>
        
        {/* 데이터 새로고침 상태 표시 */}
        <div className="refresh-status">
          {refreshStatus && (
            <>
              <div className="status-info">
                <span className="status-label">📊 데이터:</span>
                <span className="status-value">
                  제품 {refreshStatus.productsCount}개 | 
                  이미지 {refreshStatus.imagesCount}개 | 
                  재고 {refreshStatus.inventoryCount}개
                </span>
              </div>
              {refreshStatus.lastRefreshTime && (
                <div className="status-info">
                  <span className="status-label">🕒 마지막 업데이트:</span>
                  <span className="status-value">
                    {new Date(refreshStatus.lastRefreshTime).toLocaleString('ko-KR')}
                  </span>
                </div>
              )}
            </>
          )}
          <button 
            className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
            onClick={() => handleRefresh('all')}
            disabled={refreshing}
          >
            {refreshing ? '🔄 새로고침 중...' : '🔄 데이터 새로고침'}
          </button>
        </div>

        <div className="admin-tabs">
          <button
            className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            신규 등록
          </button>
          <button
            className={`tab-button ${activeTab === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveTab('bulk')}
          >
            📊 CSV 일괄 등록
          </button>
          <button
            className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            승인 대기 ({pendingProducts.length})
          </button>
        </div>
      </div>

      {/* 신규 등록 탭 */}
      {activeTab === 'register' && (
        <div className="register-section">
          <h2>📝 신규 제품 등록</h2>
          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-row">
              <div className="form-group">
                <label>SKU *</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  required
                  placeholder=""
                />
                {skuChecking && <span className="checking">확인 중...</span>}
                {skuError && <span className="error">{skuError}</span>}
              </div>

              <div className="form-group">
                <label>브랜드 *</label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleInputChange}
                  required
                  placeholder=""
                />
              </div>
            </div>

            <div className="form-group">
              <label>제품명 *</label>
              <input
                type="text"
                name="productName"
                value={formData.productName}
                onChange={handleInputChange}
                required
                placeholder=""
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>카테고리</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="">카테고리 선택</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>서브 카테고리</label>
                <select
                  name="subCategory"
                  value={formData.subCategory}
                  onChange={handleInputChange}
                  className="form-select"
                  disabled={!formData.category}
                >
                  <option value="">서브카테고리 선택</option>
                  {subCategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>사이즈/용량</label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleInputChange}
                  placeholder="예: 12oz"
                />
              </div>

              <div className="form-group">
                <label>색상/패턴</label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  placeholder=""
                />
              </div>
            </div>

            <div className="form-group">
              <label>등록자 이름</label>
              <input
                type="text"
                name="submittedBy"
                value={formData.submittedBy}
                onChange={handleInputChange}
                placeholder=""
              />
            </div>

            <div className="form-notice">
              <p>💡 <strong>참고:</strong> 제품 이미지는 Google Drive에 SKU 이름으로 업로드해주세요.</p>
              <p>   예: NF-001.jpg → Google Drive 폴더에 업로드</p>
            </div>

            <button 
              type="submit" 
              className="submit-button"
              disabled={skuError || skuChecking}
            >
              등록 (승인 대기)
            </button>
          </form>
        </div>
      )}

      {/* CSV 일괄 등록 탭 */}
      {activeTab === 'bulk' && (
        <div className="bulk-upload-section">
          <h2>📊 CSV 일괄 등록</h2>
          
          <div className="upload-steps">
            <div className="step">
              <h3>1️⃣ 템플릿 다운로드</h3>
              <p>CSV 템플릿을 다운로드하여 제품 정보를 입력하세요.</p>
              <button onClick={handleDownloadTemplate} className="download-button">
                📥 템플릿 다운로드
              </button>
            </div>

            <div className="step">
              <h3>2️⃣ 정보 입력</h3>
              <div className="template-info">
                <p><strong>필수 항목:</strong> SKU, Brand, ProductName</p>
                <p><strong>선택 항목:</strong> Category, SubCategory, Size, Color, SubmittedBy</p>
                <p>템플릿에 제품 정보를 입력하세요</p>
              </div>
            </div>

            <div className="step">
              <h3>3️⃣ 파일 업로드</h3>
              <div className="upload-area">
                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="file-input"
                />
                {uploadFile && (
                  <div className="file-selected">
                    <span>📄 {uploadFile.name}</span>
                    <button 
                      onClick={() => {
                        setUploadFile(null);
                        document.getElementById('csv-upload').value = '';
                      }}
                      className="remove-file"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <button 
                  onClick={handleUpload} 
                  className="upload-button"
                  disabled={!uploadFile || uploading}
                >
                  {uploading ? '업로드 중...' : '📤 업로드 및 등록'}
                </button>
              </div>
            </div>
          </div>

          {uploadResult && (
            <div className="upload-result">
              <h3>📋 업로드 결과</h3>
              <div className="result-summary">
                <div className="result-item success">
                  <span className="result-label">성공</span>
                  <span className="result-value">{uploadResult.successCount}개</span>
                </div>
                <div className="result-item duplicate">
                  <span className="result-label">중복</span>
                  <span className="result-value">{uploadResult.duplicateCount}개</span>
                </div>
                <div className="result-item error">
                  <span className="result-label">오류</span>
                  <span className="result-value">{uploadResult.errorCount}개</span>
                </div>
              </div>

              {uploadResult.results.errors.length > 0 && (
                <div className="error-list">
                  <h4>❌ 오류 목록</h4>
                  {uploadResult.results.errors.map((err, idx) => (
                    <p key={idx}>행 {err.row}: {err.error}</p>
                  ))}
                </div>
              )}

              {uploadResult.results.duplicates.length > 0 && (
                <div className="duplicate-list">
                  <h4>⚠️ 중복 SKU</h4>
                  {uploadResult.results.duplicates.map((dup, idx) => (
                    <p key={idx}>행 {dup.row}: {dup.sku} (이미 {dup.location}에 존재)</p>
                  ))}
                </div>
              )}

              {uploadResult.successCount > 0 && (
                <p className="success-message">
                  ✅ {uploadResult.successCount}개 제품이 승인 대기 목록에 추가되었습니다
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 승인 대기 탭 */}
      {activeTab === 'pending' && (
        <div className="register-section">
          <div className="pending-header-section">
            <h2>⏳ 승인 대기 목록</h2>
            {pendingProducts.length > 0 && (
              <button 
                onClick={handleApproveAll} 
                className="approve-all-button"
                disabled={approving}
              >
                {approving 
                  ? `⏳ 승인 중... (${approvalProgress.current}/${approvalProgress.total})`
                  : `✅ 전체 승인 (${pendingProducts.length}개)`
                }
              </button>
            )}
          </div>

          {/* 승인 진행 중 오버레이 */}
          {approving && (
            <div className="approval-overlay">
              <div className="approval-modal">
                <div className="spinner"></div>
                <h3>승인 처리 중...</h3>
                <p className="progress-text">
                  {approvalProgress.current} / {approvalProgress.total} 완료
                </p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(approvalProgress.current / approvalProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {pendingProducts.length === 0 ? (
            <p className="empty-message">승인 대기 중인 제품이 없습니다.</p>
          ) : (
            <div className="pending-list">
              {pendingProducts.map((product, index) => (
                <div key={index} className="pending-item">
                  <div className="pending-header">
                    <h3>{product.productName}</h3>
                    <span className="pending-date">
                      {new Date(product.submittedAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="pending-details">
                    <p><strong>SKU:</strong> {product.sku}</p>
                    <p><strong>브랜드:</strong> {product.brand}</p>
                    <p><strong>카테고리:</strong> {product.category || '-'}</p>
                    <p><strong>사이즈:</strong> {product.size || '-'}</p>
                    <p><strong>색상:</strong> {product.color || '-'}</p>
                    <p><strong>등록자:</strong> {product.submittedBy}</p>
                  </div>
                  <div className="pending-actions">
                    <button
                      onClick={async () => {
                        if (!confirm(`SKU: ${product.sku} 제품을 승인하시겠습니까?`)) return;
                        const result = await handleApprove(product.sku);
                        if (result.success) {
                          alert('✅ 승인 완료');
                          loadPendingProducts();
                        } else {
                          alert('❌ ' + result.error);
                        }
                      }}
                      className="approve-button"
                    >
                      ✅ 승인
                    </button>
                    <button
                      onClick={() => handleReject(product.sku)}
                      className="reject-button"
                    >
                      ❌ 거부
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminView;
