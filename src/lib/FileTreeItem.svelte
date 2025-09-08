<script>
	import { getFileIcon, formatFileSize, formatDate } from "$lib/google-drive.js"

	let { file, level = 0, expandedFolders, loadingFolders, onToggleFolder } = $props()

	const isFolder = $derived(file.mimeType === "application/vnd.google-apps.folder")
	const isExpanded = $derived(expandedFolders.has(file.id))
	const isLoading = $derived(loadingFolders.has(file.id))
	const hasChildren = $derived(file.children && file.children.length > 0)
</script>

<div class="list-item" style="padding-left: {0.5 + level * 1.5}rem;">
	<div class="col-icon">
		{#if isFolder}
			<button class="folder-toggle" onclick={() => onToggleFolder(file)}>
				{#if isLoading}
					🔄
				{:else if isExpanded}
					▼
				{:else}
					▶
				{/if}
			</button>
		{/if}
		<span class="icon">{getFileIcon(file.mimeType)}</span>
	</div>
	<div class="col-name">
		{#if isFolder}
			<button class="folder-link" onclick={() => onToggleFolder(file)} title={file.name}>
				{file.name}
			</button>
		{:else}
			<span class="file-name" title={file.name}>{file.name}</span>
		{/if}
	</div>
	<div class="col-size">
		{formatFileSize(file.size)}
	</div>
	<div class="col-date">
		{formatDate(file.modifiedTime)}
	</div>
	<div class="col-action">
		{#if file.webViewLink}
			<a href={file.webViewLink} target="_blank" class="btn btn-small">열기</a>
		{/if}
	</div>
</div>

<!-- 재귀적으로 자식 파일들 렌더링 (트리뷰에서는 확장된 경우만 표시) -->
{#if hasChildren && isExpanded}
	{#each file.children as childFile}
		<svelte:self 
			file={childFile} 
			level={level + 1} 
			{expandedFolders}
			{loadingFolders}
			{onToggleFolder}
		/>
	{/each}
{/if}

<style>
	.folder-link {
		background: none;
		border: none;
		color: #4285f4;
		cursor: pointer;
		text-align: left;
		font-weight: 500;
		padding: 0;
		text-decoration: underline;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
	}

	.folder-link:hover {
		color: #3367d6;
	}

	.folder-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.2rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.folder-toggle:hover {
		opacity: 0.7;
	}

	.list-item {
		display: grid;
		grid-template-columns: 40px 2fr 100px 150px 80px;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid #f0f0f0;
		align-items: center;
		transition: background-color 0.2s;
	}

	.list-item:hover {
		background-color: #f8f9fa;
	}

	.col-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.col-name {
		min-width: 0;
	}

	.col-size,
	.col-date {
		font-size: 0.85rem;
		color: #6c757d;
	}

	.icon {
		font-size: 1.2rem;
	}

	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.btn-small {
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
	}

	@media (max-width: 768px) {
		.list-item {
			grid-template-columns: 30px 2fr 80px 60px;
			gap: 0.5rem;
		}

		.col-date {
			display: none;
		}

		.col-size {
			font-size: 0.75rem;
		}
	}
</style>