const uploadResult = {
	id: 3
}
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

console.log({ ...requestBody })
