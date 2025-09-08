# Google Drive AI 구조 최적화 도구

MISO AI API를 활용한 Google Drive 파일 구조 최적화 서비스입니다.

## 주요 기능

- 🗂️ Google Drive 연동 및 파일 탐색
- 🤖 MISO AI를 통한 스마트 파일 구조 최적화
- 📊 최적화 전후 구조 비교 및 미리보기
- 🚀 실시간 파일 이동 및 폴더 생성

## 환경 설정

1. `.env` 파일을 생성하고 API 키를 설정하세요:

```bash
cp .env.example .env
```

2. `.env` 파일에서 다음 값들을 설정하세요:

```env
# MISO AI API 설정
VITE_MISO_API_URL=https://api.holdings.miso.gs/ext/v1/chat
VITE_MISO_API_KEY=app-bSZGH0mzGfJMpXsZNB0VQrh5

# Google Drive API 설정
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## Google Drive API 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Google Drive API 활성화
3. OAuth 2.0 클라이언트 ID 생성
4. 승인된 JavaScript 원본에 `http://localhost:5173` 추가
5. 클라이언트 ID를 `.env` 파일에 설정

## MISO AI API 사용

이 프로젝트는 MISO AI API를 사용하여 Google Drive 파일 구조를 최적화합니다:

- **API 엔드포인트**: `https://api.holdings.miso.gs/ext/v1/chat`
- **API 키**: `app-bSZGH0mzGfJMpXsZNB0VQrh5`

### API 사용 방식

1. **파일 업로드**: Google Drive 파일 데이터를 JSON 형태로 MISO API에 업로드
2. **AI 분석**: 업로드된 파일을 참조하여 구조 최적화 요청

#### 파일 업로드 API

```bash
POST https://api.holdings.miso.gs/ext/v1/files/upload
Authorization: Bearer {API_KEY}
Content-Type: multipart/form-data

file: drive-files.json
```

#### AI 분석 API 요청 형식

```json
{
	"inputs": {
		"file": []
	},
	"query": "업로드된 JSON 파일에 포함된 Google Drive 파일들을 분석하여 더 나은 폴더 구조로 최적화해주세요.",
	"mode": "blocking",
	"conversation_id": "",
	"user": "drive-optimizer",
	"files": [
		{
			"type": "file",
			"transfer_method": "local_file",
			"upload_file_id": "{업로드된_파일_ID}"
		}
	]
}
```

## 개발 시작하기

1. 의존성 설치:

```bash
npm install
```

2. 개발 서버 시작:

```bash
npm run dev
```

3. 브라우저에서 `http://localhost:5173` 접속

## 사용 방법

1. **Google Drive 연결**: "Google Drive 연결" 버튼으로 Google 계정 인증
2. **파일 로드**: "평면 뷰 (전체 로드)" 모드로 전환하여 모든 파일 로드
3. **API 키 입력**: MISO API 키 입력 또는 "🔑 API 키" 버튼으로 기본값 사용
4. **AI 최적화**: "🤖 MISO AI로 구조 최적화" 버튼 클릭
5. **결과 확인**: 최적화 결과를 미리보고 실제 적용

## 빌드

프로덕션 빌드:

```bash
npm run build
```

프로덕션 미리보기:

```bash
npm run preview
```

## 기술 스택

- **Frontend**: SvelteKit 5, JavaScript
- **AI API**: MISO Holdings AI Service
- **Cloud API**: Google Drive API v3
- **Build Tool**: Vite
