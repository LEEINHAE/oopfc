/**
 * Google Drive API 설정 및 유틸리티 함수
 */

export const GOOGLE_CONFIG = {
	CLIENT_ID:
		import.meta.env.VITE_GOOGLE_CLIENT_ID ||
		"1043069549793-ctab8odq0rvcub02olssh3ajt08b226l.apps.googleusercontent.com",
	DISCOVERY_DOC: "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
	SCOPES: "https://www.googleapis.com/auth/drive"
}

/**
 * Google API 스크립트 로드
 */
export function loadGoogleScripts() {
	return Promise.all([
		loadScript("https://apis.google.com/js/api.js"),
		loadScript("https://accounts.google.com/gsi/client")
	])
}

/**
 * 스크립트 동적 로드 헬퍼
 */
function loadScript(src) {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve()
			return
		}
		const script = document.createElement("script")
		script.src = src
		script.onload = resolve
		script.onerror = reject
		document.head.appendChild(script)
	})
}

/**
 * Google API 클라이언트 초기화
 */
export async function initializeGoogleAPI() {
	return new Promise((resolve, reject) => {
		window.gapi.load("client", async () => {
			try {
				await window.gapi.client.init({
					discoveryDocs: [GOOGLE_CONFIG.DISCOVERY_DOC]
				})
				resolve() // 초기화 완료 시 resolve
			} catch (error) {
				reject(error) // 에러 발생 시 reject
			}
		})
	})
}

/**
 * OAuth 토큰 클라이언트 생성
 */
export function createTokenClient(callback) {
	return window.google.accounts.oauth2.initTokenClient({
		client_id: GOOGLE_CONFIG.CLIENT_ID,
		scope: GOOGLE_CONFIG.SCOPES,
		callback: callback
	})
}

/**
 * Google Drive 파일 목록 가져오기
 */
export async function fetchDriveFiles(options = {}) {
	const { pageSize = 50, orderBy = "modifiedTime desc", q = null } = options

	// 루트 디렉토리의 파일들만 가져오기
	let query = "'root' in parents and trashed=false and 'me' in owners"
	if (q) {
		query += ` and (${q})`
	}

	const response = await window.gapi.client.drive.files.list({
		pageSize,
		fields: "files(id, name, mimeType, parents, modifiedTime, createdTime, size, webViewLink)",
		orderBy,
		q: query
	})
	return response.result.files || []
}

/**
 * Google Drive의 모든 파일을 한번에 가져오기
 */
export async function fetchAllDriveFiles(options = {}) {
	const { pageSize = 1000, orderBy = "name" } = options
	const allFiles = []
	let nextPageToken = null

	do {
		const params = {
			pageSize,
			fields: "files(id, name, mimeType, parents, modifiedTime, createdTime, size, webViewLink)",
			orderBy,
			q: "trashed=false and 'me' in owners"
		}

		if (nextPageToken) {
			params.pageToken = nextPageToken
		}

		const response = await window.gapi.client.drive.files.list(params)
		const files = response.result.files || []

		allFiles.push(...files)
		nextPageToken = response.result.nextPageToken
	} while (nextPageToken)

	return allFiles
}

/**
 * 파일 목록을 트리 구조로 정리하고 정렬
 */
export function organizeFilesAsTree(files) {
	const fileMap = new Map()
	const rootFiles = []

	// 모든 파일을 ID로 매핑
	files.forEach((file) => {
		file.children = []
		fileMap.set(file.id, file)
	})

	// 부모-자식 관계 설정
	files.forEach((file) => {
		if (file.parents && file.parents.length > 0) {
			const parentId = file.parents[0]
			if (parentId === "root" || !fileMap.has(parentId)) {
				// 루트 파일이거나 부모가 없는 경우
				rootFiles.push(file)
			} else {
				// 부모 파일의 children에 추가
				const parent = fileMap.get(parentId)
				parent.children.push(file)
			}
		} else {
			// parents 정보가 없는 경우 루트로 처리
			rootFiles.push(file)
		}
	})

	// 모든 레벨에서 폴더 우선, 이름순 정렬
	function sortFiles(fileList) {
		return fileList.sort((a, b) => {
			const aIsFolder = isFolder(a.mimeType)
			const bIsFolder = isFolder(b.mimeType)

			// 폴더가 아닌 파일보다 폴더를 우선
			if (aIsFolder && !bIsFolder) return -1
			if (!aIsFolder && bIsFolder) return 1

			// 같은 타입이면 이름순 정렬
			return a.name.localeCompare(b.name)
		})
	}

	// 재귀적으로 모든 children 정렬
	function sortAllChildren(fileList) {
		const sorted = sortFiles(fileList)
		sorted.forEach((file) => {
			if (file.children && file.children.length > 0) {
				file.children = sortAllChildren(file.children)
			}
		})
		return sorted
	}

	return {
		rootFiles: sortAllChildren(rootFiles),
		fileMap
	}
}

/**
 * 특정 폴더의 파일 목록 가져오기
 */
export async function fetchFolderFiles(folderId, options = {}) {
	const { pageSize = 50, orderBy = "modifiedTime desc" } = options

	const response = await window.gapi.client.drive.files.list({
		pageSize,
		fields: "files(id, name, mimeType, parents, modifiedTime, createdTime, size, webViewLink)",
		orderBy,
		q: `'${folderId}' in parents and trashed=false`
	})
	return response.result.files || []
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes) {
	if (!bytes || bytes === "0") return "N/A"
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
	const i = Math.floor(Math.log(bytes) / Math.log(1024))
	return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
}

/**
 * 날짜 포맷팅
 */
export function formatDate(dateString) {
	if (!dateString) return "N/A"
	return new Date(dateString).toLocaleString("ko-KR")
}

/**
 * MIME 타입에 따른 파일 아이콘 반환
 */
export function getFileIcon(mimeType) {
	if (!mimeType) return "📄"

	const iconMap = {
		"application/vnd.google-apps.folder": "📁",
		"application/vnd.google-apps.document": "📝",
		"application/vnd.google-apps.spreadsheet": "📊",
		"application/vnd.google-apps.presentation": "📽️",
		"application/pdf": "📄",
		"text/plain": "📝",
		"text/csv": "📊"
	}

	// 정확한 매치 확인
	if (iconMap[mimeType]) {
		return iconMap[mimeType]
	}

	// 카테고리별 매치
	if (mimeType.startsWith("image/")) return "🖼️"
	if (mimeType.startsWith("video/")) return "🎥"
	if (mimeType.startsWith("audio/")) return "🎵"
	if (mimeType.includes("document")) return "📝"
	if (mimeType.includes("spreadsheet")) return "📊"
	if (mimeType.includes("presentation")) return "📽️"
	if (mimeType.includes("archive") || mimeType.includes("zip")) return "📦"

	return "📄"
}

/**
 * 폴더인지 확인
 */
export function isFolder(mimeType) {
	return mimeType === "application/vnd.google-apps.folder"
}

/**
 * 새 폴더 생성
 */
export async function createFolder(name, parentId = "root") {
	const response = await window.gapi.client.drive.files.create({
		resource: {
			name: name,
			mimeType: "application/vnd.google-apps.folder",
			parents: [parentId]
		}
	})
	return response.result
}

/**
 * 파일 또는 폴더 이동 (최적화된 버전)
 */
export async function moveFile(fileId, newParentId, oldParentId = null) {
	try {
		// oldParentId가 없으면 API 호출로 조회
		if (!oldParentId) {
			const fileInfo = await window.gapi.client.drive.files.get({
				fileId: fileId,
				fields: "parents"
			})
			oldParentId = fileInfo.result.parents?.[0]
		}

		// 실제 파일 이동 (단일 API 호출)
		const response = await window.gapi.client.drive.files.update({
			fileId: fileId,
			addParents: newParentId,
			removeParents: oldParentId,
			fields: "id, name, parents"
		})
		return response.result
	} catch (error) {
		console.error(`파일 이동 실패: ${fileId}`, error)
		throw error
	}
}

/**
 * 여러 파일의 부모 정보를 한 번에 조회 (배치 최적화)
 */
export async function getFileParents(fileIds) {
	const parentMap = new Map()

	// 병렬로 모든 파일의 부모 정보 조회
	const parentPromises = fileIds.map(async (fileId) => {
		try {
			const fileInfo = await window.gapi.client.drive.files.get({
				fileId: fileId,
				fields: "parents"
			})
			return { fileId, parentId: fileInfo.result.parents?.[0] }
		} catch (error) {
			console.warn(`파일 부모 조회 실패: ${fileId}`, error)
			return { fileId, parentId: null }
		}
	})

	const results = await Promise.all(parentPromises)
	results.forEach(({ fileId, parentId }) => {
		parentMap.set(fileId, parentId)
	})

	return parentMap
}

/**
 * MISO 워크플로우 API를 통한 파일 구조 최적화
 */
export async function optimizeWithMISOWorkflow(files, apiKey) {
	const workflowUrl = "https://api.holdings.miso.gs/ext/v1/workflows/run"

	try {
		console.log("📡 MISO 워크플로우 API 호출 시작")
		console.log("📊 파일 개수:", files.length)

		// 1. 파일 데이터를 압축된 JSON으로 변환하여 업로드
		const compactFiles = files.map(file => ({
			id: file.id,
			name: file.name,
			mimeType: file.mimeType,
			parents: file.parents || [],
			modifiedTime: file.modifiedTime,
			size: file.size
		}))
		
		const jsonContent = JSON.stringify(compactFiles) // 압축 형식
		const fileName = `drive-files-${Date.now()}.json`

		console.log("📤 파일 업로드 중...", fileName, `(${Math.round(jsonContent.length / 1024)}KB)`)
		const uploadResult = await uploadFileToMISO(jsonContent, fileName, apiKey)
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

		console.log("📝 요청 본문:", { ...requestBody, inputs: { ...requestBody.inputs, input: { ...requestBody.inputs.input, upload_file_id: "..." } } })

		const response = await fetch(workflowUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"Accept": "application/json"
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
			
			// 502 Bad Gateway는 보통 서버 타임아웃이나 과부하
			if (response.status === 502) {
				throw new Error(`서버 타임아웃 또는 과부하 (502): 파일이 너무 많거나 요청이 복잡합니다. 파일 수를 줄이거나 잠시 후 다시 시도해주세요.`)
			}

			throw new Error(`MISO API 오류 (${response.status}): ${errorData?.message || errorText}`)
		}

		return await handleWorkflowResponse(response)
	} catch (error) {
		console.error("❌ MISO 워크플로우 API 오류:", error)
		
		// CORS 오류 감지 및 친화적 메시지
		if (error.message.includes("NetworkError") || error.message.includes("CORS")) {
			throw new Error("네트워크 연결 오류 또는 CORS 정책으로 인한 차단입니다. 브라우저의 CORS 확장 프로그램을 사용하거나 서버 설정을 확인해주세요.")
		}
		
		throw error
	}
}

/**
 * 워크플로우 응답 처리 헬퍼 함수
 */
async function handleWorkflowResponse(response) {
	const result = await response.json()
	console.log("📋 MISO 워크플로우 응답:", result)

	// 새로운 MISO API 응답 형식 처리
	const workflowData = result.data || result

	// 워크플로우 응답 검증
	if (workflowData.status !== "succeeded") {
		throw new Error(`MISO 워크플로우 실행 실패: ${workflowData.error || "알 수 없는 오류"}`)
	}

	if (!workflowData.outputs) {
		throw new Error("MISO 워크플로우 응답에서 outputs를 찾을 수 없습니다.")
	}

	// outputs에서 결과 찾기 (새 응답 형식: data.outputs.result)
	const outputs = workflowData.outputs
	let resultStr = outputs.result || outputs.output || outputs.answer

	// outputs의 첫 번째 값 사용 (변수명을 모르는 경우)
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

	// resultStr는 이미 JSON 문자열이므로 직접 파싱
	try {
		optimizedFiles = JSON.parse(resultStr)
		console.log("✅ JSON 파싱 성공:", optimizedFiles.length, "개 항목")
		
		// 새 응답 형식: hierarchical structure를 flat array로 변환
		if (Array.isArray(optimizedFiles) && optimizedFiles.length > 0) {
			optimizedFiles = convertHierarchicalToFlat(optimizedFiles)
		}
		
	} catch (parseError) {
		console.warn("⚠️ 직접 JSON 파싱 실패, 문자열에서 JSON 추출 시도:", parseError.message)
		console.log("📝 파싱할 문자열:", resultStr)

		// 문자열에서 JSON 추출 시도
		const patterns = [
			/\[[\s\S]*\]/, // 배열 형태
			/```(?:json)?\s*([\s\S]*?)\s*```/, // 코드블록
			/(\{[\s\S]*\})/ // 객체 형태
		]

		for (const pattern of patterns) {
			const match = resultStr.match(pattern)
			if (match) {
				const jsonStr = pattern.toString().includes("```") ? match[1] : match[0]
				try {
					optimizedFiles = JSON.parse(jsonStr)
					console.log("✅ 패턴 매칭으로 JSON 파싱 성공:", optimizedFiles.length, "개 항목")
					
					// 새 응답 형식 처리
					if (Array.isArray(optimizedFiles) && optimizedFiles.length > 0) {
						optimizedFiles = convertHierarchicalToFlat(optimizedFiles)
					}
					
					break
				} catch (e) {
					console.warn("❌ 패턴 매칭 실패:", pattern, e.message)
					continue
				}
			}
		}

		if (!optimizedFiles) {
			throw new Error(`MISO 응답에서 유효한 JSON을 찾을 수 없습니다. 응답 타입: ${typeof resultStr}, 내용: ${resultStr.substring(0, 500)}`)
		}
	}

	if (!Array.isArray(optimizedFiles)) {
		throw new Error("MISO 응답이 배열 형태가 아닙니다.")
	}

	console.log(`✅ MISO 워크플로우 최적화 완료: ${optimizedFiles.length}개 파일`)
	return optimizedFiles
}

/**
 * MISO API의 계층적 구조를 평면 배열로 변환
 */
function convertHierarchicalToFlat(hierarchicalData) {
	const flatFiles = []
	
	function traverse(items) {
		if (!Array.isArray(items)) return
		
		items.forEach(item => {
			// 파일/폴더 정보를 평면 배열에 추가
			const flatItem = {
				id: item.id,
				name: item.name,
				mimeType: item.mimeType,
				parents: item.parents || [],
				createdTime: item.createdTime,
				modifiedTime: item.modifiedTime,
				webViewLink: item.webViewLink,
				size: item.size
			}
			
			flatFiles.push(flatItem)
			
			// children이 있으면 재귀적으로 처리
			if (item.children && Array.isArray(item.children) && item.children.length > 0) {
				// children의 parent 정보를 현재 item의 id로 설정
				item.children.forEach(child => {
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
 * MISO API에 파일 업로드 (기존 함수 유지)
 */
export async function uploadFileToMISO(fileContent, fileName, apiKey) {
	const uploadUrl = "https://api.holdings.miso.gs/ext/v1/files/upload"

	const formData = new FormData()
	const blob = new Blob([fileContent], { type: "text/plain" })
	formData.append("file", blob, fileName.replace(".json", ".txt"))
	formData.append("user", "drive-optimizer") // 필수 필드 추가

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
	return result // 전체 응답 객체 반환 (id, name, size 등 포함)
}

/**
 * MISO API 채팅 호출 (대화 유지)
 */
export async function sendChatToMISO(
	query,
	conversationId = "",
	files = [],
	apiKey = "",
	apiUrl = ""
) {
	if (!apiUrl) {
		apiUrl = "https://api.holdings.miso.gs/ext/v1/chat"
	}

	const requestBody = {
		inputs: {
			file: []
		},
		query: query,
		mode: "blocking",
		conversation_id: conversationId,
		user: "drive-optimizer",
		files: files
	}

	const response = await fetch(apiUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(requestBody)
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(
			`MISO AI API 호출 실패: ${response.status} ${response.statusText} - ${errorText}`
		)
	}

	return await response.json()
}

/**
 * MISO 워크플로우 API를 통한 구조 최적화 (새 버전)
 */
export async function optimizeStructureWithAI(
	filesData,
	apiUrl = "",
	apiKey = "",
	onProgress = null
) {
	// 새로운 워크플로우 API 사용
	if (onProgress) onProgress("MISO 워크플로우 API로 최적화 중...")

	try {
		return await optimizeWithMISOWorkflow(filesData, apiKey)
	} catch (error) {
		console.warn("❌ MISO 워크플로우 API 오류, 로컬 시뮬레이션으로 대체:", error.message)
		if (onProgress) onProgress("MISO API 오류 발생, 기본 최적화 사용")
		return simulateOptimization(filesData)
	}
}

/**
 * 구조 차이 분석 및 이동 계획 생성
 */
export function generateMoveOperations(originalFiles, optimizedFiles, folderIdMap = new Map()) {
	const operations = []
	const originalMap = new Map()
	const optimizedMap = new Map()

	// 원본 파일들을 평면 배열로 변환하여 매핑 (파일과 트리 구조 모두 지원)
	function flattenFiles(files) {
		const flattened = []
		function traverse(fileList, parentId = "root") {
			fileList.forEach((file) => {
				// 원본 parents 정보가 있으면 사용, 없으면 현재 parentId 사용
				const actualParentId = file.parents?.[0] || parentId
				flattened.push({ ...file, currentParent: actualParentId })
				if (file.children && file.children.length > 0) {
					traverse(file.children, file.id)
				}
			})
		}
		traverse(files)
		return flattened
	}

	const originalFlat = flattenFiles(originalFiles)
	const optimizedFlat = flattenFiles(optimizedFiles)

	// 파일 매핑
	originalFlat.forEach((file) => originalMap.set(file.id, file))
	optimizedFlat.forEach((file) => optimizedMap.set(file.id, file))

	// 이동이 필요한 파일 찾기 (새로 생성될 폴더는 제외)
	for (const [fileId, optimizedFile] of optimizedMap) {
		// 새로 생성될 폴더는 이동 대상에서 제외
		if (fileId.startsWith("temp_")) continue

		const originalFile = originalMap.get(fileId)
		if (originalFile) {
			const originalParent = originalFile.currentParent
			const optimizedParent = optimizedFile.currentParent

			if (originalParent !== optimizedParent) {
				operations.push({
					fileId: fileId,
					fileName: optimizedFile.name,
					oldParentId: originalParent || "root", // 기본값 설정으로 API 조회 최소화
					newParentId: optimizedParent,
					action: "move"
				})
			}
		}
	}
	return operations
}

/**
 * 폴더 구조 최적화 실행
 */
export async function applyStructureOptimization(originalFiles, optimizedFiles, onProgress = null) {
	const results = []
	const folderIdMap = new Map() // 임시 ID -> 실제 ID 매핑

	// 1. 새 폴더들을 찾아서 먼저 생성
	const newFolders = findNewFolders(originalFiles, optimizedFiles)

	// 새 폴더들을 위상정렬하여 부모 폴더부터 생성
	const sortedNewFolders = topologicalSortFolders(newFolders)

	for (const folder of sortedNewFolders) {
		try {
			if (onProgress) onProgress(`새 폴더 생성: ${folder.name}`)

			// 부모 폴더 ID 결정 (임시 ID인 경우 실제 ID로 변환)
			let parentId = folder.parents?.[0] || "root"
			if (folderIdMap.has(parentId)) {
				parentId = folderIdMap.get(parentId)
			}

			const result = await createFolder(folder.name, parentId)

			// 임시 ID -> 실제 ID 매핑 저장
			folderIdMap.set(folder.id, result.id)

			// 실시간 로그 전달
			if (onProgress)
				onProgress(`폴더 생성 완료: ${folder.name}`, {
					type: "folder-create",
					success: true,
					name: folder.name,
					id: result.id
				})

			results.push({
				type: "create",
				success: true,
				folder: folder.name,
				tempId: folder.id,
				actualId: result.id
			})
		} catch (error) {
			// 실시간 로그 전달 (오류)
			if (onProgress)
				onProgress(`폴더 생성 실패: ${folder.name}`, {
					type: "folder-create",
					success: false,
					name: folder.name,
					error: error.message
				})

			results.push({
				type: "create",
				success: false,
				folder: folder.name,
				tempId: folder.id,
				error: error.message
			})
		}
	}

	// 2. 파일 이동 작업 수행 (병렬 처리로 최적화)
	// 최적화된 파일들을 평면 배열로 변환하여 전달
	const flatOptimizedFiles = []
	function flattenOptimizedFiles(files) {
		files.forEach((file) => {
			flatOptimizedFiles.push(file)
			if (file.children && file.children.length > 0) {
				flattenOptimizedFiles(file.children)
			}
		})
	}
	flattenOptimizedFiles(optimizedFiles)

	const operations = generateMoveOperations(originalFiles, flatOptimizedFiles, folderIdMap)

	if (operations.length > 0) {
		if (onProgress) onProgress(`${operations.length}개 파일을 병렬로 이동 시작...`)

		// 병렬 처리를 위한 Promise 배열 생성
		const movePromises = operations.map(async (op, index) => {
			try {
				// 새 부모 ID가 임시 ID인 경우 실제 ID로 변환
				let newParentId = op.newParentId
				if (folderIdMap.has(newParentId)) {
					newParentId = folderIdMap.get(newParentId)
				}

				// 실제 파일 이동 수행 (병렬 실행)
				await moveFile(op.fileId, newParentId, op.oldParentId)

				// 실시간 로그 전달 (성공)
				if (onProgress)
					onProgress(`파일 이동 완료: ${op.fileName}`, {
						type: "file-move",
						success: true,
						name: op.fileName,
						fileId: op.fileId
					})

				return { type: "move", success: true, file: op.fileName, index }
			} catch (error) {
				// 실시간 로그 전달 (오류)
				if (onProgress)
					onProgress(`파일 이동 실패: ${op.fileName}`, {
						type: "file-move",
						success: false,
						name: op.fileName,
						error: error.message
					})

				return { type: "move", success: false, file: op.fileName, error: error.message, index }
			}
		})

		// 모든 파일 이동을 병렬로 실행하고 결과 수집
		const moveResults = await Promise.all(movePromises)

		// 결과를 원래 순서대로 정렬해서 results에 추가
		moveResults
			.sort((a, b) => a.index - b.index)
			.forEach((result) => {
				const { index, ...resultWithoutIndex } = result
				results.push(resultWithoutIndex)
			})

		if (onProgress)
			onProgress(
				`모든 파일 이동 완료: 성공 ${moveResults.filter((r) => r.success).length}개, 실패 ${moveResults.filter((r) => !r.success).length}개`
			)
	}

	return results
}

/**
 * 새로 생성해야 할 폴더들 찾기
 */
function findNewFolders(originalFiles, optimizedFiles) {
	// 원본 파일들의 ID 집합 생성
	const originalIds = new Set()

	function collectOriginalIds(files) {
		files.forEach((file) => {
			originalIds.add(file.id)
			if (file.children && file.children.length > 0) {
				collectOriginalIds(file.children)
			}
		})
	}

	collectOriginalIds(originalFiles)

	const newFolders = []

	// 최적화된 파일들에서 새 폴더 찾기
	function collectAllFiles(files) {
		const allFiles = []
		files.forEach((file) => {
			allFiles.push(file)
			if (file.children && file.children.length > 0) {
				allFiles.push(...collectAllFiles(file.children))
			}
		})
		return allFiles
	}

	const allOptimizedFiles = collectAllFiles(optimizedFiles)

	for (const file of allOptimizedFiles) {
		if (
			file.mimeType === "application/vnd.google-apps.folder" &&
			!originalIds.has(file.id) &&
			file.id.startsWith("temp_")
		) {
			newFolders.push(file)
		}
	}

	return newFolders
}

/**
 * 폴더들을 위상정렬하여 부모 폴더부터 생성되도록 정렬
 */
function topologicalSortFolders(folders) {
	const sorted = []
	const visited = new Set()
	const folderMap = new Map(folders.map((f) => [f.id, f]))

	function visit(folder) {
		if (visited.has(folder.id)) return

		// 부모 폴더가 새 폴더인 경우 먼저 처리
		const parentId = folder.parents?.[0]
		if (parentId && parentId !== "root" && folderMap.has(parentId)) {
			visit(folderMap.get(parentId))
		}

		visited.add(folder.id)
		sorted.push(folder)
	}

	folders.forEach(visit)
	return sorted
}

/**
 * 테스트용 최적화 시뮬레이션 (AI API 없이 로컬에서 실행)
 * 의도적으로 많은 변경사항을 만들어 테스트하기 쉽게 함
 */
export function simulateOptimization(files) {
	// 깊은 복사로 파일 객체들을 복사
	const optimizedFiles = files.map((file) => ({
		...file,
		parents: file.parents ? [...file.parents] : ["root"],
		children: []
	}))

	const newFolders = []
	const currentYear = new Date().getFullYear()

	// 파일 타입별 분류
	const folders = optimizedFiles.filter((f) => f.mimeType === "application/vnd.google-apps.folder")
	const documents = optimizedFiles.filter(
		(f) => f.mimeType === "application/vnd.google-apps.document"
	)
	const spreadsheets = optimizedFiles.filter(
		(f) => f.mimeType === "application/vnd.google-apps.spreadsheet"
	)
	const presentations = optimizedFiles.filter(
		(f) => f.mimeType === "application/vnd.google-apps.presentation"
	)
	const pdfs = optimizedFiles.filter((f) => f.mimeType === "application/pdf")
	const images = optimizedFiles.filter((f) => f.mimeType?.startsWith("image/"))
	const videos = optimizedFiles.filter((f) => f.mimeType?.startsWith("video/"))
	const otherFiles = optimizedFiles.filter(
		(f) =>
			f.mimeType !== "application/vnd.google-apps.folder" &&
			f.mimeType !== "application/vnd.google-apps.document" &&
			f.mimeType !== "application/vnd.google-apps.spreadsheet" &&
			f.mimeType !== "application/vnd.google-apps.presentation" &&
			f.mimeType !== "application/pdf" &&
			!f.mimeType?.startsWith("image/") &&
			!f.mimeType?.startsWith("video/")
	)

	// 📁 "워크 스페이스" 메인 폴더 생성 (모든 파일을 정리하기 위한 최상위 폴더)
	const workspaceFolderId = `temp_workspace_${currentYear}`
	newFolders.push({
		id: workspaceFolderId,
		name: "🏢 워크 스페이스",
		mimeType: "application/vnd.google-apps.folder",
		parents: ["root"],
		createdTime: new Date().toISOString(),
		modifiedTime: new Date().toISOString(),
		webViewLink: null,
		children: []
	})

	// 1. 문서 폴더 생성 (문서가 1개 이상만 있어도 생성)
	if (documents.length >= 1) {
		const docFolderId = `temp_documents_${currentYear}`
		newFolders.push({
			id: docFolderId,
			name: "📝 문서",
			mimeType: "application/vnd.google-apps.folder",
			parents: [workspaceFolderId], // 워크스페이스 하위에 생성
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: null,
			children: []
		})

		// 모든 문서를 새 폴더로 이동
		documents.forEach((doc) => {
			doc.parents = [docFolderId]
		})
	}

	// 2. 스프레드시트 폴더 생성 (1개 이상)
	if (spreadsheets.length >= 1) {
		const sheetFolderId = `temp_spreadsheets_${currentYear}`
		newFolders.push({
			id: sheetFolderId,
			name: "📊 데이터 & 분석",
			mimeType: "application/vnd.google-apps.folder",
			parents: [workspaceFolderId],
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: null,
			children: []
		})

		// 모든 스프레드시트를 새 폴더로 이동
		spreadsheets.forEach((sheet) => {
			sheet.parents = [sheetFolderId]
		})
	}

	// 3. 프레젠테이션 폴더 생성 (1개 이상)
	if (presentations.length >= 1) {
		const presentationFolderId = `temp_presentations_${currentYear}`
		newFolders.push({
			id: presentationFolderId,
			name: "📽️ 발표 자료",
			mimeType: "application/vnd.google-apps.folder",
			parents: [workspaceFolderId],
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: null,
			children: []
		})

		presentations.forEach((pres) => {
			pres.parents = [presentationFolderId]
		})
	}

	// 4. PDF 폴더 생성 (1개 이상)
	if (pdfs.length >= 1) {
		const pdfFolderId = `temp_pdfs_${currentYear}`
		newFolders.push({
			id: pdfFolderId,
			name: "📄 PDF 문서",
			mimeType: "application/vnd.google-apps.folder",
			parents: [workspaceFolderId],
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: null,
			children: []
		})

		pdfs.forEach((pdf) => {
			pdf.parents = [pdfFolderId]
		})
	}

	// 5. 미디어 폴더 생성 (이미지나 비디오가 1개 이상)
	if (images.length >= 1 || videos.length >= 1) {
		const mediaFolderId = `temp_media_${currentYear}`
		newFolders.push({
			id: mediaFolderId,
			name: "🎨 미디어",
			mimeType: "application/vnd.google-apps.folder",
			parents: [workspaceFolderId],
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: null,
			children: []
		})

		// 이미지 하위 폴더 (1개 이상)
		if (images.length >= 1) {
			const imagesFolderId = `temp_images_${currentYear}`
			newFolders.push({
				id: imagesFolderId,
				name: "🖼️ 이미지",
				mimeType: "application/vnd.google-apps.folder",
				parents: [mediaFolderId],
				createdTime: new Date().toISOString(),
				modifiedTime: new Date().toISOString(),
				webViewLink: null,
				children: []
			})

			images.forEach((img) => {
				img.parents = [imagesFolderId]
			})
		}

		// 비디오 하위 폴더 (1개 이상)
		if (videos.length >= 1) {
			const videosFolderId = `temp_videos_${currentYear}`
			newFolders.push({
				id: videosFolderId,
				name: "🎥 비디오",
				mimeType: "application/vnd.google-apps.folder",
				parents: [mediaFolderId],
				createdTime: new Date().toISOString(),
				modifiedTime: new Date().toISOString(),
				webViewLink: null,
				children: []
			})

			videos.forEach((video) => {
				video.parents = [videosFolderId]
			})
		}
	}

	// 6. 기타 파일들 폴더 생성 (1개 이상)
	if (otherFiles.length >= 1) {
		const miscFolderId = `temp_misc_${currentYear}`
		newFolders.push({
			id: miscFolderId,
			name: "📂 기타 파일",
			mimeType: "application/vnd.google-apps.folder",
			parents: [workspaceFolderId],
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: null,
			children: []
		})

		otherFiles.forEach((file) => {
			file.parents = [miscFolderId]
		})
	}

	// 7. 기존 폴더들도 워크스페이스로 이동 (강제 변경사항 생성)
	const rootFolders = folders.filter((f) => f.parents?.includes("root") || !f.parents?.length)
	if (rootFolders.length > 0) {
		const existingFolderId = `temp_existing_folders_${currentYear}`
		newFolders.push({
			id: existingFolderId,
			name: "📁 기존 폴더",
			mimeType: "application/vnd.google-apps.folder",
			parents: [workspaceFolderId],
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: null,
			children: []
		})

		rootFolders.forEach((folder) => {
			folder.parents = [existingFolderId]
		})
	}

	return [...optimizedFiles, ...newFolders]
}

/**
 * 최적화 전후 구조 비교 데이터 생성
 */
export function generateStructureComparison(originalFiles, optimizedFiles) {
	const originalStructure = organizeFilesAsTree(originalFiles)
	const optimizedStructure = organizeFilesAsTree(optimizedFiles)

	// 이동된 파일들과 새 폴더들 찾기
	const movedFiles = []
	const newFolders = []
	const originalParentMap = new Map()
	const optimizedParentMap = new Map()

	// 파일들의 부모 관계 매핑
	originalFiles.forEach((file) => {
		const parentId = file.parents?.[0] || "root"
		originalParentMap.set(file.id, parentId)
	})

	optimizedFiles.forEach((file) => {
		const parentId = file.parents?.[0] || "root"
		optimizedParentMap.set(file.id, parentId)
	})

	// 각 파일의 이동 여부 확인
	for (const file of originalFiles) {
		const fileId = file.id
		const originalParent = originalParentMap.get(fileId)
		const optimizedParent = optimizedParentMap.get(fileId)

		if (optimizedParent && originalParent !== optimizedParent) {
			const originalPath = getFilePath(file, originalFiles, originalParentMap)
			const optimizedPath = getFilePath(file, optimizedFiles, optimizedParentMap)

			movedFiles.push({
				id: fileId,
				name: file.name,
				oldPath: originalPath,
				newPath: optimizedPath,
				mimeType: file.mimeType,
				oldParentId: originalParent,
				newParentId: optimizedParent
			})
		}
	}

	// 새 폴더 찾기
	for (const file of optimizedFiles) {
		if (file.id.startsWith("temp_")) {
			const folderPath = getFilePath(file, optimizedFiles, optimizedParentMap)
			newFolders.push({
				...file,
				path: folderPath
			})
		}
	}

	return {
		original: originalStructure,
		optimized: optimizedStructure,
		changes: {
			movedFiles,
			newFolders,
			totalFiles: originalFiles.length,
			totalOptimizedFiles: optimizedFiles.length
		}
	}
}

/**
 * 파일의 전체 경로 생성
 */
function getFilePath(file, allFiles, parentMap) {
	const pathParts = []
	let currentFile = file
	const visited = new Set()

	while (currentFile && !visited.has(currentFile.id)) {
		visited.add(currentFile.id)
		pathParts.unshift(currentFile.name)

		const parentId = parentMap.get(currentFile.id)
		if (parentId === "root" || !parentId) {
			break
		}

		currentFile = allFiles.find((f) => f.id === parentId)
		if (!currentFile) {
			// 새 폴더인 경우
			const tempFolder = allFiles.find((f) => f.id === parentId && f.id.startsWith("temp_"))
			if (tempFolder) {
				pathParts.unshift(tempFolder.name)
				currentFile = tempFolder
			} else {
				break
			}
		}
	}

	return pathParts.join("/")
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

/**
 * MISO API 에러 메시지를 한글로 변환
 */
export function getErrorMessage(error) {
	if (!error) return "알 수 없는 오류가 발생했습니다."

	const message = error.message || error.toString()

	// 일반적인 MISO API 에러 메시지 매핑
	const errorMap = {
		400: {
			invalid_param: "잘못된 파라미터가 입력되었습니다. 요청 데이터를 확인해주세요.",
			"Workflow not published":
				"워크플로우가 발행되지 않았습니다. MISO 앱 편집화면에서 저장버튼을 눌러주세요.",
			app_unavailable: "앱 설정 정보를 사용할 수 없습니다.",
			provider_not_initialize: "사용 가능한 모델 인증 정보가 없습니다.",
			provider_quota_exceeded: "모델 호출 쿼터가 초과되었습니다.",
			model_currently_not_support: "현재 모델을 사용할 수 없습니다.",
			workflow_request_error: "워크플로우 실행이 실패했습니다."
		},
		401: "인증에 실패했습니다. MISO API 키를 확인해주세요.",
		403: "접근이 거부되었습니다. API 키 권한을 확인해주세요.",
		404: "요청한 리소스를 찾을 수 없습니다.",
		429: "요청 횟수가 제한을 초과했습니다. 잠시 후 다시 시도해주세요.",
		500: "내부 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
		502: "게이트웨이 오류가 발생했습니다. 서버가 일시적으로 사용할 수 없습니다.",
		503: "서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
	}

	// HTTP 상태 코드 기반 에러 메시지
	if (message.includes("MISO API 오류")) {
		const statusMatch = message.match(/\((\d+)\)/)
		if (statusMatch) {
			const status = statusMatch[1]
			if (errorMap[status]) {
				if (typeof errorMap[status] === "string") {
					return errorMap[status]
				} else {
					// 400번 에러의 상세 메시지 확인
					for (const [key, value] of Object.entries(errorMap[status])) {
						if (message.includes(key)) {
							return value
						}
					}
					return "잘못된 요청입니다. 요청 데이터를 확인해주세요."
				}
			}
		}
	}

	// 네트워크 관련 에러
	if (
		message.includes("fetch") ||
		message.includes("network") ||
		message.includes("NetworkError")
	) {
		return "네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요."
	}

	// 타임아웃 에러
	if (message.includes("timeout") || message.includes("시간초과")) {
		return "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."
	}

	// JSON 파싱 에러
	if (message.includes("JSON") || message.includes("parse")) {
		return "API 응답 형식에 문제가 있습니다. 잠시 후 다시 시도해주세요."
	}

	// 기본 메시지
	return `MISO API 연동 중 오류가 발생했습니다: ${message}`
}
