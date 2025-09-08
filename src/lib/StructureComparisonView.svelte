<script>
	import { getFileIcon } from "$lib/google-drive.js"

	let { comparison } = $props()

	// 트리 구조를 평면으로 렌더링 (경로 포함)
	function renderTree(files, level = 0, parentPath = "") {
		const items = []

		files.forEach((file) => {
			const currentPath = parentPath ? `${parentPath}/${file.name}` : file.name
			items.push({ file, level, path: currentPath })

			if (file.children && file.children.length > 0) {
				const subItems = renderTree(file.children, level + 1, currentPath)
				items.push(...subItems)
			}
		})

		return items
	}

	const originalItems = $derived(renderTree(comparison?.original.rootFiles || []))
	const optimizedItems = $derived(renderTree(comparison?.optimized.rootFiles || []))
</script>

<div class="structure-comparison">
	<div class="comparison-header">
		<h4>📊 구조 변경 요약</h4>
		<div class="summary-stats">
			<div class="stat-item">
				<strong>이동될 파일:</strong>
				{comparison?.changes.movedFiles?.length || 0}개
			</div>
			<div class="stat-item">
				<strong>새 폴더:</strong>
				{comparison?.changes.newFolders?.length || 0}개
			</div>
			{#if comparison?.changes.deletedFolders?.length > 0}
				<div class="stat-item danger">
					<strong>삭제될 폴더:</strong>
					{comparison.changes.deletedFolders.length}개
				</div>
			{/if}
		</div>
	</div>

	{#if comparison?.changes.movedFiles?.length > 0}
		<div class="moved-files-section">
			<h5>🚚 이동될 파일들</h5>
			<div class="moved-files-list">
				{#each comparison.changes.movedFiles as movedFile}
					<div class="moved-file-item">
						<div class="file-info">
							<span class="file-icon">{getFileIcon(movedFile.mimeType)}</span>
							<span class="file-name">{movedFile.name}</span>
						</div>
						<div class="move-path">
							<span class="old-path">{movedFile.oldPath}</span>
							<span class="arrow">→</span>
							<span class="new-path">{movedFile.newPath}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if comparison?.changes.newFolders?.length > 0}
		<div class="new-folders-section">
			<h5>📁 새로 생성될 폴더들</h5>
			<div class="new-folders-list">
				{#each comparison.changes.newFolders as newFolder}
					<div class="new-folder-item">
						<span class="folder-icon">📁</span>
						<span class="folder-name">{newFolder.name}</span>
						<span class="folder-path">({newFolder.path})</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if comparison?.changes.deletedFolders?.length > 0}
		<div class="deleted-folders-section">
			<h5>🗑️ 삭제될 폴더들</h5>
			<div class="deleted-folders-list">
				{#each comparison.changes.deletedFolders as deletedFolder}
					<div class="deleted-folder-item">
						<span class="folder-icon">🗑️</span>
						<span class="folder-name">{deletedFolder.name}</span>
						<span class="folder-path">({deletedFolder.path})</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="trees-comparison">
		<div class="tree-section">
			<h5>📂 현재 구조</h5>
			<div class="tree-view">
				{#each originalItems as { file, level, path }}
					<div class="tree-item" style="padding-left: {level * 1.5}rem;">
						<span class="icon">{getFileIcon(file.mimeType)}</span>
						<span class="name">{file.name}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="tree-section">
			<h5>✨ 최적화된 구조</h5>
			<div class="tree-view">
				{#each optimizedItems as { file, level, path }}
					<div class="tree-item" style="padding-left: {level * 1.5}rem;">
						<span class="icon">{getFileIcon(file.mimeType)}</span>
						<span class="name">{file.name}</span>
						{#if file.id?.startsWith("temp_")}
							<span class="new-badge">새 폴더</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.structure-comparison {
		max-height: 70vh;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
	}

	.structure-comparison::-webkit-scrollbar {
		width: 6px;
	}

	.structure-comparison::-webkit-scrollbar-track {
		background: transparent;
	}

	.structure-comparison::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 3px;
	}

	.structure-comparison::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.3);
	}

	.comparison-header {
		background: rgba(0, 0, 0, 0.02);
		padding: 24px;
		border-radius: 18px;
		margin-bottom: 24px;
		border: 1px solid rgba(0, 0, 0, 0.04);
	}

	.comparison-header h4 {
		margin: 0 0 12px 0;
		font-size: 21px;
		font-weight: 600;
		color: #1d1d1f;
		letter-spacing: -0.015em;
	}

	.summary-stats {
		display: flex;
		gap: 32px;
		flex-wrap: wrap;
	}

	.stat-item {
		font-size: 17px;
		color: #86868b;
		font-weight: 400;
		letter-spacing: -0.022em;
	}

	.stat-item strong {
		color: #1d1d1f;
		font-weight: 500;
	}

	.stat-item.danger {
		color: #ff3b30;
	}

	.stat-item.danger strong {
		color: #ff3b30;
	}

	.moved-files-section,
	.new-folders-section,
	.deleted-folders-section {
		margin-bottom: 32px;
	}

	.moved-files-section h5,
	.new-folders-section h5,
	.deleted-folders-section h5 {
		margin: 0 0 16px 0;
		color: #1d1d1f;
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	.moved-files-list,
	.new-folders-list,
	.deleted-folders-list {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		max-height: 240px;
		overflow-y: auto;
		background: rgba(255, 255, 255, 0.5);
		backdrop-filter: saturate(180%) blur(20px);
	}

	.deleted-folders-list {
		background: rgba(255, 59, 48, 0.05);
		border: 1px solid rgba(255, 59, 48, 0.2);
	}

	.moved-file-item,
	.new-folder-item,
	.deleted-folder-item {
		padding: 16px 20px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: background-color 0.2s ease;
	}

	.moved-file-item:hover,
	.new-folder-item:hover,
	.deleted-folder-item:hover {
		background: rgba(0, 0, 0, 0.02);
	}

	.deleted-folder-item:hover {
		background: rgba(255, 59, 48, 0.1);
	}

	.moved-file-item:last-child,
	.new-folder-item:last-child,
	.deleted-folder-item:last-child {
		border-bottom: none;
	}

	.file-info,
	.new-folder-item,
	.deleted-folder-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.file-icon,
	.folder-icon {
		font-size: 18px;
	}

	.file-name,
	.folder-name {
		font-weight: 500;
		font-size: 17px;
		color: #1d1d1f;
		letter-spacing: -0.022em;
	}

	.folder-path {
		color: #86868b;
		font-size: 15px;
		font-weight: 400;
		letter-spacing: -0.016em;
	}

	.move-path {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		font-weight: 400;
	}

	.old-path {
		color: #ff3b30;
		text-decoration: line-through;
		opacity: 0.7;
	}

	.arrow {
		color: #34c759;
		font-weight: 600;
		font-size: 16px;
	}

	.new-path {
		color: #34c759;
		font-weight: 500;
	}

	.trees-comparison {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		margin-top: 32px;
	}

	.tree-section {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.5);
		backdrop-filter: saturate(180%) blur(20px);
	}

	.tree-section h5 {
		margin: 0;
		padding: 16px 20px;
		background: rgba(0, 0, 0, 0.02);
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
		font-size: 17px;
		font-weight: 600;
		color: #1d1d1f;
		letter-spacing: -0.022em;
	}

	.tree-view {
		max-height: 360px;
		overflow-y: auto;
		padding: 12px 8px;
	}

	.tree-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px 6px 24px;
		font-size: 15px;
		transition: background-color 0.2s ease;
		color: #1d1d1f;
		letter-spacing: -0.022em;
	}

	.tree-item:hover {
		background: rgba(0, 0, 0, 0.02);
	}

	.icon {
		font-size: 16px;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 400;
	}

	.new-badge {
		background: #34c759;
		color: white;
		font-size: 12px;
		font-weight: 500;
		padding: 4px 8px;
		border-radius: 12px;
		margin-left: auto;
		letter-spacing: -0.016em;
	}

	@media (max-width: 768px) {
		.trees-comparison {
			grid-template-columns: 1fr;
			gap: 16px;
		}

		.summary-stats {
			flex-direction: column;
			gap: 12px;
		}

		.move-path {
			flex-direction: column;
			gap: 8px;
			text-align: right;
		}

		.comparison-header {
			padding: 20px;
		}

		.moved-file-item,
		.new-folder-item {
			padding: 12px 16px;
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}
	}
</style>
