<script>
	import { getFileIcon } from "$lib/google-drive.js"

	let { comparison } = $props()

	// 트리 구조를 평면으로 렌더링 (경로 포함)
	function renderTree(files, level = 0, parentPath = '') {
		const items = []
		
		files.forEach(file => {
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
				<strong>이동될 파일:</strong> {comparison?.changes.movedFiles?.length || 0}개
			</div>
			<div class="stat-item">
				<strong>새 폴더:</strong> {comparison?.changes.newFolders?.length || 0}개
			</div>
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
						{#if file.id?.startsWith('temp_')}
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
	}

	.comparison-header {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.comparison-header h4 {
		margin: 0 0 0.5rem 0;
	}

	.summary-stats {
		display: flex;
		gap: 2rem;
	}

	.stat-item {
		font-size: 0.9rem;
	}

	.moved-files-section,
	.new-folders-section {
		margin-bottom: 1.5rem;
	}

	.moved-files-section h5,
	.new-folders-section h5 {
		margin: 0 0 0.75rem 0;
		color: #495057;
	}

	.moved-files-list,
	.new-folders-list {
		border: 1px solid #e9ecef;
		border-radius: 4px;
		max-height: 200px;
		overflow-y: auto;
	}

	.moved-file-item,
	.new-folder-item {
		padding: 0.75rem;
		border-bottom: 1px solid #f0f0f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.moved-file-item:last-child,
	.new-folder-item:last-child {
		border-bottom: none;
	}

	.file-info,
	.new-folder-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.file-icon,
	.folder-icon {
		font-size: 1.1rem;
	}

	.file-name,
	.folder-name {
		font-weight: 500;
	}

	.folder-path {
		color: #6c757d;
		font-size: 0.85rem;
	}

	.move-path {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.old-path {
		color: #dc3545;
		text-decoration: line-through;
	}

	.arrow {
		color: #28a745;
		font-weight: bold;
	}

	.new-path {
		color: #28a745;
		font-weight: 500;
	}

	.trees-comparison {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}

	.tree-section {
		border: 1px solid #e9ecef;
		border-radius: 4px;
		overflow: hidden;
	}

	.tree-section h5 {
		margin: 0;
		padding: 0.75rem;
		background: #f8f9fa;
		border-bottom: 1px solid #e9ecef;
	}

	.tree-view {
		max-height: 300px;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.tree-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: 0.9rem;
	}

	.icon {
		font-size: 1rem;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.new-badge {
		background: #28a745;
		color: white;
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: 10px;
		margin-left: auto;
	}

	@media (max-width: 768px) {
		.trees-comparison {
			grid-template-columns: 1fr;
		}
		
		.summary-stats {
			flex-direction: column;
			gap: 0.5rem;
		}
		
		.move-path {
			flex-direction: column;
			gap: 0.25rem;
			text-align: right;
		}
	}
</style>