import {createBashInstance, type BashOptions, type InitialFiles} from 'just-bash-mcp'
import {strict as assert} from 'node:assert'
import {test} from 'node:test'

void test('exports a typed, importable public API from the compiled package entrypoint', async () => {
 const files: InitialFiles = {'/typed.txt': 'typed'}
 const options: BashOptions = {files}
 assert.deepEqual(options.files, files)

 const result = await createBashInstance(files).exec('cat /typed.txt')
 assert.equal(result.exitCode, 0)
 assert.equal(result.stdout, 'typed')
})
