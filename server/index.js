import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 수동 로드 (Windows 호환성)
const envPath = path.join(__dirname, '..', '.env');
console.log('📄 .env 파일 경로:', envPath);

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
  
  console.log('✅ .env 파일 로드 완료');
} catch (error) {
  console.error('❌ .env 파일 읽기 실패:', error.message);
}

// 환경 변수 확인
console.log('🔧 환경 변수 로드 상태:');
console.log('   GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID || '❌ 설정되지 않음');
console.log('   GOOGLE_INVENTORY_SHEET_ID:', process.env.GOOGLE_INVENTORY_SHEET_ID || '❌ 설정되지 않음');
console.log('   GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID || '❌ 설정되지 않음');

if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
  console.error('\n❌ 오류: .env 파일에 GOOGLE_SHEET_ID 및 GOOGLE_DRIVE_FOLDER_ID를 설정해주세요.');
  console.error('   .env 파일 위치:', envPath);
  process.exit(1);
}

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// 메모리 캐시
let products = [];
let imageMap = {};
let inventoryMap = {}; // SKU별 재고 정보

// Google Sheets 인증 설정
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
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
      const subCategory = row.get('Sub_Category') || '';
      
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

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    productsLoaded: products.length,
    imagesLoaded: Object.keys(imageMap).length
  });
});

// 서버 시작
initializeServer().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`📡 네트워크 접속: http://<내부IP>:${PORT}`);
  });
});
