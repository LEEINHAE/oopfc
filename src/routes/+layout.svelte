<script>
	import favicon from "$lib/assets/favicon.svg"

	let { children } = $props()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav>
	<a href="/" class="nav-link">홈</a>
	<a href="/drive" class="nav-link">Google Drive</a>
</nav>

{@render children?.()}

<style>
	nav {
		background-color: #f8f9fa;
		padding: 1rem 2rem;
		border-bottom: 1px solid #e9ecef;
		margin-bottom: 2rem;
	}

	.nav-link {
		text-decoration: none;
		color: #495057;
		margin-right: 1rem;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.nav-link:hover {
		background-color: #e9ecef;
		color: #212529;
	}

	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		background-color: #f8f9fa;
	}
</style>
