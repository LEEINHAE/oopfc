import { json } from "@sveltejs/kit"
import { MISO_API_KEY } from "$env/static/private"
import {
	simulateOptimization,
	getErrorMessage
} from "$lib/google-drive.js"

/**
 * MISO 워크플로우 API를 활용한 최적화 API
 */

/**
 * 서버에서 MISO 워크플로우 API 호출 (CORS 문제 해결)
 */
async function optimizeWithMISOWorkflowServer(files, apiKey) {
	const workflowUrl = "https://api.holdings.miso.gs/ext/v1/workflows/run"

	try {
		console.log("📡 서버에서 MISO 워크플로우 API 호출 시작")
		console.log("📊 파일 개수:", files.length)

		// 1. 파일 데이터를 최소한의 정보로 압축하여 업로드
		const compactFiles = files.map((file) => ({
			id: file.id,
			name: file.name,
			mimeType: file.mimeType,
			parents: file.parents || []
		}))

		const jsonContent = JSON.stringify(compactFiles)
		const fileName = `drive-files-${Date.now()}.json`

		console.log("📤 파일 업로드 중...", fileName, `(${Math.round(jsonContent.length / 1024)}KB)`)
		const uploadResult = await uploadFileToMISOServer(jsonContent, fileName, apiKey)
		console.log("✅ 파일 업로드 완료:", uploadResult)

		let requestBody = {
			inputs: {
				input: {
					transfer_method: "local_file",
					upload_file_id: uploadResult.id,
					type: "document"
				}
			},
			mode: "blocking",
			user: "drive-optimizer"
		}

		console.log("📝 요청 본문:", {
			...requestBody,
			inputs: {
				...requestBody.inputs,
				input: { ...requestBody.inputs.input, upload_file_id: "..." }
			}
		})

		const response = await fetch(workflowUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				Accept: "application/json"
			},
			body: JSON.stringify(requestBody)
		})

		console.log("📡 응답 상태:", response.status, response.statusText)

		if (!response.ok) {
			const errorText = await response.text()
			const errorData = tryParseJSON(errorText)

			console.error("❌ MISO API 오류 상세:")
			console.error("- 상태 코드:", response.status)
			console.error("- 상태 텍스트:", response.statusText)
			console.error("- 오류 메시지:", errorData?.message || errorText)

			if (response.status === 502) {
				throw new Error(
					`서버 타임아웃 또는 과부하 (502): 파일이 너무 많거나 요청이 복잡합니다. 파일 수를 줄이거나 잠시 후 다시 시도해주세요.`
				)
			}

			throw new Error(`MISO API 오류 (${response.status}): ${errorData?.message || errorText}`)
		}

		return await handleWorkflowResponseServer(response)
	} catch (error) {
		console.error("❌ MISO 워크플로우 API 오류:", error)
		throw error
	}
}

/**
 * 서버에서 MISO API에 파일 업로드
 */
async function uploadFileToMISOServer(fileContent, fileName, apiKey) {
	const uploadUrl = "https://api.holdings.miso.gs/ext/v1/files/upload"

	const formData = new FormData()
	const blob = new Blob([fileContent], { type: "text/plain" })
	formData.append("file", blob, fileName.replace(".json", ".txt"))
	formData.append("user", "drive-optimizer")

	const response = await fetch(uploadUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`
		},
		body: formData
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(`파일 업로드 실패: ${response.status} ${response.statusText} - ${errorText}`)
	}

	const result = await response.json()
	console.log("📋 파일 업로드 응답:", result)
	return result
}

/**
 * 서버에서 워크플로우 응답 처리
 */
async function handleWorkflowResponseServer(response) {
	const result = await response.json()
	console.log("📋 MISO 워크플로우 응답:", result)

	const workflowData = result.data || result

	if (workflowData.status !== "succeeded") {
		throw new Error(`MISO 워크플로우 실행 실패: ${workflowData.error || "알 수 없는 오류"}`)
	}

	if (!workflowData.outputs) {
		throw new Error("MISO 워크플로우 응답에서 outputs를 찾을 수 없습니다.")
	}

	const outputs = workflowData.outputs
	let resultStr = outputs.result || outputs.output || outputs.answer

	if (!resultStr) {
		const outputValues = Object.values(outputs)
		if (outputValues.length > 0) {
			resultStr = outputValues[0]
		}
	}

	if (!resultStr) {
		throw new Error("MISO 워크플로우 응답에서 결과 데이터를 찾을 수 없습니다.")
	}

	console.log("🔍 MISO 응답 result 내용:", typeof resultStr, resultStr.substring(0, 200) + "...")

	let optimizedFiles

	try {
		optimizedFiles = JSON.parse(resultStr)
		console.log("✅ JSON 파싱 성공:", optimizedFiles.length, "개 항목")

		if (Array.isArray(optimizedFiles) && optimizedFiles.length > 0) {
			optimizedFiles = convertHierarchicalToFlatServer(optimizedFiles)
		}
	} catch (parseError) {
		console.warn("⚠️ 직접 JSON 파싱 실패, 문자열에서 JSON 추출 시도:", parseError.message)

		const patterns = [
			/\[[\s\S]*\]/,
			/```(?:json)?\s*([\s\S]*?)\s*```/,
			/(\{[\s\S]*\})/
		]

		for (const pattern of patterns) {
			const match = resultStr.match(pattern)
			if (match) {
				const jsonStr = pattern.toString().includes("```") ? match[1] : match[0]
				try {
					optimizedFiles = JSON.parse(jsonStr)
					console.log("✅ 패턴 매칭으로 JSON 파싱 성공:", optimizedFiles.length, "개 항목")

					if (Array.isArray(optimizedFiles) && optimizedFiles.length > 0) {
						optimizedFiles = convertHierarchicalToFlatServer(optimizedFiles)
					}
					break
				} catch (e) {
					console.warn("❌ 패턴 매칭 실패:", pattern, e.message)
					continue
				}
			}
		}

		if (!optimizedFiles) {
			throw new Error(
				`MISO 응답에서 유효한 JSON을 찾을 수 없습니다. 응답 타입: ${typeof resultStr}, 내용: ${resultStr.substring(0, 500)}`
			)
		}
	}

	if (!Array.isArray(optimizedFiles)) {
		throw new Error("MISO 응답이 배열 형태가 아닙니다.")
	}

	console.log(`✅ MISO 워크플로우 최적화 완료: ${optimizedFiles.length}개 파일`)
	return optimizedFiles
}

/**
 * 계층적 구조를 평면 배열로 변환 (서버용)
 */
function convertHierarchicalToFlatServer(hierarchicalData) {
	const flatFiles = []

	function traverse(items) {
		if (!Array.isArray(items)) return

		items.forEach((item) => {
			const flatItem = {
				id: item.id,
				name: item.name,
				mimeType: item.mimeType,
				parents: item.parents || []
			}
			
			if (item.createdTime) flatItem.createdTime = item.createdTime
			if (item.modifiedTime) flatItem.modifiedTime = item.modifiedTime
			if (item.webViewLink) flatItem.webViewLink = item.webViewLink
			if (item.size) flatItem.size = item.size

			flatFiles.push(flatItem)

			if (item.children && Array.isArray(item.children) && item.children.length > 0) {
				item.children.forEach((child) => {
					if (!child.parents) {
						child.parents = [item.id]
					}
				})
				traverse(item.children)
			}
		})
	}

	traverse(hierarchicalData)
	console.log(`📊 계층적 구조를 평면 배열로 변환: ${flatFiles.length}개 파일`)
	return flatFiles
}

/**
 * JSON 파싱을 안전하게 시도하는 헬퍼 함수
 */
function tryParseJSON(text) {
	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		console.log("🚀 MISO 워크플로우 최적화 API 요청 받음")

		const { files } = await request.json()

		// 요청 데이터 검증
		if (!files || !Array.isArray(files)) {
			return json(
				{
					error: "유효하지 않은 요청: files 배열이 필요합니다.",
					code: "INVALID_REQUEST"
				},
				{ status: 400 }
			)
		}

		console.log(`📄 분석할 파일 수: ${files.length}개`)

		// MISO API 키 확인
		const apiKey = MISO_API_KEY || process.env.MISO_API_KEY
		console.log("🔍 환경 변수 확인:", {
			MISO_API_KEY: apiKey ? `${apiKey.substring(0, 10)}...` : "없음",
			SvelteKit_환경변수: MISO_API_KEY ? "로드됨" : "없음",
			Process_환경변수: process.env.MISO_API_KEY ? "로드됨" : "없음"
		})
		
		if (!apiKey) {
			console.warn("⚠️ MISO API 키가 없어 로컬 시뮬레이션 사용")
			const optimizedFiles = simulateOptimization(files)

			return json({
				optimizedFiles: optimizedFiles,
				metadata: {
					aiModel: "Local-Simulation",
					processingTime: 1000,
					timestamp: new Date().toISOString(),
					originalFileCount: files.length,
					optimizedFileCount: optimizedFiles.length,
					fallbackReason: "MISO API 키가 설정되지 않음"
				}
			})
		}

		try {
			// 서버에서 MISO 워크플로우 API 호출
			const optimizedFiles = await optimizeWithMISOWorkflowServer(files, apiKey)

			const response = {
				optimizedFiles: optimizedFiles,
				metadata: {
					aiModel: "MISO-Workflow-API",
					timestamp: new Date().toISOString(),
					originalFileCount: files.length,
					optimizedFileCount: optimizedFiles.length
				}
			}

			console.log("✅ MISO 워크플로우 최적화 응답 전송 완료")
			return json(response)
		} catch (misoError) {
			console.warn("❌ MISO API 오류, 로컬 시뮬레이션으로 대체:", misoError.message)

			// MISO API 실패 시 로컬 시뮬레이션 사용
			const optimizedFiles = simulateOptimization(files)

			return json({
				optimizedFiles: optimizedFiles,
				metadata: {
					aiModel: "Local-Simulation-Fallback",
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
		console.error("❌ AI API 오류:", error)
		return json(
			{
				error: getErrorMessage(error) || "AI 최적화 처리 중 오류가 발생했습니다.",
				code: "AI_PROCESSING_ERROR",
				details: error.message
			},
			{ status: 500 }
		)
	}
}

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	const apiKey = MISO_API_KEY || process.env.MISO_API_KEY
	
	return json({
		status: "active",
		service: "MISO Workflow Optimization API",
		version: "2.0.0",
		timestamp: new Date().toISOString(),
		endpoint: "/api/optimize",
		hasApiKey: !!apiKey,
		fallbackMode: !apiKey ? "Local Simulation" : "MISO Workflow API",
		debug: {
			SvelteKit_환경변수: !!MISO_API_KEY,
			Process_환경변수: !!process.env.MISO_API_KEY
		}
	})
}
