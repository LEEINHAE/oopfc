import { json } from '@sveltejs/kit';
import { simulateOptimization, optimizeWithMISOWorkflow, getErrorMessage } from '$lib/google-drive.js';

/**
 * MISO 워크플로우 API를 활용한 최적화 API
 */

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		console.log('🚀 MISO 워크플로우 최적화 API 요청 받음')
		
		const { files } = await request.json()
		
		// 요청 데이터 검증
		if (!files || !Array.isArray(files)) {
			return json({
				error: '유효하지 않은 요청: files 배열이 필요합니다.',
				code: 'INVALID_REQUEST'
			}, { status: 400 })
		}
		
		console.log(`📄 분석할 파일 수: ${files.length}개`)
		
		// MISO API 키 확인
		const apiKey = process.env.MISO_API_KEY
		if (!apiKey) {
			console.warn('⚠️ MISO API 키가 없어 로컬 시뮬레이션 사용')
			const optimizedFiles = simulateOptimization(files)
			
			return json({
				optimizedFiles: optimizedFiles,
				metadata: {
					aiModel: 'Local-Simulation',
					processingTime: 1000,
					timestamp: new Date().toISOString(),
					originalFileCount: files.length,
					optimizedFileCount: optimizedFiles.length,
					fallbackReason: 'MISO API 키가 설정되지 않음'
				}
			})
		}
		
		try {
			// MISO 워크플로우 API 호출
			const optimizedFiles = await optimizeWithMISOWorkflow(files, apiKey)
			
			const response = {
				optimizedFiles: optimizedFiles,
				metadata: {
					aiModel: 'MISO-Workflow-API',
					timestamp: new Date().toISOString(),
					originalFileCount: files.length,
					optimizedFileCount: optimizedFiles.length
				}
			}
			
			console.log('✅ MISO 워크플로우 최적화 응답 전송 완료')
			return json(response)
			
		} catch (misoError) {
			console.warn('❌ MISO API 오류, 로컬 시뮬레이션으로 대체:', misoError.message)
			
			// MISO API 실패 시 로컬 시뮬레이션 사용
			const optimizedFiles = simulateOptimization(files)
			
			return json({
				optimizedFiles: optimizedFiles,
				metadata: {
					aiModel: 'Local-Simulation-Fallback',
					processingTime: 1000,
					timestamp: new Date().toISOString(),
					originalFileCount: files.length,
					optimizedFileCount: optimizedFiles.length,
					fallbackReason: getErrorMessage(misoError),
					originalError: misoError.message
				}
			})
		}
		
	} catch (error) {
		console.error('❌ AI API 오류:', error)
		return json({
			error: getErrorMessage(error) || 'AI 최적화 처리 중 오류가 발생했습니다.',
			code: 'AI_PROCESSING_ERROR',
			details: error.message
		}, { status: 500 })
	}
}


/** @type {import('./$types').RequestHandler} */
export async function GET() {
	return json({
		status: 'active',
		service: 'MISO Workflow Optimization API',
		version: '2.0.0',
		timestamp: new Date().toISOString(),
		endpoint: '/api/optimize',
		hasApiKey: !!process.env.MISO_API_KEY,
		fallbackMode: !process.env.MISO_API_KEY ? 'Local Simulation' : 'MISO Workflow API'
	})
}