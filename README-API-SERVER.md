# Google Drive AI Optimizer API Server

Google Drive 파일 구조를 AI로 최적화하는 API 서버입니다.

## 📋 개요

이 API는 Google Drive의 파일 목록을 받아서 AI(GPT-4, Claude 등)를 사용하여 더 효율적인 폴더 구조로 재정리하는 기능을 제공합니다.

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
# package.json을 package-api-server.json으로 복사
cp package-api-server.json package.json

# 의존성 설치
npm install
```

### 2. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

서버가 `http://localhost:3001`에서 실행됩니다.

## 📡 API 엔드포인트

### POST /api/optimize

Google Drive 파일 구조를 AI로 최적화합니다.

**요청 예시:**
```json
{
  "files": [
    {
      "id": "1ABC123...",
      "name": "프로젝트 계획서.docx",
      "mimeType": "application/vnd.google-apps.document",
      "parents": ["root"],
      "modifiedTime": "2024-01-01T12:00:00.000Z",
      "createdTime": "2024-01-01T10:00:00.000Z",
      "size": "1024",
      "webViewLink": "https://docs.google.com/..."
    }
  ]
}
```

**응답 예시:**
```json
{
  "optimizedFiles": [
    {
      "id": "1ABC123...",
      "name": "프로젝트 계획서.docx",
      "mimeType": "application/vnd.google-apps.document",
      "parents": ["temp_documents_2024"],
      "modifiedTime": "2024-01-01T12:00:00.000Z",
      "createdTime": "2024-01-01T10:00:00.000Z",
      "size": "1024",
      "webViewLink": "https://docs.google.com/..."
    },
    {
      "id": "temp_documents_2024",
      "name": "📝 문서",
      "mimeType": "application/vnd.google-apps.folder",
      "parents": ["root"],
      "createdTime": "2024-01-01T15:00:00.000Z",
      "modifiedTime": "2024-01-01T15:00:00.000Z",
      "webViewLink": null
    },
    {
      "id": "temp_media_2024",
      "name": "🎨 미디어",
      "mimeType": "application/vnd.google-apps.folder", 
      "parents": ["root"],
      "createdTime": "2024-01-01T15:00:00.000Z",
      "modifiedTime": "2024-01-01T15:00:00.000Z",
      "webViewLink": null
    },
    {
      "id": "temp_images_2024",
      "name": "🖼️ 이미지",
      "mimeType": "application/vnd.google-apps.folder",
      "parents": ["temp_media_2024"],
      "createdTime": "2024-01-01T15:00:00.000Z", 
      "modifiedTime": "2024-01-01T15:00:00.000Z",
      "webViewLink": null
    }
  ],
  "message": "Structure optimized successfully",
  "changes": {
    "filesReorganized": 1,
    "foldersCreated": 3,
    "totalFiles": 1
  },
  "timestamp": "2024-01-01T15:00:00.000Z"
}
```

### GET /health

서버 상태를 확인합니다.

### GET /api/info

API 정보를 확인합니다.

## 🆔 새 폴더 ID 처리 방식

### 문제
AI가 새로운 폴더를 생성하도록 최적화할 경우, 아직 Google Drive에 존재하지 않는 폴더의 ID를 어떻게 처리할까요?

### 해결책
**임시 ID (Temporary ID) 방식**을 사용합니다:

1. **AI 응답**: 새 폴더는 `temp_` 접두사가 붙은 임시 ID 사용
   ```json
   {
     "id": "temp_documents_2024",
     "name": "📝 문서", 
     "mimeType": "application/vnd.google-apps.folder",
     "parents": ["root"],
     "webViewLink": null
   }
   ```

2. **클라이언트 처리**: 
   - 임시 ID를 가진 폴더들을 먼저 Google Drive에 실제 생성
   - 실제 생성된 폴더의 진짜 ID를 받아옴
   - 임시 ID → 실제 ID 매핑 테이블 생성
   - 파일 이동 시 임시 ID를 실제 ID로 변환

3. **중첩 폴더 처리**:
   ```json
   [
     {
       "id": "temp_media_2024",
       "name": "미디어",
       "parents": ["root"]
     },
     {
       "id": "temp_images_2024", 
       "name": "이미지",
       "parents": ["temp_media_2024"]  // 부모도 임시 ID 참조
     }
   ]
   ```

### 임시 ID 명명 규칙

```
temp_[category]_[optional_suffix]
```

**예시:**
- `temp_documents_2024`
- `temp_images_folder` 
- `temp_archive_old_files`
- `temp_project_work`
- `temp_media_videos`

## 🤖 AI 구현 가이드

현재 코드에는 시뮬레이션 로직이 포함되어 있습니다. 실제 AI를 구현하려면:

### 1. OpenAI API 사용 예시

```javascript
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function optimizeFilesWithAI(files) {
  const prompt = `다음 Google Drive 파일들을 효율적으로 정리해주세요: ${JSON.stringify(files)}`;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system", 
        content: "당신은 파일 정리 전문가입니다. Google Drive 파일 구조를 최적화하세요."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### 2. Claude API 사용 예시

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function optimizeFilesWithAI(files) {
  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `파일 구조를 최적화해주세요: ${JSON.stringify(files)}`
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

## 🔧 환경 변수 설정

`.env` 파일을 생성하고 필요한 API 키를 설정하세요:

```env
PORT=3001
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_claude_api_key_here
```

## 📦 추가 패키지

AI API를 사용하려면 추가 패키지를 설치하세요:

```bash
# OpenAI
npm install openai

# Claude
npm install @anthropic-ai/sdk

# 환경 변수 관리
npm install dotenv
```

## 🧪 테스트

프론트엔드에서 생성한 예시 데이터를 사용하여 API를 테스트할 수 있습니다:

```bash
curl -X POST http://localhost:3001/api/optimize \
  -H "Content-Type: application/json" \
  -d @drive-ai-api-example-2024-01-01.json
```

## 🚨 주의사항

1. **레이트 리미팅**: AI API 호출 제한을 고려하세요
2. **비용 관리**: AI API 사용량을 모니터링하세요
3. **에러 처리**: AI API 실패 시 대체 로직을 구현하세요
4. **보안**: API 키를 안전하게 관리하세요
5. **로깅**: 요청/응답을 적절히 로깅하세요

## 🎯 최적화 전략

AI에게 다음과 같은 최적화 전략을 지시할 수 있습니다:

1. **타입별 분류**: 문서, 스프레드시트, 이미지 등
2. **날짜별 정리**: 오래된 파일을 아카이브 폴더로
3. **프로젝트별 그룹**: 파일명에서 프로젝트 패턴 인식
4. **접근 빈도**: 자주 사용하는 파일을 상위 폴더에
5. **크기별 정리**: 큰 파일들을 별도 폴더에

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. 서버 로그 확인
2. API 키 유효성 확인  
3. 네트워크 연결 상태
4. 요청 데이터 형식