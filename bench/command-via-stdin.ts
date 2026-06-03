export {};

interface BunSpawnResult {
	exitCode: number;
}

declare const Bun: {
	stdin: ConstructorParameters<typeof Response>[0];
	spawnSync(options: {
		cmd: string[];
		stdin?: Uint8Array;
		stdout: "inherit";
		stderr: "inherit";
	}): BunSpawnResult;
};

const args = new Map(
	process.argv.slice(2).map((arg) => {
		const [key, value = "true"] = arg.split("=", 2);
		return [key, value];
	}),
);

const mode = args.get("--mode") ?? "spawn-lc";
const shell = args.get("--shell") ?? "bash";
const repeat = Number.parseInt(args.get("--repeat") ?? "1", 10);
const encodedScript = new TextEncoder().encode((await new Response(Bun.stdin).text()).trim());

if (!Number.isFinite(repeat) || repeat < 1) {
	throw new Error(`Invalid --repeat value: ${args.get("--repeat") ?? ""}`);
}

if (encodedScript.byteLength === 0) {
	throw new Error("No script received on stdin.");
}

const script = new TextDecoder().decode(encodedScript);

function runOnce(): BunSpawnResult {
	switch (mode) {
		case "spawn-lc":
			return Bun.spawnSync({
				cmd: [shell, "-lc", script],
				stdout: "inherit",
				stderr: "inherit",
			});
		case "spawn-stdin":
			return Bun.spawnSync({
				cmd: [shell],
				stdin: encodedScript,
				stdout: "inherit",
				stderr: "inherit",
			});
		default:
			throw new Error(`Unsupported --mode value: ${mode}`);
	}
}

for (let index = 0; index < repeat; index += 1) {
	const result = runOnce();
	if (result.exitCode !== 0) {
		process.exit(result.exitCode);
	}
}
