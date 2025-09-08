<script>
	import { onMount } from "svelte"
	import {
		GOOGLE_CONFIG,
		loadGoogleScripts,
		initializeGoogleAPI,
		createTokenClient,
		fetchDriveFiles,
		fetchFolderFiles,
		fetchAllDriveFiles,
		organizeFilesAsTree,
		optimizeStructureWithAI,
		applyStructureOptimization,
		generateMoveOperations,
		simulateOptimization,
		generateStructureComparison
	} from "$lib/google-drive.js"
	import FileTreeItem from "$lib/FileTreeItem.svelte"
	import StructureComparisonView from "$lib/StructureComparisonView.svelte"

	let files = $state([])
	let isLoading = $state(false)
	let error = $state(null)
	let isSignedIn = $state(false)
	let gapi = null
	let treeStructure = $state({ rootFiles: [], fileMap: new Map() }) // 트리 구조 저장
	let expandedFolders = $state(new Set())
	let loadingFolders = $state(new Set()) // 로딩 중인 폴더들
	// loadMode 제거 - 항상 트리뷰로 표시, 최적화 시에만 내부적으로 평면 데이터 사용

	// AI 최적화 관련 상태
	let aiApiKey = $state(import.meta.env.VITE_MISO_API_KEY || "")
	let isOptimizing = $state(false)
	let optimizationResult = $state(null)
	let optimizationProgress = $state("")
	let showOptimizationModal = $state(false)
	let moveOperations = $state([])
	let optimizedStructure = $state(null)
	let aiStructureComparison = $state(null)

	// 테스트 기능 관련 상태
	let showPreviewModal = $state(false)
	let structureComparison = $state(null)
	let isSimulating = $state(false)

	// 실제 적용 기능 관련 상태
	let showConfirmModal = $state(false)
	let isApplyingTest = $state(false)
	let testApplyProgress = $state("")
	let testApplyResult = $state(null)

	// 실시간 파일 이동 추적
	let fileMovementLogs = $state([])
	let showMovementModal = $state(false)

	onMount(() => {
		loadGoogleAPI()
	})

	async function loadGoogleAPI() {
		try {
			await loadGoogleScripts()
			gapi = window.gapi
			await initializeGoogleAPI()
		} catch (err) {
			error = "Google API 로드 실패: " + err.message
		}
	}

	function signIn() {
		if (!window.google) {
			error = "Google API가 로드되지 않았습니다."
			return
		}
		const tokenClient = createTokenClient((tokenResponse) => {
			if (tokenResponse.error) {
				error = tokenResponse.error
				return
			}

			isSignedIn = true

			loadFiles()
		})

		tokenClient.requestAccessToken()
	}

	function signOut() {
		window.google.accounts.oauth2.revoke(gapi.client.getToken().access_token, () => {
			gapi.client.setToken(null)
			isSignedIn = false
			files = []
		})
	}

	async function loadFiles() {
		// 기본적으로 트리뷰로 루트 파일만 로드
		// 최적화 시에는 별도로 모든 파일을 가져와서 사용
		await loadRootFiles()
	}

	async function loadRootFiles() {
		isLoading = true
		error = null

		try {
			const rootFiles = await fetchDriveFiles()
			// 통합된 트리 구조로 정리
			const { rootFiles: organizedFiles } = organizeFilesAsTree(rootFiles)
			files = organizedFiles
		} catch (err) {
			error = "파일 로드 실패: " + (err.message || JSON.stringify(err))
			console.error(err)
		} finally {
			isLoading = false
		}
	}

	async function loadAllFilesFlat() {
		isLoading = true
		error = null

		try {
			// 단일 API 호출로 모든 파일 가져오기
			const allFilesFromAPI = await fetchAllDriveFiles()
			// 트리 구조로 정리만 하고 저장
			treeStructure = organizeFilesAsTree(allFilesFromAPI)
			files = treeStructure.rootFiles
		} catch (err) {
			error = "파일 로드 실패: " + (err.message || JSON.stringify(err))
			console.error(err)
		} finally {
			isLoading = false
		}
	}

	async function toggleFolder(folder) {
		const folderId = folder.id

		if (expandedFolders.has(folderId)) {
			expandedFolders.delete(folderId)
			expandedFolders = new Set(expandedFolders)
		} else {
			// 트리 뷰에서는 API 호출해서 children 로드
			loadingFolders.add(folderId)
			loadingFolders = new Set(loadingFolders)

			try {
				const contents = await fetchFolderFiles(folderId)
				// 가져온 내용을 정렬해서 folder의 children에 직접 저장
				const { rootFiles: sortedContents } = organizeFilesAsTree(contents)
				folder.children = sortedContents

				expandedFolders.add(folderId)
				expandedFolders = new Set(expandedFolders)

				// files 배열 업데이트를 위해 새로운 참조 생성
				files = [...files]
			} catch (err) {
				console.error("폴더 내용 로드 실패:", err)
				error = "폴더 로드 실패: " + err.message
			} finally {
				loadingFolders.delete(folderId)
				loadingFolders = new Set(loadingFolders)
			}
		}
	}

	// 표시할 루트 파일 목록 가져오기 (항상 트리뷰)
	function getDisplayFiles() {
		return files
	}

	async function saveStructureAsJSON(data, filename) {
		const jsonData = JSON.stringify(data, null, 2)
		const blob = new Blob([jsonData], { type: "application/json" })
		const url = URL.createObjectURL(blob)

		const a = document.createElement("a")
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	// AI로 구조 최적화 요청
	async function optimizeWithAI() {
		if (!aiApiKey.trim()) {
			error = "MISO API 키를 입력해주세요."
			return
		}

		isOptimizing = true
		error = null
		optimizationProgress = "모든 파일 데이터 수집 중..."

		try {
			// 최적화를 위해 모든 파일 데이터를 평면적으로 수집
			const allFiles = await fetchAllDriveFiles()
			console.log("📊 수집된 전체 파일 개수:", allFiles.length)

			optimizationProgress = "MISO AI로 구조 분석 중..."
			const optimized = await optimizeStructureWithAI(allFiles, "", aiApiKey, (progress) => {
				optimizationProgress = progress
			})

			optimizationProgress = "최적화된 구조 분석 중..."
			optimizedStructure = organizeFilesAsTree(optimized)

			// 구조 비교 데이터 생성
			aiStructureComparison = generateStructureComparison(allFiles, optimized)

			// 이동 작업 계획 생성
			moveOperations = generateMoveOperations(allFiles, optimized)

			optimizationProgress = `${moveOperations.length}개의 이동 작업이 계획되었습니다.`
			showOptimizationModal = true
		} catch (err) {
			error = "MISO AI 최적화 실패: " + (err.message || JSON.stringify(err))
			console.error(err)
		} finally {
			isOptimizing = false
		}
	}

	// 최적화 적용
	async function applyOptimization() {
		if (!optimizedStructure || !moveOperations.length) {
			error = "적용할 최적화 계획이 없습니다."
			return
		}

		isOptimizing = true
		optimizationProgress = "구조 최적화 적용 중..."
		fileMovementLogs = []
		showMovementModal = true

		try {
			// 현재 모든 파일 데이터 다시 수집 (최신 상태 반영)
			const currentAllFiles = await fetchAllDriveFiles()
			
			// 최적화된 파일들을 평면 배열로 변환
			const flatOptimizedFiles = []
			function flattenOptimizedFiles(files) {
				files.forEach((file) => {
					flatOptimizedFiles.push(file)
					if (file.children && file.children.length > 0) {
						flattenOptimizedFiles(file.children)
					}
				})
			}
			flattenOptimizedFiles(optimizedStructure.rootFiles)

			const results = await applyStructureOptimization(
				currentAllFiles,
				flatOptimizedFiles,
				(progress, logData = null) => {
					optimizationProgress = progress
					if (logData) {
						fileMovementLogs = [
							...fileMovementLogs,
							{
								timestamp: new Date().toLocaleTimeString("ko-KR"),
								...logData
							}
						]
					}
				}
			)

			optimizationResult = results
			optimizationProgress = "최적화 완료! 파일 목록을 새로고침합니다."

			// 파일 목록 새로고침
			await loadFiles()
		} catch (err) {
			error = "최적화 적용 실패: " + (err.message || JSON.stringify(err))
			console.error(err)
		} finally {
			isOptimizing = false
		}
	}

	// 최적화 모달 닫기
	function closeOptimizationModal() {
		showOptimizationModal = false
		optimizationResult = null
		moveOperations = []
		optimizedStructure = null
		optimizationProgress = ""
		aiStructureComparison = null
	}


	// 테스트 최적화 미리보기
	async function testOptimizationPreview() {
		isSimulating = true
		error = null

		try {
			// 테스트를 위해 모든 파일 데이터를 수집
			const currentFiles = await fetchAllDriveFiles()

			console.log("🧪 테스트 최적화 시뮬레이션 실행...")
			console.log("📄 원본 파일들:", currentFiles.length, "개")

			const simulatedOptimizedFiles = simulateOptimization(currentFiles)
			console.log("✨ 최적화된 파일들:", simulatedOptimizedFiles.length, "개")

			console.log("📊 구조 비교 데이터 생성...")
			structureComparison = generateStructureComparison(currentFiles, simulatedOptimizedFiles)

			console.log("🎯 최종 비교 결과:", structureComparison)

			showPreviewModal = true
		} catch (err) {
			error = "테스트 시뮬레이션 실패: " + (err.message || JSON.stringify(err))
			console.error(err)
		} finally {
			isSimulating = false
		}
	}

	// 미리보기 모달 닫기
	function closePreviewModal() {
		showPreviewModal = false
		structureComparison = null
	}

	// 실제 테스트 적용 확인
	function confirmTestApply() {
		if (!structureComparison) return
		showConfirmModal = true
	}

	// 실제 테스트 구조 적용
	async function applyTestStructure() {
		if (!structureComparison) return

		isApplyingTest = true
		testApplyProgress = "테스트 구조를 실제 Google Drive에 적용 중..."
		showConfirmModal = false
		fileMovementLogs = []
		showMovementModal = true

		try {
			// 현재 모든 파일 데이터 수집 (최신 상태)
			const originalFiles = await fetchAllDriveFiles()
			const optimizedFiles = structureComparison.optimized.rootFiles

			// 실제 Google Drive API를 사용하여 구조 변경
			const results = await applyStructureOptimization(
				originalFiles,
				// 최적화된 파일을 평면 배열로 변환
				flattenOptimizedStructure(optimizedFiles),
				(progress, logData = null) => {
					testApplyProgress = progress
					if (logData) {
						fileMovementLogs = [
							...fileMovementLogs,
							{
								timestamp: new Date().toLocaleTimeString("ko-KR"),
								...logData
							}
						]
					}
				}
			)

			testApplyResult = results
			testApplyProgress = "구조 변경 완료! 파일 목록을 새로고침합니다..."

			// 파일 목록 새로고침
			setTimeout(async () => {
				await loadFiles()
				testApplyProgress = "완료되었습니다."
			}, 1000)
		} catch (err) {
			error = "테스트 구조 적용 실패: " + (err.message || JSON.stringify(err))
			console.error(err)
		} finally {
			isApplyingTest = false
		}
	}

	// 최적화된 트리 구조를 평면 배열로 변환
	function flattenOptimizedStructure(files) {
		const result = []

		function flatten(fileList) {
			fileList.forEach((file) => {
				result.push(file)
				if (file.children && file.children.length > 0) {
					flatten(file.children)
				}
			})
		}

		flatten(files)
		return result
	}

	// 확인 모달 닫기
	function closeConfirmModal() {
		showConfirmModal = false
	}

	// 파일 이동 로그 모달 닫기
	function closeMovementModal() {
		showMovementModal = false
		fileMovementLogs = []
	}

	// AI 최적화 모달의 탭 전환
	function switchAiOptimizationTab(event) {
		const clickedTab = event.target.getAttribute("data-tab")
		if (!clickedTab) return

		// 모든 탭 버튼에서 active 클래스 제거
		const tabButtons = event.target.parentElement.querySelectorAll(".tab-button")
		tabButtons.forEach((btn) => btn.classList.remove("active"))

		// 클릭된 탭에 active 클래스 추가
		event.target.classList.add("active")

		// 모든 탭 콘텐츠 숨김
		const tabContents = event.target
			.closest(".ai-optimization-tabs")
			.querySelectorAll(".tab-content")
		tabContents.forEach((content) => content.classList.add("hidden"))

		// 선택된 탭 콘텐츠만 표시
		const targetContent = event.target
			.closest(".ai-optimization-tabs")
			.querySelector(`[data-content="${clickedTab}"]`)
		if (targetContent) {
			targetContent.classList.remove("hidden")
		}
	}
</script>

<svelte:head>
	<title>Google Drive 파일</title>
</svelte:head>

<div class="container">
	<header>
		<h1>🗂️ Google Drive 파일</h1>
		<div class="auth-section">
			{#if !isSignedIn}
				<button onclick={signIn} class="btn btn-primary">Google Drive 연결</button>
			{:else}
				<div class="signed-in">
					<span>✅ 연결됨</span>
					<button onclick={signOut} class="btn btn-secondary">연결 해제</button>
					<button onclick={loadFiles} class="btn btn-primary">새로고침</button>
					<button
						onclick={optimizeWithAI}
						class="btn btn-optimize"
						disabled={isOptimizing || !aiApiKey.trim()}
					>
						{#if isOptimizing}
							🔄 MISO AI 최적화 중...
						{:else}
							🤖 MISO AI로 구조 최적화
						{/if}
					</button>
					<button
						onclick={testOptimizationPreview}
						class="btn btn-test"
						disabled={isSimulating}
					>
						{#if isSimulating}
							🔄 테스트 중...
						{:else}
							🔬 최적화 테스트
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</header>

	{#if isSignedIn}
		<div class="controls">
			<div class="ai-section">
				<input
					type="text"
					value="https://api.holdings.miso.gs/ext/v1/workflows/run"
					placeholder="MISO 워크플로우 API URL"
					class="api-input"
					readonly
				/>
				<input
					type="password"
					bind:value={aiApiKey}
					placeholder="MISO API 키 입력 (app-bSZGH0mzGfJMpXsZNB0VQrh5)"
					class="api-input"
				/>
				<button
					type="button"
					class="btn btn-info"
					onclick={() => (aiApiKey = "app-bSZGH0mzGfJMpXsZNB0VQrh5")}
					title="제공된 API 키 사용"
				>
					🔑 API 키
				</button>
			</div>
		</div>
	{/if}

	{#if error}
		<div class="error">
			❌ {error}
		</div>
	{/if}

	{#if GOOGLE_CONFIG.CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID.googleusercontent.com"}
		<div class="warning">
			⚠️ Google Drive API를 사용하려면 CLIENT_ID를 설정해야 합니다.
			<br />
			<small>
				1. <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a>에서
				프로젝트 생성
				<br />
				2. Drive API 활성화
				<br />
				3. OAuth 2.0 클라이언트 ID 생성
				<br />
				4. google-drive.js의 CLIENT_ID 변수 업데이트
			</small>
		</div>
	{/if}

	{#if isLoading}
		<div class="loading">🔄 파일 로딩 중...</div>
	{/if}

	{#if isOptimizing && optimizationProgress}
		<div class="optimization-progress">
			🤖 {optimizationProgress}
		</div>
	{/if}

	{#if isApplyingTest && testApplyProgress}
		<div class="test-apply-progress">
			🔧 {testApplyProgress}
		</div>
	{/if}

	<!-- 디버깅 정보 -->
	{#if isSignedIn}
		<div
			style="background: #f0f0f0; padding: 1rem; margin: 1rem 0; border-radius: 4px; font-family: monospace; font-size: 12px;"
		>
			<div>files.length: {files.length}</div>
			<div>totalFiles: {treeStructure.fileMap.size}</div>
		</div>
	{/if}

	{#if isSignedIn && files.length > 0}
		<div class="file-count">
			총 {files.length}개의 루트 항목
		</div>

		<div class="files-list">
			<div class="list-header">
				<div class="col-icon"></div>
				<div class="col-name">이름</div>
				<div class="col-size">크기</div>
				<div class="col-date">수정일</div>
				<div class="col-action">동작</div>
			</div>
			{#each getDisplayFiles() as file}
				<FileTreeItem
					{file}
					level={0}
					{expandedFolders}
					{loadingFolders}
					onToggleFolder={toggleFolder}
				/>
			{/each}
		</div>
	{:else if isSignedIn && !isLoading}
		<div class="empty">📂 파일이 없습니다.</div>
	{/if}
</div>

<!-- AI 최적화 모달 -->
{#if showOptimizationModal}
	<div class="modal-overlay" onclick={closeOptimizationModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>🤖 AI 구조 최적화 결과</h3>
				<button class="modal-close" onclick={closeOptimizationModal}>×</button>
			</div>

			<div class="modal-body">
				{#if aiStructureComparison && moveOperations.length > 0}
					<div class="ai-optimization-tabs">
						<div class="tabs-header">
							<button class="tab-button active" data-tab="preview" onclick={switchAiOptimizationTab}
								>🔍 구조 미리보기</button
							>
							<button class="tab-button" data-tab="operations" onclick={switchAiOptimizationTab}
								>📋 이동 계획</button
							>
						</div>

						<div class="tab-content" data-content="preview">
							<div class="ai-preview-info">
								<p><strong>🧠 AI가 분석한 최적화된 구조를 미리 확인하세요.</strong></p>
								<p>
									실제 파일은 아직 이동되지 않았습니다. "최적화 적용" 버튼을 눌러야 실제 이동이
									시작됩니다.
								</p>
							</div>
							<StructureComparisonView comparison={aiStructureComparison} />
						</div>

						<div class="tab-content hidden" data-content="operations">
							<div class="optimization-summary">
								<h4>📋 이동 계획 ({moveOperations.length}개 작업)</h4>
								<div class="operations-list">
									{#each moveOperations as operation}
										<div class="operation-item">
											<span class="file-name">📄 {operation.fileName}</span>
											<span class="operation-arrow">→</span>
											<span class="new-location">새 위치로 이동</span>
										</div>
									{/each}
								</div>
							</div>
						</div>

						<div class="modal-actions">
							<button class="btn btn-primary" onclick={applyOptimization} disabled={isOptimizing}>
								{#if isOptimizing}
									🔄 적용 중...
								{:else}
									✅ 최적화 적용
								{/if}
							</button>
							<button
								class="btn btn-secondary"
								onclick={closeOptimizationModal}
								disabled={isOptimizing}
							>
								❌ 취소
							</button>
						</div>
					</div>
				{:else if moveOperations.length > 0}
					<div class="optimization-summary">
						<h4>📋 이동 계획 ({moveOperations.length}개 작업)</h4>
						<div class="operations-list">
							{#each moveOperations as operation}
								<div class="operation-item">
									<span class="file-name">📄 {operation.fileName}</span>
									<span class="operation-arrow">→</span>
									<span class="new-location">새 위치로 이동</span>
								</div>
							{/each}
						</div>
					</div>

					<div class="modal-actions">
						<button class="btn btn-primary" onclick={applyOptimization} disabled={isOptimizing}>
							{#if isOptimizing}
								🔄 적용 중...
							{:else}
								✅ 최적화 적용
							{/if}
						</button>
						<button
							class="btn btn-secondary"
							onclick={closeOptimizationModal}
							disabled={isOptimizing}
						>
							❌ 취소
						</button>
					</div>
				{:else}
					<div class="no-changes">✨ 현재 구조가 이미 최적화되어 있습니다!</div>
				{/if}

				{#if optimizationResult}
					<div class="results-section">
						<h4>📊 최적화 결과</h4>
						<div class="results-list">
							{#each optimizationResult as result}
								<div class="result-item {result.success ? 'success' : 'error'}">
									{#if result.success}
										✅ {result.type === "create"
											? `폴더 생성: ${result.folder}`
											: `파일 이동: ${result.file}`}
									{:else}
										❌ {result.type === "create"
											? `폴더 생성 실패: ${result.folder}`
											: `파일 이동 실패: ${result.file}`} - {result.error}
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}


<!-- 최적화 테스트 미리보기 모달 -->
{#if showPreviewModal && structureComparison}
	<div class="modal-overlay" onclick={closePreviewModal}>
		<div class="modal-content large-modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>🔬 최적화 테스트 미리보기</h3>
				<button class="modal-close" onclick={closePreviewModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="preview-info">
					<p>실제 AI API 대신 로컬 최적화 알고리즘을 사용한 테스트입니다.</p>
					<p>실제 파일은 이동되지 않으며, 최적화 결과만 미리볼 수 있습니다.</p>
				</div>

				<StructureComparisonView comparison={structureComparison} />

				<div class="modal-actions">
					<button
						class="btn btn-danger"
						onclick={confirmTestApply}
						disabled={isApplyingTest ||
							(structureComparison?.changes?.movedFiles?.length === 0 &&
								structureComparison?.changes?.newFolders?.length === 0)}
					>
						⚠️ 실제 Drive에 적용
					</button>
					<button class="btn btn-secondary" onclick={closePreviewModal}> 닫기 </button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- 실시간 파일 이동 로그 모달 -->
{#if showMovementModal}
	<div class="modal-overlay">
		<div class="modal-content large-modal">
			<div class="modal-header">
				<h3>🚚 실시간 파일 이동 로그</h3>
				<button class="modal-close" onclick={closeMovementModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="movement-status">
					<div class="status-indicator {isOptimizing || isApplyingTest ? 'active' : 'complete'}">
						{#if isOptimizing || isApplyingTest}
							🔄 진행 중...
						{:else}
							✅ 완료
						{/if}
					</div>
					<div class="progress-text">
						{optimizationProgress || testApplyProgress}
					</div>
				</div>

				<div class="movement-logs">
					<div class="logs-header">
						<strong>📋 작업 로그 ({fileMovementLogs.length}개)</strong>
					</div>
					<div class="logs-container">
						{#if fileMovementLogs.length === 0}
							<div class="no-logs">아직 작업이 시작되지 않았습니다.</div>
						{:else}
							{#each fileMovementLogs as log}
								<div class="log-entry {log.success ? 'success' : 'error'}">
									<div class="log-timestamp">{log.timestamp}</div>
									<div class="log-content">
										{#if log.type === "folder-create"}
											{#if log.success}
												📁 폴더 생성 완료: <strong>{log.name}</strong>
											{:else}
												❌ 폴더 생성 실패: <strong>{log.name}</strong> - {log.error}
											{/if}
										{:else if log.type === "file-move"}
											{#if log.success}
												🚚 파일 이동 완료: <strong>{log.name}</strong>
											{:else}
												❌ 파일 이동 실패: <strong>{log.name}</strong> - {log.error}
											{/if}
										{/if}
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<div class="modal-actions">
					{#if !isOptimizing && !isApplyingTest}
						<button class="btn btn-secondary" onclick={closeMovementModal}> 닫기 </button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- 실제 적용 확인 모달 -->
{#if showConfirmModal}
	<div class="modal-overlay" onclick={closeConfirmModal}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>⚠️ 실제 Google Drive 구조 변경</h3>
				<button class="modal-close" onclick={closeConfirmModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="warning-message">
					<p><strong>주의:</strong> 이 작업은 실제 Google Drive의 파일과 폴더 구조를 변경합니다!</p>
					<ul>
						<li>
							📁 {structureComparison?.changes?.newFolders?.length || 0}개의 새 폴더가 생성됩니다
						</li>
						<li>
							🚚 {structureComparison?.changes?.movedFiles?.length || 0}개의 파일이 이동됩니다
						</li>
						<li>📝 변경사항은 Google Drive에서 즉시 반영됩니다</li>
						<li>🔄 필요시 수동으로 되돌려야 합니다</li>
					</ul>
					<p>계속하시겠습니까?</p>
				</div>

				<div class="modal-actions">
					<button class="btn btn-danger" onclick={applyTestStructure}> ✅ 예, 적용합니다 </button>
					<button class="btn btn-secondary" onclick={closeConfirmModal}> ❌ 취소 </button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		color: #333;
	}

	.auth-section {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.signed-in {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.controls {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		align-items: center;
		padding: 1rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.load-mode-select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
	}

	.api-input {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		min-width: 300px;
		font-size: 0.9rem;
	}

	.btn-optimize {
		background-color: #ff6b35;
		color: white;
	}

	.btn-optimize:hover:not(:disabled) {
		background-color: #e55a2b;
	}

	.btn-optimize:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}

	.btn-info {
		background-color: #17a2b8;
		color: white;
	}

	.btn-info:hover:not(:disabled) {
		background-color: #138496;
	}

	.btn-info:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}

	.btn-test {
		background-color: #6f42c1;
		color: white;
	}

	.btn-test:hover:not(:disabled) {
		background-color: #5a35a3;
	}

	.btn-test:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}

	.optimization-progress {
		background-color: #e3f2fd;
		color: #1976d2;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		text-align: center;
		font-weight: 500;
	}

	.test-apply-progress {
		background-color: #fff3cd;
		color: #856404;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		text-align: center;
		font-weight: 500;
		border: 1px solid #ffeaa7;
	}

	.file-count {
		margin-bottom: 1rem;
		color: #6c757d;
		font-size: 0.9rem;
	}

	.files-list {
		background: white;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.list-header {
		display: grid;
		grid-template-columns: 40px 2fr 100px 150px 80px;
		gap: 1rem;
		padding: 1rem;
		background: #f8f9fa;
		border-bottom: 1px solid #e0e0e0;
		font-weight: 600;
		font-size: 0.85rem;
		color: #495057;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.btn-primary {
		background-color: #4285f4;
		color: white;
	}

	.btn-primary:hover {
		background-color: #3367d6;
	}

	.btn-secondary {
		background-color: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background-color: #545b62;
	}

	.btn-danger {
		background-color: #dc3545;
		color: white;
	}

	.btn-danger:hover {
		background-color: #c82333;
	}

	.error {
		background-color: #f8d7da;
		color: #721c24;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.warning {
		background-color: #fff3cd;
		color: #856404;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.warning small {
		opacity: 0.8;
	}

	.loading {
		text-align: center;
		padding: 2rem;
		color: #6c757d;
	}

	.empty {
		text-align: center;
		padding: 3rem;
		color: #6c757d;
		font-size: 1.1rem;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		header {
			flex-direction: column;
			align-items: stretch;
		}

		.controls {
			flex-direction: column;
			align-items: stretch;
		}

		.list-header {
			grid-template-columns: 30px 2fr 80px 60px;
			gap: 0.5rem;
		}

		.controls {
			flex-direction: column;
			gap: 0.75rem;
		}

		.api-input {
			min-width: auto;
		}
	}

	/* 모달 스타일 */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		margin: 2rem;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h3 {
		margin: 0;
		color: #333;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.optimization-summary h4,
	.results-section h4 {
		margin: 0 0 1rem 0;
		color: #333;
	}

	.operations-list,
	.results-list {
		max-height: 200px;
		overflow-y: auto;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.operation-item,
	.result-item {
		padding: 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.operation-item:last-child,
	.result-item:last-child {
		border-bottom: none;
	}

	.operation-arrow {
		color: #666;
		font-weight: bold;
	}

	.file-name {
		font-weight: 500;
	}

	.new-location {
		color: #666;
		font-style: italic;
	}

	.result-item.success {
		background-color: #f8fff8;
		color: #2e7d32;
	}

	.result-item.error {
		background-color: #fff8f8;
		color: #d32f2f;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-top: 1rem;
	}

	.no-changes {
		text-align: center;
		padding: 2rem;
		color: #4caf50;
		font-size: 1.1rem;
		font-weight: 500;
	}

	.results-section {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	/* 예시 데이터 모달 스타일 */
	.large-modal {
		max-width: 800px;
		max-height: 90vh;
	}

	.sample-summary {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.summary-item {
		font-size: 0.9rem;
	}

	.api-documentation {
		margin: 1.5rem 0;
	}

	.doc-section {
		margin-bottom: 1rem;
	}

	.doc-section h5 {
		margin: 0 0 0.5rem 0;
		color: #495057;
		font-size: 1rem;
	}

	.code-block {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 4px;
		padding: 1rem;
		overflow-x: auto;
		font-family: "Courier New", monospace;
		font-size: 0.85rem;
		line-height: 1.4;
		max-height: 300px;
		overflow-y: auto;
	}

	.implementation-tips {
		background: #e7f3ff;
		border-left: 4px solid #0066cc;
		padding: 1rem;
		margin: 0;
	}

	.implementation-tips li {
		margin-bottom: 0.5rem;
		line-height: 1.5;
	}

	.file-types-section {
		margin: 1.5rem 0;
	}

	.file-types-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.file-type-badge {
		background: #e9ecef;
		border: 1px solid #ced4da;
		border-radius: 16px;
		padding: 0.25rem 0.75rem;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	/* 미리보기 모달 스타일 */
	.preview-info {
		background: #e7f3ff;
		border: 1px solid #0066cc;
		border-radius: 4px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.preview-info p {
		margin: 0.25rem 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.preview-info p:first-child {
		font-weight: 500;
		color: #0066cc;
	}

	/* 경고 메시지 스타일 */
	.warning-message {
		background: #fff3cd;
		border: 2px solid #ffc107;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
	}

	.warning-message p {
		margin: 0.5rem 0;
		line-height: 1.5;
	}

	.warning-message ul {
		margin: 1rem 0;
		padding-left: 1.5rem;
	}

	.warning-message li {
		margin-bottom: 0.5rem;
		line-height: 1.4;
	}

	.warning-message p:first-child {
		font-size: 1.1rem;
		color: #856404;
		margin-bottom: 1rem;
	}

	.warning-message p:last-child {
		font-weight: 600;
		color: #721c24;
		text-align: center;
		margin-top: 1rem;
		font-size: 1.1rem;
	}

	/* 실시간 파일 이동 로그 스타일 */
	.movement-status {
		background: #f8f9fa;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.status-indicator {
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.9rem;
	}

	.status-indicator.active {
		background: #fff3cd;
		color: #856404;
		border: 1px solid #ffeaa7;
	}

	.status-indicator.complete {
		background: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.progress-text {
		font-size: 0.9rem;
		color: #495057;
	}

	.movement-logs {
		margin: 1rem 0;
	}

	.logs-header {
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e9ecef;
		color: #495057;
	}

	.logs-container {
		max-height: 400px;
		overflow-y: auto;
		border: 1px solid #e9ecef;
		border-radius: 4px;
		background: #f8f9fa;
	}

	.no-logs {
		padding: 2rem;
		text-align: center;
		color: #6c757d;
		font-style: italic;
	}

	.log-entry {
		padding: 0.75rem;
		border-bottom: 1px solid #e9ecef;
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		animation: slideIn 0.3s ease-out;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.log-entry.success {
		background: linear-gradient(90deg, #d4edda 0%, #f8f9fa 100%);
		border-left: 3px solid #28a745;
	}

	.log-entry.error {
		background: linear-gradient(90deg, #f8d7da 0%, #f8f9fa 100%);
		border-left: 3px solid #dc3545;
	}

	.log-timestamp {
		font-size: 0.8rem;
		color: #6c757d;
		font-family: monospace;
		min-width: 80px;
		flex-shrink: 0;
	}

	.log-content {
		flex: 1;
		line-height: 1.4;
	}

	.log-content strong {
		color: #495057;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* AI 최적화 탭 스타일 */
	.ai-optimization-tabs {
		margin: 1rem 0;
	}

	.tabs-header {
		display: flex;
		border-bottom: 2px solid #e9ecef;
		margin-bottom: 1rem;
		gap: 0.5rem;
	}

	.tab-button {
		background: none;
		border: none;
		padding: 0.75rem 1rem;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		color: #6c757d;
		border-bottom: 3px solid transparent;
		transition: all 0.2s ease;
		border-radius: 4px 4px 0 0;
	}

	.tab-button:hover {
		background-color: #f8f9fa;
		color: #495057;
	}

	.tab-button.active {
		color: #4285f4;
		border-bottom-color: #4285f4;
		background-color: #f8f9fa;
	}

	.tab-content {
		animation: fadeIn 0.3s ease-in;
	}

	.tab-content.hidden {
		display: none;
	}

	.ai-preview-info {
		background: #e7f3ff;
		border: 1px solid #0066cc;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.ai-preview-info p {
		margin: 0.25rem 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.ai-preview-info p:first-child {
		color: #0066cc;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
