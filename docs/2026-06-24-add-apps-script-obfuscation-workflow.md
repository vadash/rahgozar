I will implement the obfuscation workflow like this:

1. Add a root `package.json` with `type: "module"`, an `obfuscate` script (`node scripts/obfuscate-apps-script.mjs`), and `js-confuser` as a dependency so `npm run obfuscate` works from `C:\projects\_vpn\rahgozar`.
2. Add `scripts/obfuscate-apps-script.mjs` that:
   - Reads exactly `Code.cfw.gs`, `Code.gs`, and `CodeFull.gs` from `assets/apps_script`.
   - Uses the lite-style `js-confuser` preset copied from the referenced build script: browser target, variable/global/label renaming, mangled identifiers, compact output, AST scrambler, selective string concealing, and disabled heavier/buggy transforms.
   - Creates or overwrites `assets/apps_script_obfsucated` and writes the obfuscated files there with the same filenames.
3. Update `.gitignore` to exclude `/assets/apps_script_obfsucated/` as requested.
4. Run `npm install` to create/update the root lockfile, then run `npm run obfuscate` to verify the workflow.
5. Review `git status`, `git diff`, and `git diff --cached` for the commit contents and any sensitive data, then commit the tracked changes with a conventional message. I will not commit the ignored obfuscated output directory.