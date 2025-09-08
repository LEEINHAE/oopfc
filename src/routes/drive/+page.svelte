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
		<div class="header-content">
			<div class="header-icon clickup-gradient">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="white"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2l5 0c0 0 0 0 0 0l.707.707A1 1 0 0 0 10.414 4H20a2 2 0 0 1 2 2z"
					/>
				</svg>
			</div>
			<div class="header-text">
				<h1 class="clickup-text-gradient">폴더 구조 최적화</h1>
				<p>AI 기반 스마트 폴더 관리</p>
			</div>
		</div>
		{#if isSignedIn}
			<div class="status-indicators">
				<div class="status-item">
					<div class="status-dot connected"></div>
					<span class="status-text connected">Google Drive</span>
				</div>
				<div class="status-item">
					<div class="status-dot {aiApiKey.trim() ? 'connected' : 'disconnected'}"></div>
					<span class="status-text {aiApiKey.trim() ? 'connected' : 'disconnected'}">MISO AI</span>
				</div>
			</div>
		{/if}
	</header>

	{#if !isSignedIn}
		<!-- 히어로 섹션 -->
		<div class="hero-section">
			<div class="hero-content">
				<h2 class="hero-title clickup-text-gradient">폴더 구조를 스마트하게 최적화하세요</h2>
				<p class="hero-description">
					AI 기반 분석으로 복잡한 폴더 구조를 체계적이고 효율적으로 정리합니다
				</p>
			</div>

			<div class="feature-cards">
				<div class="feature-card clickup-card">
					<div class="feature-icon primary-gradient">
						<svg
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							stroke-width="2"
						>
							<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
						</svg>
					</div>
					<h3 class="feature-title">빠른 분석</h3>
					<p class="feature-description">AI가 폴더 구조를 즉시 분석하고 최적화 방안을 제시합니다</p>
				</div>
				<div class="feature-card clickup-card">
					<div class="feature-icon success-gradient">
						<svg
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							stroke-width="2"
						>
							<path d="M9 11l3 3L22 4" />
							<path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
						</svg>
					</div>
					<h3 class="feature-title">안전한 실행</h3>
					<p class="feature-description">자동 백업과 롤백 기능으로 안전하게 폴더를 정리합니다</p>
				</div>
				<div class="feature-card clickup-card">
					<div class="feature-icon info-gradient">
						<svg
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" />
							<polyline points="12,6 12,12 16,14" />
						</svg>
					</div>
					<h3 class="feature-title">시간 절약</h3>
					<p class="feature-description">수동 정리에 소요되는 시간을 대폭 단축시킵니다</p>
				</div>
			</div>

			<div class="hero-cta">
				<button onclick={signIn} class="btn clickup-button-primary hero-button">
					Google Drive 연결하기
				</button>
			</div>
		</div>
	{:else}
		<div class="controls clickup-card">
			<div class="controls-header">
				<div class="controls-icon primary-gradient">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						stroke-width="2"
					>
						<path
							d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
						/>
					</svg>
				</div>
				<div class="controls-text">
					<h3>MISO AI 설정</h3>
					<p>AI 기반 최적화를 위한 API 설정</p>
				</div>
			</div>
			<div class="ai-section">
				<div class="input-group">
					<label for="api-url">워크플로우 API URL</label>
					<input
						id="api-url"
						type="text"
						value="https://api.holdings.miso.gs/ext/v1/workflows/run"
						class="api-input"
						readonly
					/>
				</div>
				<div class="input-group">
					<label for="api-key">MISO API 키</label>
					<div class="input-with-button">
						<input
							id="api-key"
							type="password"
							bind:value={aiApiKey}
							placeholder="API 키를 입력하세요"
							class="api-input"
						/>
						<button
							type="button"
							class="btn clickup-button-secondary"
							onclick={() => (aiApiKey = "app-bSZGH0mzGfJMpXsZNB0VQrh5")}
							title="제공된 API 키 사용"
						>
							🔑 API 키
						</button>
					</div>
				</div>
				<div class="actions-section">
					<div class="action-buttons">
						<button
							class="btn clickup-button-secondary"
							onclick={loadFiles}
							disabled={isLoading}
							title="파일 목록 새로고침"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
								<path d="M21 3v5h-5" />
								<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
								<path d="M3 21v-5h5" />
							</svg>
							새로고침
						</button>
						<button
							class="btn btn-optimize"
							onclick={optimizeWithAI}
							disabled={isOptimizing || !aiApiKey.trim()}
							title="MISO AI로 폴더 구조 최적화"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
							</svg>
							{#if isOptimizing}
								최적화 중...
							{:else}
								MISO AI 최적화
							{/if}
						</button>
						<button
							class="btn btn-test"
							onclick={testOptimizationPreview}
							disabled={isSimulating}
							title="로컬 알고리즘으로 최적화 테스트"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="10" />
								<polyline points="12,6 12,12 16,14" />
							</svg>
							{#if isSimulating}
								테스트 중...
							{:else}
								최적화 테스트
							{/if}
						</button>
						<button class="btn btn-secondary" onclick={signOut} title="Google Drive 연결 해제">
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16,17 21,12 16,7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
							연결 해제
						</button>
					</div>
				</div>
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

	{#if isSignedIn && files.length > 0}
		<div class="files-section">
			<div class="files-section-header">
				<div class="files-section-title">
					<div class="files-section-icon">
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							stroke-width="2"
						>
							<path
								d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2l5 0c0 0 0 0 0 0l.707.707A1 1 0 0 0 10.414 4H20a2 2 0 0 1 2 2z"
							/>
						</svg>
					</div>
					<div>
						<h3>파일 및 폴더</h3>
						<div class="file-count">총 {files.length}개의 루트 항목</div>
					</div>
				</div>
			</div>

			<div class="files-list clickup-card">
				<div class="list-header">
					<div class="col-icon"></div>
					<div class="col-name">이름</div>
					<div class="col-size">크기</div>
					<div class="col-date">수정일</div>
					<div class="col-action">동작</div>
				</div>
				{#each files as file}
					<FileTreeItem
						{file}
						level={0}
						{expandedFolders}
						{loadingFolders}
						onToggleFolder={toggleFolder}
					/>
				{/each}
			</div>
		</div>
	{:else if isSignedIn && !isLoading}
		<div class="empty-state clickup-card">
			<div class="empty-icon">
				<svg
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2l5 0c0 0 0 0 0 0l.707.707A1 1 0 0 0 10.414 4H20a2 2 0 0 1 2 2z"
					/>
				</svg>
			</div>
			<h3>파일이 없습니다</h3>
			<p>Google Drive에서 파일을 불러오거나 새로고침을 시도해보세요</p>
		</div>
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
	:global(body) {
		background: hsl(var(--background));
		min-height: 100vh;
	}

	.container {
		max-width: 1440px;
		margin: 0 auto;
		padding: 24px;
		min-height: 100vh;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0 0;
		margin-bottom: 20px;
		flex-wrap: wrap;
		gap: 16px;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.header-icon {
		padding: 10px;
		border-radius: 12px;
	}

	.header-text h1 {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.015em;
		line-height: 1.1;
	}

	.header-text p {
		margin: 0;
		font-size: 12px;
		color: hsl(var(--muted-foreground));
		font-weight: 400;
	}

	.status-indicators {
		padding: 8px 16px;
		border-radius: 8px;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-dot.connected {
		background: #22c55e;
	}

	.status-dot.disconnected {
		background: hsl(var(--muted-foreground));
	}

	.status-text {
		font-size: 12px;
		font-weight: 500;
	}

	.status-text.connected {
		color: #16a34a;
	}

	.status-text.disconnected {
		color: hsl(var(--muted-foreground));
	}

	/* Hero Section */
	.hero-section {
		text-align: center;
		padding: 48px 0;
		margin-bottom: 48px;
	}

	.hero-content {
		margin-bottom: 48px;
	}

	.hero-cta {
		margin-top: 40px;
	}

	.hero-title {
		font-size: 48px;
		font-weight: 700;
		margin: 0 0 16px 0;
		letter-spacing: -0.025em;
		max-width: 800px;
		margin-left: auto;
		margin-right: auto;
	}

	.hero-description {
		font-size: 20px;
		color: hsl(var(--muted-foreground));
		margin: 0;
		font-weight: 400;
		letter-spacing: -0.01em;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.feature-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 24px;
		max-width: 1000px;
		margin: 0 auto;
	}

	.feature-card {
		padding: 24px;
		text-align: center;
		transition: all 0.3s ease;
	}

	.feature-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.feature-icon {
		width: 64px;
		height: 64px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
	}

	.primary-gradient {
		background: linear-gradient(135deg, hsl(var(--primary)) 0%, #8b5cf6 100%);
	}

	.success-gradient {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
	}

	.info-gradient {
		background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
	}

	.feature-title {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 8px 0;
		color: hsl(var(--foreground));
	}

	.feature-description {
		font-size: 14px;
		color: hsl(var(--muted-foreground));
		margin: 0;
		line-height: 1.5;
	}

	/* Controls */
	.controls {
		margin-bottom: 32px;
		padding: 0;
		border: none;
	}

	.controls-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 20px 24px;
		border-bottom: 1px solid hsl(var(--border));
		background: linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, transparent 100%);
		border-radius: 12px 12px 0 0;
	}

	.controls-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.controls-text h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: hsl(var(--foreground));
	}

	.controls-text p {
		margin: 0;
		font-size: 12px;
		color: hsl(var(--muted-foreground));
	}

	.ai-section {
		padding: 24px 24px 0;
	}

	.ai-section > * + * {
		margin-top: 20px;
	}

	.actions-section {
		padding: 24px;
		border-top: 1px solid hsl(var(--border));
		background: linear-gradient(135deg, rgba(0, 122, 255, 0.02) 0%, transparent 100%);
	}

	.action-buttons {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.input-group {
		margin-bottom: 20px;
	}

	.input-group:last-child {
		margin-bottom: 0;
	}

	.input-group label {
		display: block;
		margin-bottom: 8px;
		font-size: 14px;
		font-weight: 500;
		color: hsl(var(--foreground));
	}

	.input-with-button {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.api-input {
		padding: 12px 16px;
		border: 1px solid hsl(var(--border));
		border-radius: 8px;
		flex: 1;
		font-size: 14px;
		font-family: inherit;
		background: hsl(var(--background));
		transition: all 0.2s ease;
		outline: none;
		color: hsl(var(--foreground));
	}

	.api-input:focus {
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
	}

	.api-input:read-only {
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
	}

	.btn-optimize {
		background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
		color: white;
		position: relative;
	}

	.btn-optimize:hover:not(:disabled) {
		background: linear-gradient(135deg, #e55a2b 0%, #e8851a 100%);
		transform: translateY(-1px);
		box-shadow: 0 8px 20px rgba(255, 107, 53, 0.4);
	}

	.btn-optimize:disabled {
		background: rgba(0, 0, 0, 0.08);
		color: rgba(0, 0, 0, 0.3);
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.btn-test {
		background: linear-gradient(135deg, #6f42c1 0%, #5a35a3 100%);
		color: white;
	}

	.btn-test:hover:not(:disabled) {
		background: linear-gradient(135deg, #5a35a3 0%, #4c2a8a 100%);
		transform: translateY(-1px);
		box-shadow: 0 8px 20px rgba(111, 66, 193, 0.4);
	}

	.btn-test:disabled {
		background: rgba(0, 0, 0, 0.08);
		color: rgba(0, 0, 0, 0.3);
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.optimization-progress {
		background: linear-gradient(135deg, rgba(0, 122, 255, 0.1) 0%, rgba(0, 122, 255, 0.05) 100%);
		color: #007aff;
		padding: 20px 24px;
		border-radius: 18px;
		margin-bottom: 24px;
		text-align: center;
		font-weight: 500;
		font-size: 17px;
		border: 1px solid rgba(0, 122, 255, 0.1);
		backdrop-filter: saturate(180%) blur(20px);
	}

	.test-apply-progress {
		background: linear-gradient(135deg, rgba(255, 149, 0, 0.1) 0%, rgba(255, 149, 0, 0.05) 100%);
		color: #ff9500;
		padding: 20px 24px;
		border-radius: 18px;
		margin-bottom: 24px;
		text-align: center;
		font-weight: 500;
		font-size: 17px;
		border: 1px solid rgba(255, 149, 0, 0.2);
		backdrop-filter: saturate(180%) blur(20px);
	}

	.file-count {
		margin-bottom: 24px;
		color: #86868b;
		font-size: 17px;
		font-weight: 400;
		letter-spacing: -0.022em;
	}

	.files-list {
		background: rgba(255, 255, 255, 0.8);
		border-radius: 18px;
		overflow: hidden;
		backdrop-filter: saturate(180%) blur(20px);
		border: 1px solid rgba(0, 0, 0, 0.04);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
	}

	.list-header {
		display: grid;
		grid-template-columns: 48px 2fr 120px 160px 88px;
		gap: 16px;
		padding: 20px 24px;
		background: rgba(0, 0, 0, 0.02);
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		font-weight: 500;
		font-size: 15px;
		color: #86868b;
		letter-spacing: -0.016em;
	}

	.btn {
		padding: 12px 22px;
		border: none;
		border-radius: 980px;
		cursor: pointer;
		font-size: 17px;
		font-weight: 500;
		font-family: inherit;
		transition: all 0.2s ease;
		outline: none;
		position: relative;
		overflow: hidden;
		white-space: nowrap;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
	}

	.btn-primary {
		background: #007aff;
		color: white;
	}

	.btn-primary:hover {
		background: #0056cc;
		transform: translateY(-1px);
		box-shadow: 0 8px 20px rgba(0, 122, 255, 0.3);
	}

	.btn-primary:active {
		transform: translateY(0);
		box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
	}

	.btn-secondary {
		background: rgba(0, 0, 0, 0.08);
		color: #1d1d1f;
	}

	.btn-secondary:hover {
		background: rgba(0, 0, 0, 0.12);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.btn-secondary:active {
		transform: translateY(0);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.btn-danger {
		background-color: #dc3545;
		color: white;
	}

	.btn-danger:hover {
		background-color: #c82333;
	}

	.error {
		background: linear-gradient(135deg, rgba(255, 59, 48, 0.1) 0%, rgba(255, 59, 48, 0.05) 100%);
		color: #ff3b30;
		padding: 20px 24px;
		border-radius: 18px;
		margin-bottom: 24px;
		border: 1px solid rgba(255, 59, 48, 0.2);
		backdrop-filter: saturate(180%) blur(20px);
		font-weight: 500;
		font-size: 17px;
	}

	.warning {
		background: linear-gradient(135deg, rgba(255, 149, 0, 0.1) 0%, rgba(255, 149, 0, 0.05) 100%);
		color: #ff9500;
		padding: 20px 24px;
		border-radius: 18px;
		margin-bottom: 24px;
		border: 1px solid rgba(255, 149, 0, 0.2);
		backdrop-filter: saturate(180%) blur(20px);
		font-weight: 500;
		font-size: 17px;
	}

	.warning small {
		opacity: 0.8;
	}

	.loading {
		text-align: center;
		padding: 60px 24px;
		color: #86868b;
		font-size: 19px;
		font-weight: 400;
		letter-spacing: -0.022em;
	}

	.empty-state {
		text-align: center;
		padding: 80px 24px;
	}

	.empty-icon {
		color: hsl(var(--muted-foreground));
		margin-bottom: 16px;
	}

	.empty-state h3 {
		margin: 0 0 8px 0;
		font-size: 18px;
		font-weight: 600;
		color: hsl(var(--foreground));
	}

	.empty-state p {
		margin: 0;
		color: hsl(var(--muted-foreground));
		font-size: 14px;
	}

	/* 모든 요소에 부드러운 애니메이션 추가 */
	* {
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* 페이드 인 애니메이션 */
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* 스케일 애니메이션 */
	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* 슬라이드 인 애니메이션 */
	@keyframes slideInFromLeft {
		from {
			opacity: 0;
			transform: translateX(-30px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.container {
		animation: fadeIn 0.6s ease-out;
	}

	header {
		animation: slideInFromLeft 0.8s ease-out;
	}

	.controls {
		animation: scaleIn 0.6s ease-out 0.2s both;
	}

	.files-list {
		animation: scaleIn 0.6s ease-out 0.4s both;
	}

	/* 모달 애니메이션 */
	.modal-overlay {
		animation: fadeIn 0.3s ease-out;
	}

	.modal-content {
		animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@media (max-width: 768px) {
		.container {
			padding: 0 16px;
			min-height: 100vh;
		}

		header {
			flex-direction: column;
			align-items: stretch;
			padding: 24px 0 20px;
			margin-bottom: 32px;
		}

		h1 {
			font-size: 32px;
			text-align: center;
			margin-bottom: 16px;
		}

		.controls {
			flex-direction: column;
			align-items: stretch;
			padding: 20px;
			gap: 12px;
		}

		.api-input {
			min-width: auto;
			width: 100%;
		}

		.btn {
			width: 100%;
			justify-content: center;
		}

		.list-header {
			grid-template-columns: 40px 2fr 80px 60px;
			gap: 12px;
			padding: 16px 20px;
		}

		.action-buttons {
			flex-direction: column;
			gap: 8px;
		}

		.action-buttons .btn {
			width: 100%;
			justify-content: center;
		}
	}

	/* 모달 스타일 */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		border-radius: 20px;
		max-width: 640px;
		max-height: 85vh;
		overflow-y: auto;
		box-shadow:
			0 20px 40px rgba(0, 0, 0, 0.15),
			0 0 0 1px rgba(0, 0, 0, 0.05);
		width: 100%;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 28px 32px 20px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		position: sticky;
		top: 0;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: saturate(180%) blur(20px);
		z-index: 1;
	}

	.modal-header h3 {
		margin: 0;
		color: #1d1d1f;
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	.modal-close {
		background: rgba(0, 0, 0, 0.08);
		border: none;
		font-size: 20px;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: #86868b;
		transition: all 0.2s ease;
		outline: none;
	}

	.modal-close:hover {
		background: rgba(0, 0, 0, 0.12);
		color: #1d1d1f;
		transform: scale(1.1);
	}

	.modal-body {
		padding: 24px 32px 32px;
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
		gap: 12px;
		justify-content: flex-end;
		margin-top: 32px;
		padding-top: 20px;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
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

	/* 큰 모달 스타일 */
	.large-modal {
		max-width: 920px;
		max-height: 90vh;
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
