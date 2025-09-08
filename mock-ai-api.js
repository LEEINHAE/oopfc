/**
 * 가상 AI 최적화 API 서버
 * Google Drive 파일 구조 최적화를 위한 Mock API
 */

import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

// CORS 설정
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())

// AI 최적화 시뮬레이션 함수 (simulateOptimization과 동일한 로직)
function simulateAIOptimization(files) {
    console.log(`🤖 AI 최적화 요청: ${files.length}개 파일 분석 시작...`)
    
    // 깊은 복사로 파일 객체들을 복사
    const optimizedFiles = files.map(file => ({
        ...file,
        parents: file.parents ? [...file.parents] : ['root'],
        children: []
    }))
    
    const newFolders = []
    const currentYear = new Date().getFullYear()
    
    // 파일 타입별 분류
    const folders = optimizedFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
    const documents = optimizedFiles.filter(f => f.mimeType === 'application/vnd.google-apps.document')
    const spreadsheets = optimizedFiles.filter(f => f.mimeType === 'application/vnd.google-apps.spreadsheet')
    const presentations = optimizedFiles.filter(f => f.mimeType === 'application/vnd.google-apps.presentation')
    const pdfs = optimizedFiles.filter(f => f.mimeType === 'application/pdf')
    const images = optimizedFiles.filter(f => f.mimeType?.startsWith('image/'))
    const videos = optimizedFiles.filter(f => f.mimeType?.startsWith('video/'))
    const otherFiles = optimizedFiles.filter(f => 
        f.mimeType !== 'application/vnd.google-apps.folder' &&
        f.mimeType !== 'application/vnd.google-apps.document' &&
        f.mimeType !== 'application/vnd.google-apps.spreadsheet' &&
        f.mimeType !== 'application/vnd.google-apps.presentation' &&
        f.mimeType !== 'application/pdf' &&
        !f.mimeType?.startsWith('image/') &&
        !f.mimeType?.startsWith('video/')
    )
    
    console.log(`📊 AI 분석 결과: 문서${documents.length}, 시트${spreadsheets.length}, 이미지${images.length}, 기타${otherFiles.length}개`)
    
    // AI가 제안하는 스마트한 워크스페이스 구조
    const workspaceFolderId = `temp_ai_workspace_${currentYear}`
    newFolders.push({
        id: workspaceFolderId,
        name: '🧠 AI 추천 워크스페이스',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
        webViewLink: null,
        children: []
    })
    
    // 1. 문서 폴더 - AI가 더 구체적인 이름 제안
    if (documents.length >= 1) {
        const docFolderId = `temp_ai_documents_${currentYear}`
        newFolders.push({
            id: docFolderId,
            name: '📋 문서 및 보고서',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workspaceFolderId],
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: null,
            children: []
        })
        
        documents.forEach(doc => {
            doc.parents = [docFolderId]
        })
    }
    
    // 2. 데이터 분석 폴더 - AI의 스마트한 네이밍
    if (spreadsheets.length >= 1) {
        const sheetFolderId = `temp_ai_analytics_${currentYear}`
        newFolders.push({
            id: sheetFolderId,
            name: '📈 데이터 분석 및 리포트',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workspaceFolderId],
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: null,
            children: []
        })
        
        spreadsheets.forEach(sheet => {
            sheet.parents = [sheetFolderId]
        })
    }
    
    // 3. 프레젠테이션 폴더
    if (presentations.length >= 1) {
        const presentationFolderId = `temp_ai_presentations_${currentYear}`
        newFolders.push({
            id: presentationFolderId,
            name: '🎯 프레젠테이션 및 발표자료',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workspaceFolderId],
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: null,
            children: []
        })
        
        presentations.forEach(pres => {
            pres.parents = [presentationFolderId]
        })
    }
    
    // 4. PDF 아카이브
    if (pdfs.length >= 1) {
        const pdfFolderId = `temp_ai_pdf_archive_${currentYear}`
        newFolders.push({
            id: pdfFolderId,
            name: '📚 PDF 아카이브',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workspaceFolderId],
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: null,
            children: []
        })
        
        pdfs.forEach(pdf => {
            pdf.parents = [pdfFolderId]
        })
    }
    
    // 5. 크리에이티브 자료 (이미지/비디오)
    if (images.length >= 1 || videos.length >= 1) {
        const creativeFolderId = `temp_ai_creative_${currentYear}`
        newFolders.push({
            id: creativeFolderId,
            name: '🎨 크리에이티브 자료',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workspaceFolderId],
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: null,
            children: []
        })
        
        // 이미지 하위 폴더
        if (images.length >= 1) {
            const imagesFolderId = `temp_ai_images_${currentYear}`
            newFolders.push({
                id: imagesFolderId,
                name: '🖼️ 이미지 갤러리',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [creativeFolderId],
                createdTime: new Date().toISOString(),
                modifiedTime: new Date().toISOString(),
                webViewLink: null,
                children: []
            })
            
            images.forEach(img => {
                img.parents = [imagesFolderId]
            })
        }
        
        // 비디오 하위 폴더
        if (videos.length >= 1) {
            const videosFolderId = `temp_ai_videos_${currentYear}`
            newFolders.push({
                id: videosFolderId,
                name: '🎬 비디오 컬렉션',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [creativeFolderId],
                createdTime: new Date().toISOString(),
                modifiedTime: new Date().toISOString(),
                webViewLink: null,
                children: []
            })
            
            videos.forEach(video => {
                video.parents = [videosFolderId]
            })
        }
    }
    
    // 6. 기타 파일들을 위한 임시 보관함
    if (otherFiles.length >= 1) {
        const miscFolderId = `temp_ai_misc_${currentYear}`
        newFolders.push({
            id: miscFolderId,
            name: '📦 기타 파일 보관함',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workspaceFolderId],
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: null,
            children: []
        })
        
        otherFiles.forEach(file => {
            file.parents = [miscFolderId]
        })
    }
    
    // 7. 기존 폴더들도 정리된 구조로 이동
    const rootFolders = folders.filter(f => f.parents?.includes('root') || !f.parents?.length)
    if (rootFolders.length > 0) {
        const existingFolderId = `temp_ai_existing_${currentYear}`
        newFolders.push({
            id: existingFolderId,
            name: '📁 기존 폴더 정리함',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [workspaceFolderId],
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: null,
            children: []
        })
        
        rootFolders.forEach(folder => {
            folder.parents = [existingFolderId]
        })
    }
    
    console.log(`🧠 AI 최적화 완료: ${newFolders.length}개의 새 폴더 생성 계획`)
    
    return [...optimizedFiles, ...newFolders]
}

// AI 최적화 API 엔드포인트
app.post('/optimize', async (req, res) => {
    try {
        console.log('🚀 AI 최적화 API 요청 받음')
        
        // 요청 데이터 검증
        if (!req.body.files || !Array.isArray(req.body.files)) {
            return res.status(400).json({
                error: '유효하지 않은 요청: files 배열이 필요합니다.',
                code: 'INVALID_REQUEST'
            })
        }
        
        const files = req.body.files
        console.log(`📄 분석할 파일 수: ${files.length}개`)
        
        // AI 처리 시뮬레이션을 위한 지연 (1-3초)
        const processingTime = Math.random() * 2000 + 1000
        console.log(`⏱️ AI 처리 시간: ${Math.round(processingTime)}ms`)
        
        await new Promise(resolve => setTimeout(resolve, processingTime))
        
        // AI 최적화 실행
        const optimizedFiles = simulateAIOptimization(files)
        
        // API 응답
        const response = {
            success: true,
            message: 'AI 최적화 완료',
            optimizedFiles: optimizedFiles,
            metadata: {
                originalFileCount: files.length,
                optimizedFileCount: optimizedFiles.length,
                newFoldersCount: optimizedFiles.filter(f => f.id.startsWith('temp_')).length,
                processingTime: Math.round(processingTime),
                aiModel: 'Claude-3.5-Sonnet-Simulation',
                timestamp: new Date().toISOString()
            },
            changes: {
                filesReorganized: files.filter(f => !f.mimeType.includes('folder')).length,
                foldersCreated: optimizedFiles.filter(f => f.id.startsWith('temp_')).length,
                totalFiles: optimizedFiles.length
            }
        }
        
        console.log('✅ AI 최적화 응답 전송 완료')
        res.json(response)
        
    } catch (error) {
        console.error('❌ AI API 오류:', error)
        res.status(500).json({
            error: 'AI 최적화 처리 중 오류가 발생했습니다.',
            code: 'AI_PROCESSING_ERROR',
            details: error.message
        })
    }
})

// API 상태 확인 엔드포인트
app.get('/status', (req, res) => {
    res.json({
        status: 'active',
        service: 'Mock AI Optimization API',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})

// 서버 시작
app.listen(PORT, () => {
    console.log(`
🤖 Mock AI Optimization API 서버 시작됨
📡 URL: http://localhost:${PORT}
🔗 최적화 엔드포인트: http://localhost:${PORT}/optimize
📊 상태 확인: http://localhost:${PORT}/status

테스트 방법:
1. 프론트엔드에서 AI API URL 입력: http://localhost:${PORT}/optimize
2. "AI로 구조 최적화" 버튼 클릭
3. 실시간 파일 이동 로그 확인
    `)
})

// 우아한 종료 처리
process.on('SIGINT', () => {
    console.log('\n🛑 Mock AI API 서버를 종료합니다...')
    process.exit(0)
})