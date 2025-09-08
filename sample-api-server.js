/**
 * Google Drive AI 최적화 API 서버 예시
 * 이 파일은 AI를 사용하여 Google Drive 폴더 구조를 최적화하는 API 서버의 예시입니다.
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/**
 * AI를 사용한 파일 구조 최적화 엔드포인트
 * POST /api/optimize
 */
app.post('/api/optimize', async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({
        error: 'Invalid input: files array is required'
      });
    }

    console.log(`🔍 받은 파일 수: ${files.length}개`);
    console.log(`📁 폴더 수: ${files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length}개`);

    // AI 최적화 로직 (여기서 OpenAI API, Claude API 등을 호출)
    const optimizedFiles = await optimizeFilesWithAI(files);

    // 변경 사항 분석
    const changes = analyzeChanges(files, optimizedFiles);

    res.json({
      optimizedFiles,
      message: "Structure optimized successfully",
      changes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('최적화 오류:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * AI를 사용하여 파일 구조를 최적화하는 함수
 * 실제로는 OpenAI API, Claude API, Gemini API 등을 사용
 */
async function optimizeFilesWithAI(files) {
  // 파일 정보를 AI에게 전달할 형태로 가공
  const filesSummary = files.map(file => ({
    id: file.id,
    name: file.name,
    type: getFileTypeDescription(file.mimeType),
    modifiedTime: file.modifiedTime,
    createdTime: file.createdTime,
    currentParent: file.parents?.[0] || 'root'
  }));

  // AI 프롬프트 예시
  const prompt = `
다음 Google Drive 파일들을 분석하여 더 효율적인 폴더 구조로 재정리해주세요:

파일 목록:
${JSON.stringify(filesSummary, null, 2)}

요구사항:
1. 파일 이름과 타입을 기반으로 논리적인 그룹 생성
2. 프로젝트, 날짜, 카테고리별로 폴더 구성
3. 자주 사용하는 파일은 접근하기 쉬운 위치에 배치
4. 기존 파일 ID는 유지하되 parents 필드만 수정
5. 필요시 새로운 폴더 생성 (새 폴더는 임시 ID 사용)

응답 형식: 원본과 동일한 Google Drive API 형식의 배열
`;

  // 여기서 실제 AI API를 호출합니다
  // 예: OpenAI GPT-4, Claude, Gemini 등
  console.log('🤖 AI에게 최적화 요청...');
  
  // 데모용 간단한 최적화 로직 (실제로는 AI API 호출)
  const optimized = await simulateAIOptimization(files);
  
  return optimized;
}

/**
 * AI 최적화 시뮬레이션 (데모용)
 * 실제 구현에서는 이 부분을 AI API 호출로 대체하세요
 */
async function simulateAIOptimization(files) {
  console.log('📝 AI 최적화 시뮬레이션 중...');
  
  // 파일 타입별 분류
  const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const documents = files.filter(f => f.mimeType === 'application/vnd.google-apps.document');
  const spreadsheets = files.filter(f => f.mimeType === 'application/vnd.google-apps.spreadsheet');
  const presentations = files.filter(f => f.mimeType === 'application/vnd.google-apps.presentation');
  const pdfs = files.filter(f => f.mimeType === 'application/pdf');
  const images = files.filter(f => f.mimeType?.startsWith('image/'));
  const others = files.filter(f => !folders.includes(f) && !documents.includes(f) && 
                                   !spreadsheets.includes(f) && !presentations.includes(f) && 
                                   !pdfs.includes(f) && !images.includes(f));

  const optimizedFiles = [...files]; // 복사본 생성

  // 새 폴더 생성 및 파일 재배치 로직
  const newFolders = [];
  const currentYear = new Date().getFullYear();
  
  // 1. 문서 폴더 생성 (문서가 3개 이상인 경우)
  if (documents.length > 3) {
    const docFolderId = `temp_documents_${currentYear}`;
    newFolders.push({
      id: docFolderId,
      name: '📝 문서',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      webViewLink: null // 새 폴더이므로 null
    });
    
    documents.forEach(doc => {
      doc.parents = [docFolderId];
    });
  }

  // 2. 스프레드시트 폴더 생성
  if (spreadsheets.length > 2) {
    const sheetFolderId = `temp_spreadsheets_${currentYear}`;
    newFolders.push({
      id: sheetFolderId,
      name: '📊 스프레드시트',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      webViewLink: null
    });
    
    spreadsheets.forEach(sheet => {
      sheet.parents = [sheetFolderId];
    });
  }

  // 3. 이미지 폴더 생성 (다층 구조 예시)
  if (images.length > 5) {
    const mediaFolderId = `temp_media_${currentYear}`;
    const imagesFolderId = `temp_images_${currentYear}`;
    
    // 부모 미디어 폴더
    newFolders.push({
      id: mediaFolderId,
      name: '🎨 미디어',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      webViewLink: null
    });
    
    // 자식 이미지 폴더
    newFolders.push({
      id: imagesFolderId,
      name: '🖼️ 이미지',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [mediaFolderId], // 부모를 임시 ID로 참조
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      webViewLink: null
    });
    
    images.forEach(img => {
      img.parents = [imagesFolderId];
    });
  }

  // 4. 오래된 파일 아카이브 폴더
  const oldFiles = files.filter(f => {
    const fileDate = new Date(f.modifiedTime);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return fileDate < oneYearAgo;
  });

  if (oldFiles.length > 10) {
    const archiveFolderId = `temp_archive_${currentYear - 1}`;
    newFolders.push({
      id: archiveFolderId,
      name: `📦 아카이브 ${currentYear - 1}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      webViewLink: null
    });
    
    oldFiles.forEach(file => {
      file.parents = [archiveFolderId];
    });
  }

  console.log(`📁 생성할 새 폴더: ${newFolders.length}개`);
  console.log(`📝 새 폴더 ID 예시: ${newFolders.map(f => f.id).join(', ')}`);
  
  return [...optimizedFiles, ...newFolders];
}

/**
 * 파일 타입 설명 반환
 */
function getFileTypeDescription(mimeType) {
  const typeMap = {
    'application/vnd.google-apps.folder': 'Folder',
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/pdf': 'PDF Document',
    'text/plain': 'Text File'
  };

  if (typeMap[mimeType]) return typeMap[mimeType];
  if (mimeType?.startsWith('image/')) return 'Image';
  if (mimeType?.startsWith('video/')) return 'Video';
  if (mimeType?.startsWith('audio/')) return 'Audio';
  
  return 'File';
}

/**
 * 변경 사항 분석
 */
function analyzeChanges(originalFiles, optimizedFiles) {
  const originalCount = originalFiles.length;
  const optimizedCount = optimizedFiles.length;
  const newFolders = optimizedCount - originalCount;
  
  let movedFiles = 0;
  originalFiles.forEach(originalFile => {
    const optimizedFile = optimizedFiles.find(f => f.id === originalFile.id);
    if (optimizedFile && JSON.stringify(originalFile.parents) !== JSON.stringify(optimizedFile.parents)) {
      movedFiles++;
    }
  });

  return {
    filesReorganized: movedFiles,
    foldersCreated: newFolders,
    totalFiles: originalCount
  };
}

/**
 * 건강 체크 엔드포인트
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * API 정보 엔드포인트
 */
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Google Drive AI Optimizer API',
    version: '1.0.0',
    endpoints: {
      'POST /api/optimize': 'AI를 사용하여 파일 구조 최적화',
      'GET /health': '서버 상태 확인',
      'GET /api/info': 'API 정보 확인'
    },
    requirements: {
      input: {
        files: 'Google Drive API files 배열'
      },
      output: {
        optimizedFiles: '최적화된 파일 구조 배열',
        message: '처리 결과 메시지',
        changes: '변경 사항 요약'
      }
    }
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Google Drive AI Optimizer API Server`);
  console.log(`📡 포트: ${PORT}`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
  console.log(`📖 API Info: http://localhost:${PORT}/api/info`);
  console.log(`🤖 Optimize: POST http://localhost:${PORT}/api/optimize`);
  console.log('');
  console.log('💡 실제 구현시 고려사항:');
  console.log('   - OpenAI/Claude API 키 설정');
  console.log('   - 레이트 리미팅 추가');
  console.log('   - 사용자 인증 구현');
  console.log('   - 로깅 및 모니터링 설정');
  console.log('   - 에러 처리 강화');
});

module.exports = app;