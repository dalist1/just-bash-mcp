tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT
for n in $(seq 1 50); do
	printf 'line-%s\n' "$n" >> "${tmp_dir}/data.txt"
done
sort "${tmp_dir}/data.txt" >/dev/null
wc -l < "${tmp_dir}/data.txt" >/dev/null
rm -rf "${tmp_dir}"
trap - EXIT
