import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

export function globalSkillsDir() {
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(config, 'opencode', 'skills');
}

export function projectSkillsDir(cwd = process.cwd()) {
  return resolve(cwd, '.opencode', 'skills');
}

export function claudeSkillsDir() {
  return join(homedir(), '.claude', 'skills');
}

export function parseInstallerArgs(argv) {
  const options = {
    project: false,
    claude: false,
    force: false,
    dryRun: false,
    help: false,
    target: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') options.project = true;
    else if (arg === '--claude') options.claude = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--target') {
      const value = argv[index + 1];
      if (!value) throw new Error('--target necesita una ruta de destino.');
      options.target = value;
      index += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`Opción desconocida: ${arg}`);
    } else {
      throw new Error(`Argumento inesperado: ${arg}`);
    }
  }

  if (options.project && options.claude) {
    throw new Error('Usa --project o --claude, no ambos.');
  }
  if (options.target && (options.project || options.claude)) {
    throw new Error('Usa --target o --project/--claude, no ambos.');
  }

  return options;
}

export function resolveInstallTarget(options, cwd = process.cwd()) {
  if (options.target) return resolve(cwd, options.target);
  if (options.project) return join(projectSkillsDir(cwd), 'soffia');
  if (options.claude) return join(claudeSkillsDir(), 'soffia');
  return join(globalSkillsDir(), 'soffia');
}

function printHelp() {
  console.log(`Instala la skill soffia en OpenCode.

Uso:
  node install.mjs [opciones]

Opciones:
  --project     Instala en .opencode/skills/soffia del directorio actual.
  --claude      Instala en ~/.claude/skills/soffia (compatibilidad).
  --target DIR  Instala en la carpeta DIR (debe llamarse soffia).
  --force       Borra la instalación anterior antes de copiar.
  --dry-run     Muestra lo que haría sin copiar archivos.
  --help, -h    Muestra esta ayuda.

Por defecto instala en:
  ~/.config/opencode/skills/soffia
  (o $XDG_CONFIG_HOME/opencode/skills/soffia si está definido)
`);
}

export function runInstaller(source, argv) {
  let options;
  try {
    options = parseInstallerArgs(argv);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }

  if (options.help) {
    printHelp();
    return 0;
  }

  const resolvedSource = resolve(source);
  const skillFile = join(resolvedSource, 'SKILL.md');
  if (!existsSync(skillFile)) {
    console.error(`Error: no se encontró ${skillFile}.`);
    return 1;
  }

  const target = resolveInstallTarget(options);
  if (basename(target) !== 'soffia') {
    console.error(
      `Error: el destino debe ser una carpeta llamada soffia (recibido: ${target}).`,
    );
    return 2;
  }

  const sourceWithSep = `${resolvedSource}${sep}`;
  if (target === resolvedSource || target.startsWith(sourceWithSep)) {
    console.error('Error: el destino no puede estar dentro de la skill de origen.');
    return 2;
  }

  if (existsSync(target)) {
    const stats = statSync(target);
    if (!stats.isDirectory()) {
      console.error(`Error: ${target} existe y no es una carpeta.`);
      return 1;
    }
    if (options.force) {
      if (options.dryRun) {
        console.log(`[dry-run] Borraría ${target}`);
      } else {
        rmSync(target, { recursive: true, force: true });
      }
    } else {
      console.log(
        'La instalación ya existe; se actualizarán los archivos. Usa --force para una copia limpia.',
      );
    }
  }

  if (options.dryRun) {
    console.log(`[dry-run] Copiaría ${resolvedSource}`);
    console.log(`[dry-run] en ${target}`);
    return 0;
  }

  mkdirSync(dirname(target), { recursive: true });
  cpSync(resolvedSource, target, { recursive: true, force: true });

  console.log(`Skill soffia instalada en:\n  ${target}`);
  console.log('\nValida un deck con:');
  console.log(
    `  node "${join(target, 'scripts', 'validate.mjs')}" ruta/al/deck.md`,
  );
  return 0;
}
