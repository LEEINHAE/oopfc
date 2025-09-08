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
		color: #007aff;
		cursor: pointer;
		text-align: left;
		font-weight: 500;
		padding: 0;
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
		font-size: 17px;
		transition: all 0.2s ease;
		font-family: inherit;
		outline: none;
	}

	.folder-link:hover {
		color: #0056cc;
		transform: translateX(2px);
	}

	.folder-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 18px;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: all 0.2s ease;
		color: #86868b;
		width: 28px;
		height: 28px;
		outline: none;
	}

	.folder-toggle:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #1d1d1f;
		transform: scale(1.1);
	}

	.list-item {
		display: grid;
		grid-template-columns: 48px 2fr 120px 160px 88px;
		gap: 16px;
		padding: 16px 24px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
		align-items: center;
		transition: all 0.2s ease;
		position: relative;
	}

	.list-item:hover {
		background: rgba(0, 0, 0, 0.02);
		transform: translateX(2px);
	}

	.list-item:last-child {
		border-bottom: none;
	}

	.col-icon {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
	}

	.col-name {
		min-width: 0;
	}

	.col-size,
	.col-date {
		font-size: 15px;
		color: #86868b;
		font-weight: 400;
		letter-spacing: -0.016em;
	}

	.icon {
		font-size: 20px;
	}

	.file-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
		font-size: 17px;
		color: #1d1d1f;
		letter-spacing: -0.022em;
	}

	.btn {
		padding: 8px 16px;
		border: none;
		border-radius: 20px;
		cursor: pointer;
		font-size: 15px;
		font-weight: 500;
		transition: all 0.2s ease;
		background: #007aff;
		color: white;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		outline: none;
		font-family: inherit;
	}

	.btn:hover {
		background: #0056cc;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
	}

	.btn-small {
		padding: 6px 12px;
		font-size: 14px;
		min-height: 32px;
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
