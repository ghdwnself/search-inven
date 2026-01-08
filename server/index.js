import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 수동 로드 (Windows 호환성)
const envPath = path.join(__dirname, '..', '.env');

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...values] = line.split('=');
      if (key && values.length > 0) {
        envVars[key.trim()] = values.join('=').trim();
      }
    }
  });
  
  // 환경 변수 설정
  if (envVars.GOOGLE_SHEET_ID) process.env.GOOGLE_SHEET_ID = envVars.GOOGLE_SHEET_ID;
  if (envVars.GOOGLE_INVENTORY_SHEET_ID) process.env.GOOGLE_INVENTORY_SHEET_ID = envVars.GOOGLE_INVENTORY_SHEET_ID;
  if (envVars.GOOGLE_DRIVE_FOLDER_ID) process.env.GOOGLE_DRIVE_FOLDER_ID = envVars.GOOGLE_DRIVE_FOLDER_ID;
  if (envVars.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = envVars.ADMIN_PASSWORD;
  
  console.log('✅ 환경 변수 로드 완료');
} catch (error) {
  console.error('❌ .env 파일 읽기 실패:', error.message);
  console.error('   파일 위치:', envPath);
  process.exit(1);
}

// 필수 환경 변수 확인
if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
  console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
  console.error('   GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID ? '✅' : '❌');
  console.error('   GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID ? '✅' : '❌');
  console.error('\n.env 파일을 확인해주세요.');
  process.exit(1);
}

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Multer 설정 (메모리 저장)
const upload = multer({ storage: multer.memoryStorage() });

// 메모리 캐시
let products = [];
let imageMap = {};
let inventoryMap = {}; // SKU별 재고 정보
let pendingProducts = []; // 승인 대기 제품

// 데이터 새로고침 상태
let lastRefreshTime = null;
let isRefreshing = false;

// Google Sheets 인증 설정
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
];

const serviceAccountAuth = new JWT({
  keyFile: path.join(__dirname, 'credentials.json'),
  scopes: SCOPES,
});

// Google Drive 이미지 로드
async function loadImagesFromDrive() {
  try {
    const drive = google.drive({ version: 'v3', auth: serviceAccountAuth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    console.log('📁 Google Drive 폴더에서 이미지 로딩 중...');
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/'`,
      fields: 'files(id, name, thumbnailLink, webContentLink)',
      pageSize: 1000
    });

    const files = response.data.files || [];
    console.log(`✅ ${files.length}개의 이미지 파일 발견`);

    // SKU를 키로 하는 이미지 맵 생성
    files.forEach(file => {
      // 파일명에서 확장자 제거하여 SKU 추출
      const sku = file.name.replace(/\.[^/.]+$/, '');
      imageMap[sku] = {
        id: file.id,
        name: file.name
      };
    });

    console.log(`📷 ${Object.keys(imageMap).length}개의 이미지가 매핑됨`);
  } catch (error) {
    console.error('❌ Drive 이미지 로드 실패:', error.message);
  }
}

// Google Sheets 재고 데이터 로드
async function loadInventoryData() {
  try {
    const inventorySheetId = process.env.GOOGLE_INVENTORY_SHEET_ID;
    if (!inventorySheetId) {
      console.log('⚠️ 재고 시트 ID가 설정되지 않음, 재고 데이터 건너뜀');
      return;
    }

    const doc = new GoogleSpreadsheet(inventorySheetId, serviceAccountAuth);

    console.log('📊 재고 데이터 로딩 중...');
    
    await doc.loadInfo();
    console.log(`📄 재고 시트 제목: ${doc.title}`);

    // 'Inventory' 시트 찾기
    let inventorySheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const sheet = doc.sheetsByIndex[i];
      if (sheet.title.toLowerCase() === 'inventory') {
        inventorySheet = sheet;
        console.log(`✅ Inventory 시트 발견: ${sheet.title}`);
        break;
      }
    }

    if (!inventorySheet) {
      console.log('⚠️ Inventory 시트를 찾을 수 없음');
      return;
    }

    await inventorySheet.loadHeaderRow();
    const headers = inventorySheet.headerValues;
    console.log('📋 재고 시트 헤더:', headers);

    const rows = await inventorySheet.getRows();
    console.log(`📦 총 ${rows.length}개의 재고 데이터 로드됨`);

    // SKU별로 재고 정보 그룹화 (location별)
    rows.forEach(row => {
      const sku = row.get('sku') || '';
      const location = row.get('location') || '';
      const onHand = row.get('onHand') || 0;
      const reserved = row.get('reserved') || 0;
      const available = row.get('available') || 0;

      if (!sku) return;

      if (!inventoryMap[sku]) {
        inventoryMap[sku] = [];
      }

      inventoryMap[sku].push({
        location,
        onHand: Number(onHand),
        reserved: Number(reserved),
        available: Number(available)
      });
    });

    console.log(`📊 ${Object.keys(inventoryMap).length}개 SKU의 재고 정보 매핑됨`);
  } catch (error) {
    console.error('❌ 재고 데이터 로드 실패:', error.message);
  }
}

// Google Sheets 승인 대기 데이터 로드
async function loadPendingData() {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

    console.log('⏳ 승인 대기 데이터 로딩 중...');
    
    await doc.loadInfo();

    // item_pending 시트 찾기 또는 생성
    let pendingSheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const sheet = doc.sheetsByIndex[i];
      if (sheet.title.toLowerCase() === 'item_pending') {
        pendingSheet = sheet;
        console.log(`✅ item_pending 시트 발견`);
        break;
      }
    }

    // 시트가 없으면 생성
    if (!pendingSheet) {
      console.log('📝 item_pending 시트 생성 중...');
      pendingSheet = await doc.addSheet({
        title: 'item_pending',
        headerValues: ['SKU', 'Brand', 'ProductName', 'Category', 'SubCategory', 'Size', 'Color', 'SubmittedBy', 'SubmittedAt', 'Status']
      });
      console.log('✅ item_pending 시트 생성 완료');
      return; // 새로 생성했으면 데이터 없음
    }

    await pendingSheet.loadHeaderRow();
    const rows = await pendingSheet.getRows();
    console.log(`📦 총 ${rows.length}개의 승인 대기 제품 로드됨`);

    // pendingProducts 배열 초기화
    pendingProducts = [];
    rows.forEach(row => {
      pendingProducts.push({
        sku: row.get('SKU') || '',
        brand: row.get('Brand') || '',
        productName: row.get('ProductName') || '',
        category: row.get('Category') || '',
        subCategory: row.get('SubCategory') || '',
        size: row.get('Size') || '',
        color: row.get('Color') || '',
        submittedBy: row.get('SubmittedBy') || '',
        submittedAt: row.get('SubmittedAt') || '',
        status: row.get('Status') || 'pending'
      });
    });

    console.log(`✅ ${pendingProducts.length}개의 승인 대기 제품 매핑됨`);
  } catch (error) {
    console.error('❌ 승인 대기 데이터 로드 실패:', error.message);
  }
}

// Google Sheets 데이터 로드
async function loadSheetData() {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

    console.log('📊 Google Sheets 데이터 로딩 중...');
    
    await doc.loadInfo();
    console.log(`📄 시트 제목: ${doc.title}`);
    console.log(`📑 총 ${doc.sheetCount}개의 시트 발견`);

    // 모든 시트를 순회하며 'item_master' 또는 데이터가 있는 시트 찾기
    let sheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const currentSheet = doc.sheetsByIndex[i];
      console.log(`   [${i}] ${currentSheet.title} (행: ${currentSheet.rowCount}, 열: ${currentSheet.columnCount})`);
      
      // 'item_master' 또는 'master' 이름을 가진 시트 찾기
      if (currentSheet.title.toLowerCase().includes('item') || 
          currentSheet.title.toLowerCase().includes('master') ||
          currentSheet.title.toLowerCase().includes('inventory')) {
        sheet = currentSheet;
        console.log(`✅ 사용할 시트 선택: ${sheet.title}`);
        break;
      }
    }

    // item_master를 못 찾으면 첫 번째 데이터가 있는 시트 사용
    if (!sheet) {
      for (let i = 0; i < doc.sheetCount; i++) {
        const currentSheet = doc.sheetsByIndex[i];
        if (currentSheet.rowCount > 1) { // 헤더 + 최소 1개 행
          sheet = currentSheet;
          console.log(`⚠️ 'item_master'를 찾지 못해 첫 번째 데이터 시트 사용: ${sheet.title}`);
          break;
        }
      }
    }

    if (!sheet) {
      throw new Error('사용 가능한 시트를 찾을 수 없습니다.');
    }

    // 헤더 행 설정 (1번 행이 숫자면 2번 행 사용)
    await sheet.loadHeaderRow();
    let headers = sheet.headerValues;
    
    // 헤더가 숫자로만 되어 있으면 2번째 행을 헤더로 사용
    if (headers.every(h => !isNaN(h) || h === '')) {
      console.log('⚠️ 1번째 행이 헤더가 아님, 2번째 행을 헤더로 사용');
      await sheet.loadHeaderRow(2); // 2번째 행을 헤더로
      headers = sheet.headerValues;
    }
    
    console.log('📋 시트 헤더:', headers);

    const rows = await sheet.getRows();
    console.log(`📦 총 ${rows.length}개의 제품 로드됨`);

    products = rows.map(row => {
      const sku = row.get('SKU') || '';
      const brand = row.get('Brand') || '';
      const name = row.get('ProductName_Short') || row.get('Product Name') || '';
      const category = row.get('Category') || '';
      const subCategory = row.get('Sub_Category') || row.get('SubCategory') || '';
      
      // 이미지 매핑
      const imageData = imageMap[sku];

      // 재고 정보 가져오기
      const inventory = inventoryMap[sku] || [];

      return {
        sku,
        brand,
        name,
        category,
        subCategory,
        imageUrl: imageData ? `/api/images/${sku}` : null,
        inventory: inventory, // location별 재고 정보 배열
        // 추가 필드 (있으면 포함)
        stock: row.get('Stock') || null,
        price: row.get('Price') || null,
        upc: row.get('UPC') || null,
        activityStatus: row.get('Activity_Status') || null,
      };
    }).filter(p => p.sku); // SKU가 있는 제품만 포함

    console.log(`✅ ${products.length}개의 제품 데이터 준비 완료`);
  } catch (error) {
    console.error('❌ Sheets 데이터 로드 실패:', error.message);
    throw error;
  }
}

// 서버 시작 시 데이터 로드
async function initializeServer() {
  try {
    console.log('🚀 서버 초기화 중...');
    await loadImagesFromDrive();
    await loadInventoryData();
    await loadPendingData(); // 승인 대기 데이터 로드 추가
    await loadSheetData();
    console.log('✨ 서버 초기화 완료!');
  } catch (error) {
    console.error('❌ 서버 초기화 실패:', error);
    process.exit(1);
  }
}

// API 엔드포인트

// 브랜드 목록 조회
app.get('/api/brands', (req, res) => {
  try {
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
    brands.sort();
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 카테고리 목록 조회
app.get('/api/categories', (req, res) => {
  try {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    categories.sort();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 서브카테고리 목록 조회 (카테고리별)
app.get('/api/subcategories', (req, res) => {
  try {
    const { category } = req.query;
    let subcategories;
    
    if (category) {
      // 특정 카테고리의 서브카테고리만
      subcategories = [...new Set(
        products
          .filter(p => p.category === category)
          .map(p => p.subCategory)
          .filter(Boolean)
      )];
    } else {
      // 모든 서브카테고리
      subcategories = [...new Set(products.map(p => p.subCategory).filter(Boolean))];
    }
    
    subcategories.sort();
    res.json(subcategories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 제품 검색
app.get('/api/products', (req, res) => {
  try {
    const { q, brand, category } = req.query;
    
    let filtered = products;

    // 브랜드 필터
    if (brand) {
      filtered = filtered.filter(p => p.brand === brand);
    }

    // 카테고리 필터
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }

    // 검색어 필터 (SKU, 제품명에서 검색)
    if (q) {
      const searchTerm = q.toLowerCase();
      filtered = filtered.filter(p => 
        p.sku.toLowerCase().includes(searchTerm) ||
        p.name.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm) ||
        p.subCategory.toLowerCase().includes(searchTerm)
      );
    }

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 다중 SKU 조회
app.post('/api/products/bulk', (req, res) => {
  try {
    const { skus } = req.body;
    
    if (!Array.isArray(skus)) {
      return res.status(400).json({ error: 'skus는 배열이어야 합니다.' });
    }

    const skuSet = new Set(skus.map(s => s.trim().toUpperCase()));
    const result = products.filter(p => skuSet.has(p.sku.toUpperCase()));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 이미지 프록시 엔드포인트
app.get('/api/images/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const imageData = imageMap[sku];

    if (!imageData) {
      return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }

    const drive = google.drive({ version: 'v3', auth: serviceAccountAuth });
    
    // 이미지 다운로드
    const response = await drive.files.get(
      { fileId: imageData.id, alt: 'media' },
      { responseType: 'stream' }
    );

    // 이미지 타입 설정
    const ext = imageData.name.split('.').pop().toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1일 캐시

    // 스트림으로 이미지 전송
    response.data.pipe(res);
  } catch (error) {
    console.error('이미지 로드 실패:', error.message);
    res.status(500).json({ error: '이미지 로드 실패' });
  }
});

// ============================================
// 신규 제품 등록 API
// ============================================

// 관리자 인증 미들웨어
function adminAuth(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: '관리자 권한이 필요합니다' });
  }
  next();
}

// SKU 중복 체크
app.get('/api/check-sku/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    
    // 기존 제품 확인
    const existsInProducts = products.some(p => p.SKU === sku);
    // 승인 대기 제품 확인
    const existsInPending = pendingProducts.some(p => p.sku === sku);
    
    res.json({
      exists: existsInProducts || existsInPending,
      location: existsInProducts ? 'products' : existsInPending ? 'pending' : null
    });
  } catch (error) {
    console.error('SKU 체크 실패:', error.message);
    res.status(500).json({ error: 'SKU 체크 실패' });
  }
});

// 신규 제품 등록 (승인 대기)
app.post('/api/products/pending', async (req, res) => {
  try {
    const productData = req.body;
    
    // 필수 필드 검증
    if (!productData.sku || !productData.brand || !productData.productName) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다 (SKU, Brand, ProductName)' });
    }
    
    // SKU 중복 체크
    const existsInProducts = products.some(p => p.SKU === productData.sku);
    const existsInPending = pendingProducts.some(p => p.sku === productData.sku);
    
    if (existsInProducts || existsInPending) {
      return res.status(409).json({ error: 'SKU가 이미 존재합니다' });
    }
    
    // Google Sheets에 추가
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    
    // item_pending 시트 찾기
    let pendingSheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const sheet = doc.sheetsByIndex[i];
      if (sheet.title.toLowerCase() === 'item_pending') {
        pendingSheet = sheet;
        break;
      }
    }
    
    if (!pendingSheet) {
      return res.status(500).json({ error: 'item_pending 시트를 찾을 수 없습니다' });
    }
    
    // 새 행 추가
    const newRow = {
      SKU: productData.sku,
      Brand: productData.brand,
      ProductName: productData.productName,
      Category: productData.category || '',
      SubCategory: productData.subCategory || '',
      Size: productData.size || '',
      Color: productData.color || '',
      SubmittedBy: productData.submittedBy || 'Anonymous',
      SubmittedAt: new Date().toISOString(),
      Status: 'pending'
    };
    
    await pendingSheet.addRow(newRow);
    
    // 메모리 캐시에도 추가
    pendingProducts.push({
      sku: productData.sku,
      brand: productData.brand,
      productName: productData.productName,
      category: productData.category || '',
      subCategory: productData.subCategory || '',
      size: productData.size || '',
      color: productData.color || '',
      submittedBy: productData.submittedBy || 'Anonymous',
      submittedAt: new Date().toISOString(),
      status: 'pending'
    });
    
    res.json({ 
      success: true, 
      message: '제품이 승인 대기 목록에 추가되었습니다',
      product: newRow
    });
  } catch (error) {
    console.error('제품 등록 실패:', error.message);
    res.status(500).json({ error: '제품 등록 실패' });
  }
});

// 승인 대기 목록 조회
app.get('/api/products/pending', (req, res) => {
  res.json(pendingProducts);
});

// 제품 승인 (관리자 전용)
app.post('/api/products/approve/:sku', adminAuth, async (req, res) => {
  try {
    const { sku } = req.params;
    
    // 승인 대기 목록에서 찾기
    const pendingIndex = pendingProducts.findIndex(p => p.sku === sku);
    if (pendingIndex === -1) {
      return res.status(404).json({ error: '해당 SKU를 찾을 수 없습니다' });
    }
    
    const productToApprove = pendingProducts[pendingIndex];
    
    // Google Sheets 접근
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    
    // item_pending 시트에서 삭제
    let pendingSheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const currentSheet = doc.sheetsByIndex[i];
      if (currentSheet.title.toLowerCase() === 'item_pending') {
        pendingSheet = currentSheet;
        break;
      }
    }
    
    if (pendingSheet) {
      const rows = await pendingSheet.getRows();
      const rowToDelete = rows.find(row => row.get('SKU') === sku);
      if (rowToDelete) {
        await rowToDelete.delete();
      }
    }
    
    // item_master 시트 찾기
    let masterSheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const currentSheet = doc.sheetsByIndex[i];
      const title = currentSheet.title.toLowerCase();
      if (title === 'item_master' || 
          (title.includes('item') && title.includes('master'))) {
        masterSheet = currentSheet;
        break;
      }
    }
    
    if (!masterSheet) {
      console.error('item_master 시트를 찾을 수 없습니다');
      return res.status(500).json({ error: 'item_master 시트를 찾을 수 없습니다' });
    }
    
    // item_master에 새 행 추가 (34개 컬럼 모두 정의)
    const newRow = {
      SKU: productToApprove.sku || '',
      UPC: '',
      ProductName_Short: productToApprove.productName || '',
      Brand: productToApprove.brand || '',
      Category: productToApprove.category || '',
      Sub_Category: productToApprove.subCategory || '',
      Size_Capacity: productToApprove.size || '',
      Shape: '',
      Color_Pattern: productToApprove.color || '',
      Feature: '',
      MaterialMain: '',
      Vendor: '',
      CasePack: '',
      UnitsPerCase: '',
      MasterCarton_Length_inches: '',
      MasterCarton_Width_inches: '',
      MasterCarton_Height_inches: '',
      MasterCarton_Length_cm: '',
      MasterCarton_Width_cm: '',
      MasterCarton_Height_cm: '',
      MasterCarton_Weight_lbs: '',
      MasterCarton_Weight_kg: '',
      CBM_per_Case: '',
      CBM_per_Unit: '',
      Max_Cartons_per_Pallet: '',
      'Max Height_per_Pallet': '',
      CountryOfOrigin: '',
      FOB_Cost: '',
      LandedCost: '',
      WholesalePrice: '',
      MSRP: '',
      MAP: '',
      KeyAccountPrice_TJX: '',
      KeyAccountPrice_Costco: ''
    };
    
    // 2번째 행을 헤더로 사용 (1번째 행은 제목행)
    await masterSheet.loadHeaderRow(2);
    await masterSheet.addRow(newRow);
    
    // 메모리 캐시 업데이트
    products.push({
      SKU: productToApprove.sku,
      Brand: productToApprove.brand,
      ProductName_Short: productToApprove.productName,
      Category: productToApprove.category || '',
      Sub_Category: productToApprove.subCategory || '',
      Size_Capacity: productToApprove.size || '',
      Color_Pattern: productToApprove.color || '',
      inventory: inventoryMap[productToApprove.sku] || []
    });
    
    // products 배열도 정렬
    products.sort((a, b) => {
      const skuA = (a.SKU || '').toUpperCase();
      const skuB = (b.SKU || '').toUpperCase();
      return skuA < skuB ? -1 : skuA > skuB ? 1 : 0;
    });
    
    // 승인 대기 목록에서 제거
    pendingProducts.splice(pendingIndex, 1);
    
    res.json({ 
      success: true, 
      message: '제품이 승인되어 메인 시트에 추가되었습니다' 
    });
  } catch (error) {
    console.error('제품 승인 실패:', error.message);
    res.status(500).json({ error: '제품 승인 실패: ' + error.message });
  }
});

// 제품 거부 (관리자 전용)
app.post('/api/products/reject/:sku', adminAuth, async (req, res) => {
  try {
    const { sku } = req.params;
    const { reason } = req.body;
    
    // 승인 대기 목록에서 찾기
    const pendingIndex = pendingProducts.findIndex(p => p.sku === sku);
    if (pendingIndex === -1) {
      return res.status(404).json({ error: '해당 SKU를 찾을 수 없습니다' });
    }
    
    // Google Sheets에서 삭제
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    
    // item_pending 시트에서 삭제
    let pendingSheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const currentSheet = doc.sheetsByIndex[i];
      if (currentSheet.title.toLowerCase() === 'item_pending') {
        pendingSheet = currentSheet;
        break;
      }
    }
    
    if (pendingSheet) {
      const rows = await pendingSheet.getRows();
      const rowToDelete = rows.find(row => row.get('SKU') === sku);
      if (rowToDelete) {
        await rowToDelete.delete();
        console.log(`✅ item_pending에서 ${sku} 삭제 완료 (거부)`);
      }
    }
    
    // 승인 대기 목록에서 제거
    pendingProducts.splice(pendingIndex, 1);
    
    res.json({ 
      success: true, 
      message: '제품이 거부되었습니다',
      reason: reason || ''
    });
  } catch (error) {
    console.error('제품 거부 실패:', error.message);
    res.status(500).json({ error: '제품 거부 실패' });
  }
});

// 엑셀 템플릿 다운로드
app.get('/api/template/download', (req, res) => {
  try {
    // CSV 템플릿 생성 (UTF-8 BOM 추가로 Excel 한글 호환)
    const headers = [
      'SKU',
      'Brand',
      'ProductName',
      'Category',
      'SubCategory',
      'Size',
      'Color',
      'SubmittedBy'
    ];
    
    // 빈 템플릿 (헤더만 포함)
    const exampleData = [];
    
    // CSV 문자열 생성
    const rows = [headers, ...exampleData];
    const csvContent = rows.map(row => 
      row.map(cell => {
        // 쉼표, 따옴표, 줄바꿈 포함 시 이스케이프
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ).join('\r\n');
    
    // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const buffer = Buffer.from(BOM + csvContent, 'utf8');
    
    // 응답 헤더 설정
    res.setHeader('Content-Disposition', 'attachment; filename="product_template.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error) {
    console.error('템플릿 다운로드 실패:', error.message);
    res.status(500).json({ error: '템플릿 다운로드 실패' });
  }
});

// 엑셀 파일 업로드 및 일괄 등록
app.post('/api/products/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다' });
    }
    
    // 파일 타입 체크 (Excel 파일 업로드 방지)
    const fileSignature = req.file.buffer.slice(0, 4).toString('hex');
    if (fileSignature === '504b0304') { // ZIP/XLSX 파일 시그니처
      return res.status(400).json({ 
        error: 'Excel 파일(.xlsx)은 지원하지 않습니다. CSV 템플릿을 다운로드하여 사용해주세요.' 
      });
    }
    
    // CSV 파일 읽기 (UTF-8 BOM 처리)
    let csvContent = req.file.buffer.toString('utf8');
    
    // UTF-8 BOM 제거
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    
    // CSV 파싱
    let data;
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      });
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'CSV 파일에 데이터가 없습니다' });
      }
      
      data = records;
    } catch (parseError) {
      console.error('CSV 파싱 실패:', parseError.message);
      return res.status(400).json({ 
        error: 'CSV 파일 형식이 올바르지 않습니다. CSV 템플릿을 다운로드하여 사용해주세요.' 
      });
    }
    
    const results = {
      success: [],
      errors: [],
      duplicates: []
    };
    
    // Google Sheets 접근
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    
    // item_pending 시트 찾기
    let pendingSheet = null;
    for (let i = 0; i < doc.sheetCount; i++) {
      const sheet = doc.sheetsByIndex[i];
      if (sheet.title.toLowerCase() === 'item_pending') {
        pendingSheet = sheet;
        break;
      }
    }
    
    if (!pendingSheet) {
      return res.status(500).json({ error: 'item_pending 시트를 찾을 수 없습니다' });
    }
    
    // 각 행 처리
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // 엑셀 행 번호 (헤더 제외)
      
      // 필수 필드 검증
      if (!row.SKU || !row.Brand || !row.ProductName) {
        results.errors.push({
          row: rowNum,
          sku: row.SKU || '',
          error: '필수 항목 누락 (SKU, Brand, ProductName)'
        });
        continue;
      }
      
      // SKU 중복 체크
      const existsInProducts = products.some(p => p.SKU === row.SKU);
      const existsInPending = pendingProducts.some(p => p.sku === row.SKU);
      
      if (existsInProducts || existsInPending) {
        results.duplicates.push({
          row: rowNum,
          sku: row.SKU,
          location: existsInProducts ? 'products' : 'pending'
        });
        continue;
      }
      
      // item_pending 시트에 추가
      try {
        const newRow = {
          SKU: row.SKU,
          Brand: row.Brand,
          ProductName: row.ProductName,
          Category: row.Category || '',
          SubCategory: row.SubCategory || '',
          Size: row.Size || '',
          Color: row.Color || '',
          SubmittedBy: row.SubmittedBy || 'Excel Upload',
          SubmittedAt: new Date().toISOString(),
          Status: 'pending'
        };
        
        await pendingSheet.addRow(newRow);
        
        // 메모리 캐시에도 추가
        pendingProducts.push({
          sku: row.SKU,
          brand: row.Brand,
          productName: row.ProductName,
          category: row.Category || '',
          subCategory: row.SubCategory || '',
          size: row.Size || '',
          color: row.Color || '',
          submittedBy: row.SubmittedBy || 'Excel Upload',
          submittedAt: new Date().toISOString(),
          status: 'pending'
        });
        
        results.success.push({
          row: rowNum,
          sku: row.SKU,
          name: row.ProductName
        });
      } catch (error) {
        results.errors.push({
          row: rowNum,
          sku: row.SKU,
          error: '시트 추가 실패: ' + error.message
        });
      }
    }
    
    res.json({
      message: '업로드 완료',
      total: data.length,
      successCount: results.success.length,
      errorCount: results.errors.length,
      duplicateCount: results.duplicates.length,
      results
    });
  } catch (error) {
    console.error('CSV 업로드 실패:', error.message);
    console.error('전체 에러:', error);
    res.status(500).json({ error: 'CSV 업로드 실패: ' + error.message });
  }
});

// ============================================
// 기존 API
// ============================================

// ============================================
// 데이터 새로고침 API
// ============================================

// 새로고침 상태 조회
app.get('/api/admin/refresh-status', (req, res) => {
  res.json({
    lastRefreshTime,
    isRefreshing,
    productsCount: products.length,
    imagesCount: Object.keys(imageMap).length,
    inventoryCount: Object.keys(inventoryMap).length
  });
});

// 데이터 새로고침 (관리자 전용)
app.post('/api/admin/refresh', adminAuth, async (req, res) => {
  if (isRefreshing) {
    return res.status(409).json({ error: '이미 새로고침이 진행 중입니다' });
  }

  try {
    isRefreshing = true;
    const { type } = req.query; // 'all', 'products', 'inventory', 'images'

    console.log('🔄 데이터 새로고침 시작:', type || 'all');

    if (!type || type === 'all' || type === 'images') {
      imageMap = {};
      await loadImagesFromDrive();
    }

    if (!type || type === 'all' || type === 'inventory') {
      inventoryMap = {};
      await loadInventoryData();
    }

    if (!type || type === 'all' || type === 'pending') {
      pendingProducts = [];
      await loadPendingData();
    }

    if (!type || type === 'all' || type === 'products') {
      products = [];
      await loadSheetData();
    }

    lastRefreshTime = new Date().toISOString();
    console.log('✅ 데이터 새로고침 완료');

    res.json({
      success: true,
      message: '데이터 새로고침 완료',
      lastRefreshTime,
      productsCount: products.length,
      imagesCount: Object.keys(imageMap).length,
      inventoryCount: Object.keys(inventoryMap).length,
      pendingCount: pendingProducts.length
    });
  } catch (error) {
    console.error('❌ 데이터 새로고침 실패:', error.message);
    res.status(500).json({ error: '데이터 새로고침 실패: ' + error.message });
  } finally {
    isRefreshing = false;
  }
});

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    productsLoaded: products.length,
    imagesLoaded: Object.keys(imageMap).length,
    lastRefreshTime
  });
});

// 서버 시작
initializeServer().then(() => {
  lastRefreshTime = new Date().toISOString();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`📡 네트워크 접속: http://<내부IP>:${PORT}`);
  });
});
