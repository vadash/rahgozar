import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import JsConfuser from 'js-confuser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = join(__dirname, '../assets/apps_script');
const OUT_DIR = join(__dirname, '../assets/apps_script_obfsucated');

const FILES = ['Code.cfw.gs', 'Code.gs', 'CodeFull.gs'];

async function obfuscateFile(srcPath, outPath) {
  const sourceCode = readFileSync(srcPath, 'utf8');

  const options = {
    target: 'browser',

    // Selective string concealing — encode all strings for lite protection
    stringConcealing: true,
    renameVariables: true,
    renameGlobals: true,
    renameLabels: true,
    identifierGenerator: 'mangled',

    compact: true,
    hexadecimalNumbers: true,
    astScrambler: true,

    // Disabled for performance / compatibility
    calculator: false,
    deadCode: false,
    dispatcher: false,
    duplicateLiteralsRemoval: false,
    flatten: false,
    preserveFunctionLength: false,
    stringSplitting: false,
    movedDeclarations: false,
    objectExtraction: false,

    // Slow — disabled
    globalConcealing: false,
    opaquePredicates: false,
    variableMasking: false,

    // Buggy — disabled
    controlFlowFlattening: false,
    minify: false,
    rgf: false,

    // Security locks — disabled
    lock: {
      antiDebug: false,
      integrity: false,
      selfDefending: false,
      tamperProtection: false,
    },
  };

  const result = await JsConfuser.obfuscate(sourceCode, options);
  writeFileSync(outPath, result.code, 'utf8');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const file of FILES) {
    const srcPath = join(SRC_DIR, file);
    const outPath = join(OUT_DIR, file);
    console.log(`Obfuscating ${file}...`);
    await obfuscateFile(srcPath, outPath);
    console.log(`  -> ${outPath}`);
  }

  console.log('Done!');
}

main().catch((err) => {
  console.error('Obfuscation failed:', err);
  process.exit(1);
});
