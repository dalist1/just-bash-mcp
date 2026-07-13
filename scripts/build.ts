import {build} from 'esbuild'
import {chmod, mkdir, readdir, rm} from 'node:fs/promises'
import {join} from 'node:path'

async function findTypeScriptFiles(path: string): Promise<string[]> {
 const files: string[] = []
 for (const entry of await readdir(path, {withFileTypes: true})) {
  const entryPath = join(path, entry.name)
  if (entry.isDirectory()) {
   files.push(...(await findTypeScriptFiles(entryPath)))
  } else if (entry.name.endsWith('.ts')) {
   files.push(entryPath)
  }
 }
 return files
}

await rm('dist', {recursive: true, force: true})
await mkdir('dist', {recursive: true})
await build({entryPoints: await findTypeScriptFiles('src'), outbase: 'src', outdir: 'dist', platform: 'node', format: 'esm', target: 'node22', sourcemap: true})
await chmod('dist/index.js', 0o755)
