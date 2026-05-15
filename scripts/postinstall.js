import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

function main() {
  if (process.platform !== "win32") return;
  if (process.env.npm_config_global !== "true") return;

  const prefix = process.env.npm_config_prefix;
  if (!prefix || !existsSync(prefix)) return;

  const pkgRoot = join(prefix, "node_modules", "@ai-xuyan", "km");
  const entry = join(pkgRoot, "bin", "index.js");
  if (!existsSync(entry)) return;

  const cmdPath = join(prefix, "km.cmd");
  const ps1Path = join(prefix, "km.ps1");

  const cmdContents = `@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0
IF EXIST "%dp0%\\node.exe" (
  SET "_prog=%dp0%\\node.exe"
) ELSE (
  SET "_prog=node"
)
"%_prog%" "%dp0%\\node_modules\\@ai-xuyan\\km\\bin\\index.js" %*
`;

  const ps1Contents = `#!/usr/bin/env pwsh
$basedir = Split-Path $MyInvocation.MyCommand.Definition -Parent
$node = "node"
if ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {
  $localNode = Join-Path $basedir "node.exe"
  if (Test-Path $localNode) {
    $node = $localNode
  }
}
if ($MyInvocation.ExpectingInput) {
  $input | & $node "$basedir/node_modules/@ai-xuyan/km/bin/index.js" $args
} else {
  & $node "$basedir/node_modules/@ai-xuyan/km/bin/index.js" $args
}
exit $LASTEXITCODE
`;

  writeIfChanged(cmdPath, cmdContents);
  writeIfChanged(ps1Path, ps1Contents);
}

function writeIfChanged(filePath, contents) {
  if (existsSync(filePath)) {
    try {
      if (readFileSync(filePath, "utf-8") === contents) return;
    } catch {
      // overwrite below
    }
  }
  writeFileSync(filePath, contents, "utf-8");
}

main();
