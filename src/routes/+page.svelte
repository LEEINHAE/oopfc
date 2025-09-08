<script>
	import { goto } from "$app/navigation"
	import { onMount } from "svelte"

	onMount(() => {
		goto("/drive", { replaceState: true })
	})
</script>
