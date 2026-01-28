import fs from 'node:fs/promises'
import { exists as fileExists } from 'node:fs'
import { $ } from 'bun'
import {
  WasmCompiler,
  Pair,
  SymbolNode,
  NumberNode,
  BooleanNode,
} from './bobwat'
import wat2Wasm from './wat2wasm'

const compiler = new WasmCompiler()

console.log('Compiler', compiler)

let result

result = compiler.compile(
  new Pair(
    new SymbolNode('lambda'),
    new Pair(
      [],
      new Pair(
        new SymbolNode('+'),
        new Pair(new NumberNode(1), new NumberNode(2))
      )
    )
  )
)

// console.log('Result', result)
// console.log('Stream', compiler.stream)

console.log(
  'Compiler',
  Object.keys(compiler).reduce((obj, key) => {
    if (key !== 'stream') {
      obj[key] = compiler[key]
    }
    return obj
  }, {})
)

let targetFile = 'build/wasm-test.wat'
await fs.writeFile(targetFile, compiler.stream)

async function $run(...args) {
  try {
    const result = await $(...args)
    console.log(result.stdout)
  } catch (e) {
    // console.error(e.stderr.toString())
  }
}

// await $run`wat2wasm --enable-all ${targetFile}`

// const compiledFile = targetFile.replace('.wat', '.wasm')
// if (await fs.exists(compiledFile)) {
//   console.log('Run compiled', compiledFile)
//   await $run`wasmtime ${compiledFile}`
// }

console.log('Compiling Wasm text to binary')
await wat2Wasm({
  arguments: [
    '--verbose',
    '--enable-all',
    '--enable-annotations',
    '--enable-code-metadata',
    '--enable-compact-imports',
    '--enable-exceptions',
    '--enable-extended-const',
    '--enable-function-references',
    '--enable-gc',
    '--enable-memory64',
    '--enable-multi-memory',
    '--enable-relaxed-simd',
    '--enable-tail-call',
    '--enable-threads',
    'build/wasm-test.wat',
    '-o',
    'build/wasm-test.wasm'
  ],
})
console.log('Compiled')


async function runWasm(file) {
  if (!(await fs.exists(file))) {
    console.error(`Wasm file not found: ${file}`)
    process.exit(1)
  }

  const bytes = await fs.readFile(file)
  let importObject = {
    env: {
      write_char: (n) => {
        process.stdout.write(String.fromCharCode(n))
      },
      write_i32: (n) => {
        process.stdout.write(`${n}`)
      },
    },
  }
  let obj = await WebAssembly.instantiate(new Uint8Array(bytes), importObject)
  let start = obj.instance.exports.start
  start()
}

await runWasm('./build/wasm-test.wasm')
