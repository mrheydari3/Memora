#!/usr/bin/env node
/**
 * Design-drift scanner — the static half of a design-consistency audit.
 *
 * It reads the project's own token sources to learn what "on spec" means, then
 * reports the places that bypass them: off-grid spacing, invented radii,
 * literal type sizes, raw Text, hand-rolled pressables, direct Animated calls,
 * manual max-widths, hand-set screen gutters, borders outside the meanings the
 * design language reserves for them, and screens missing the standard shell.
 *
 *   node scan-design-drift.mjs                  # human summary
 *   node scan-design-drift.mjs --json           # machine-readable findings
 *   node scan-design-drift.mjs --root ../app    # another checkout
 *   node scan-design-drift.mjs --rule new-border
 *   node scan-design-drift.mjs --strict         # exit 1 on high/critical
 *   node scan-design-drift.mjs --all            # don't cap the per-rule list
 *
 * It is an audit, not a gate: the default exit code is 0 even with findings.
 * Findings are leads, not verdicts — confirm each one against the design law
 * and, for anything layout-shaped, against a measured frame before reporting it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';

/* ---------------------------------------------------------------- options */

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const at = argv.indexOf(name);
  const next = argv[at + 1];
  return at >= 0 && next && !next.startsWith('--') ? next : fallback;
};

const ROOT = resolve(option('--root', process.cwd()));
const ONLY_RULE = option('--rule', null);
const AS_JSON = argv.includes('--json');
const SHOW_ALL = argv.includes('--all');
const STRICT = argv.includes('--strict');

/* ------------------------------------------------------------- the rules */

const RULES = {
  'spacing-off-grid': {
    severity: 'medium',
    label: 'Spacing value off the 4px grid',
    why: 'Sections and rows align by sharing a step. A 14px gap cannot line up with a 16px one, so the drift is visible side by side.',
  },
  'radius-off-scale': {
    severity: 'medium',
    label: 'Corner radius outside the radius scale',
    why: 'Radii encode hierarchy (control < card < pane < sheet). An invented radius flattens that.',
  },
  'type-literal': {
    severity: 'low',
    label: 'Literal font size instead of a type step',
    why: 'Type steps carry line-height and tracking with them; a bare fontSize usually forgets both.',
  },
  'raw-text': {
    severity: 'high',
    label: 'Raw Text from react-native instead of the text primitive',
    why: 'The primitive owns font family, colour and line-height; raw Text silently falls back to platform defaults.',
  },
  touchable: {
    severity: 'medium',
    label: 'Legacy touchable instead of the project pressable',
    why: 'Mixing touchable implementations gives different press feedback, ripple and focus behaviour on the same screen.',
  },
  'animated-direct': {
    severity: 'medium',
    label: 'Animated.timing/spring called directly in a screen',
    why: 'Motion helpers centralise durations and the reduced-motion path; direct calls skip both.',
  },
  'manual-width': {
    severity: 'low',
    label: 'Manual max width instead of the layout token',
    why: 'A reading column that is 960 on one screen and 980 on another is visible when navigating.',
  },
  'manual-gutter': {
    severity: 'medium',
    label: 'Screen sets its own horizontal padding',
    why: 'The screen shell owns the gutter; a local override makes this screen inset differently from every other.',
  },
  'new-border': {
    severity: 'medium',
    label: 'Border outside the allowed meanings',
    why: 'Borders are the exception in a fill-separated system. A new one adds a third way to separate surfaces.',
  },
  'screen-shell': {
    severity: 'low',
    label: 'Screen without the standard shell switches',
    why: 'Missing gutter/tab clearance is invisible until the page collides with the edge or a floating bar.',
  },
};

const NEAREST = (value, set) =>
  [...set].reduce((best, n) => (Math.abs(n - value) < Math.abs(best - value) ? n : best), Infinity);

/* ------------------------------------------- learn the law from the tokens */

const radii = new Set([10, 14, 18, 22, 24, 28, 9999]);
const spacingSteps = new Set([12, 16, 20, 28, 32, 40, 104]);
const typeSteps = new Set([11, 12, 13, 15, 17, 20, 22, 26, 28, 30, 34, 56]);
const lawSources = [];

/** Adds every number in a (possibly nested) token group. */
const addNumbers = (target, group) => {
  if (typeof group === 'number') target.add(group);
  else if (group && typeof group === 'object') for (const value of Object.values(group)) addNumbers(target, value);
};

const palettePath = join(ROOT, 'theme/palette.js');
if (existsSync(palettePath)) {
  try {
    const palette = createRequire(palettePath)(palettePath);
    addNumbers(radii, palette.radii);
    addNumbers(spacingSteps, palette.spacing);
    for (const step of Object.values(palette.typography ?? {})) {
      if (step && typeof step.fontSize === 'number') typeSteps.add(step.fontSize);
    }
    lawSources.push('theme/palette.js');
  } catch (error) {
    lawSources.push(`theme/palette.js (unreadable: ${error.message})`);
  }
}

// v2 tokens live in TypeScript with `as const`, so read the literal blocks.
const v2Path = join(ROOT, 'theme/v2.ts');
if (existsSync(v2Path)) {
  const source = readFileSync(v2Path, 'utf8');
  const block = (key) => {
    const at = source.indexOf(`${key}: {`);
    if (at < 0) return '';
    const open = source.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}' && --depth === 0) return source.slice(open, i);
    }
    return '';
  };
  for (const match of block('spacing').matchAll(/:\s*(\d+)/g)) spacingSteps.add(Number(match[1]));
  for (const match of block('radii').matchAll(/:\s*(\d+)/g)) radii.add(Number(match[1]));
  for (const match of source.matchAll(/fontSize:\s*(\d+)/g)) typeSteps.add(Number(match[1]));
  lawSources.push('theme/v2.ts');
}

/**
 * Files the design language allows to draw a border. Everything else separates
 * surfaces with fill and depth. Adjust this list to the project being audited —
 * an over-broad list hides real findings, an empty one floods.
 */
const BORDER_ALLOWED = new Set([
  'SearchBar.tsx',
  'RadioOptionCard.tsx',
  'EmptyState.tsx',
  'SheetPanel.tsx',
  'GlassCard.tsx',
  'Flashcard.tsx',
  'CardStack.tsx',
  'RatingButtonRow.tsx',
  'Stepper.tsx',
  'BottomSheetModal.tsx',
]);

/* ------------------------------------------------------------------ walk */

const SKIP = new Set(['node_modules', '.expo', 'dist', '.git', 'assets', 'public', 'ios', 'android']);
const roots = ['app', 'components'].map((dir) => join(ROOT, dir)).filter(existsSync);
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP.has(name)) walk(path);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      files.push(path);
    }
  }
};
roots.forEach(walk);

/* ------------------------------------------------------------------ scan */

/** Sub-16 off-grid gaps are counted, not listed: most are deliberate optical spacing. */
const microSpacing = [];
const findings = [];
const add = (rule, file, line, message, suggestion, severity = RULES[rule].severity) => {
  if (ONLY_RULE && rule !== ONLY_RULE) return;
  findings.push({ rule, severity, file, line, message, suggestion });
};

const lineAt = (source, index) => source.slice(0, index).split('\n').length;

for (const path of files) {
  const rel = relative(ROOT, path).replace(/\\/g, '/');
  const base = rel.split('/').pop();
  const source = readFileSync(path, 'utf8');
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    if (line.includes('design-ignore')) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const at = index + 1;

    for (const match of line.matchAll(
      /\b(padding(?:Top|Bottom|Left|Right|Start|End|Horizontal|Vertical)?|margin(?:Top|Bottom|Left|Right|Start|End|Horizontal|Vertical)?|gap|rowGap|columnGap)\s*:\s*(\d+(?:\.\d+)?)/g
    )) {
      const value = Number(match[2]);
      if (value !== 0 && value % 4 !== 0) {
        if (value < 16) {
          microSpacing.push({ file: rel, line: at, prop: match[1], value });
        } else {
          add(
            'spacing-off-grid',
            rel,
            at,
            `${match[1]}: ${match[2]}`,
            `snap to the 4px grid → ${Math.round(value / 4) * 4}`
          );
        }
      }
    }

    for (const match of line.matchAll(/\bborder(?:TopLeft|TopRight|BottomLeft|BottomRight)?Radius\s*:\s*(\d+(?:\.\d+)?)/g)) {
      const value = Number(match[1]);
      // 40 and up is circle/pill geometry, not a rung on the radius ladder.
      if (value > 0 && value < 40 && !radii.has(value)) {
        add('radius-off-scale', rel, at, `radius: ${match[1]}`, `use ${NEAREST(value, radii)} (radii tokens)`);
      }
    }

    for (const match of line.matchAll(/\bfontSize\s*:\s*(\d+(?:\.\d+)?)/g)) {
      const value = Number(match[1]);
      add(
        'type-literal',
        rel,
        at,
        `fontSize: ${match[1]}`,
        typeSteps.has(value) ? 'matches a step — prefer the text variant/class' : 'not a type step',
        typeSteps.has(value) ? 'low' : 'medium'
      );
    }

    if (rel.startsWith('app/')) {
      const gutter = line.match(/\bpaddingHorizontal\s*:\s*(\d+)/);
      if (gutter && Number(gutter[1]) > 0) {
        add('manual-gutter', rel, at, `paddingHorizontal: ${gutter[1]}`, 'let the screen shell own the gutter');
      }
      if (/\bpx-\[/.test(line)) {
        add('manual-gutter', rel, at, 'px-[…] on a screen', 'use the shell gutter class');
      }
    }

    if (/\bmax-w-\[/.test(line) || /\bmaxWidth\s*:\s*(?:9\d\d|1\d{3})\b/.test(line)) {
      add('manual-width', rel, at, line.trim().slice(0, 60), 'use layout.contentMaxWidth / the reading-column token');
    }

    if (!BORDER_ALLOWED.has(base)) {
      for (const match of line.matchAll(/\bborder(?:Top|Bottom|Left|Right)?Width\s*:\s*(\d+(?:\.\d+)?)/g)) {
        if (Number(match[1]) > 0) {
          add('new-border', rel, at, `borderWidth: ${match[1]}`, 'borders are allowed only for the meanings the law lists');
        }
      }
      if (/\bborder\s+/.test(line) && /className=/.test(line)) {
        add('new-border', rel, at, 'border utility class', 'separate with fill/depth, not a border');
      }
    }
  });

  // File-level checks.
  if (base !== 'AppText.tsx' && /\bimport\s*\{[^}]*\bText\b[^}]*\}\s*from\s*['"]react-native['"]/.test(source)) {
    const at = lineAt(source, source.search(/\bimport\s*\{[^}]*\bText\b[^}]*\}\s*from\s*['"]react-native['"]/));
    add('raw-text', rel, at, 'Text imported from react-native', 'use the project text primitive so font/colour/line-height apply');
  }

  if (/\bTouchableOpacity\b/.test(source)) {
    add('touchable', rel, lineAt(source, source.indexOf('TouchableOpacity')), 'TouchableOpacity', 'use the project pressable/button');
  }

  if (rel.startsWith('app/') && /\bAnimated\.(?:timing|spring)\s*\(/.test(source)) {
    const match = source.match(/\bAnimated\.(?:timing|spring)\s*\(/);
    add('animated-direct', rel, lineAt(source, source.indexOf(match[0])), match[0], 'use the motion helpers (they carry reduced-motion)');
  }

  if (rel.startsWith('app/') && /<Screen\b/.test(source)) {
    let at = -1;
    while ((at = source.indexOf('<Screen', at + 1)) >= 0) {
      const opening = source.slice(at, at + 400);
      if (!/\bgutter\b/.test(opening)) {
        add('screen-shell', rel, lineAt(source, at), '<Screen without gutter', 'use the standard screen switches');
        break;
      }
    }
  }
}

/* ---------------------------------------------------------------- report */

const order = { critical: 0, high: 1, medium: 2, low: 3 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file));

const counts = findings.reduce((totals, finding) => {
  totals[finding.rule] = (totals[finding.rule] ?? 0) + 1;
  return totals;
}, {});

if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        root: ROOT,
        lawSources,
        filesScanned: files.length,
        tokens: { spacing: [...spacingSteps].sort((a, b) => a - b), radii: [...radii].sort((a, b) => a - b), type: [...typeSteps].sort((a, b) => a - b) },
        counts,
        findings,
      },
      null,
      2
    )
  );
} else {
  console.log(`\nDesign-drift scan  ${ROOT}`);
  console.log(`  law:   ${lawSources.length ? lawSources.join(', ') : 'no token files found (using defaults)'}`);
  console.log(`  files: ${files.length}`);

  if (findings.length === 0) {
    console.log(
      ONLY_RULE
        ? `\nNo findings for rule "${ONLY_RULE}".\n`
        : '\nNo drift found by the static rules. Do the reuse and cross-screen passes by hand;\nthose are where the visible inconsistencies live.\n'
    );
  } else {
    const totals = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const finding of findings) totals[finding.severity]++;
    console.log(
      `  drift: ${findings.length} findings  (${Object.entries(totals)
        .filter(([, n]) => n > 0)
        .map(([severity, n]) => `${n} ${severity}`)
        .join(', ')})`
    );

    // Group per rule: one heading per rule even when individual findings are
    // downgraded (a literal that matches a type step is not the same severity).
    const groups = new Map();
    for (const finding of findings) {
      if (!groups.has(finding.rule)) groups.set(finding.rule, []);
      groups.get(finding.rule).push(finding);
    }
    const ordered = [...groups.entries()].sort(
      (a, b) => order[RULES[a[0]].severity] - order[RULES[b[0]].severity] || b[1].length - a[1].length
    );

    for (const [rule, group] of ordered) {
      const meta = RULES[rule];
      console.log(`\n${meta.severity.toUpperCase().padEnd(7)} ${rule}  (${group.length})`);
      console.log(`        ${meta.label}. ${meta.why}`);
      const shown = SHOW_ALL ? group : group.slice(0, 8);
      for (const finding of shown) {
        console.log(`  ${finding.file}:${finding.line}  ${finding.message}`);
        console.log(`        → ${finding.suggestion}`);
      }
      if (group.length > shown.length) console.log(`  … ${group.length - shown.length} more (--all to list)`);
    }

    if (microSpacing.length > 0 && (!ONLY_RULE || ONLY_RULE === 'spacing-off-grid')) {
      const histogram = new Map();
      for (const item of microSpacing) histogram.set(item.value, (histogram.get(item.value) ?? 0) + 1);
      const top = [...histogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      console.log(`\nNOTE    micro spacing under 16px, off the grid  (${microSpacing.length})`);
      console.log('        Sub-16 gaps are usually deliberate optical spacing, so they are counted, not listed.');
      console.log(`        ${top.map(([value, n]) => `${value}px ×${n}`).join(' · ')}`);
      console.log('        → look at them visually; promote one to a finding only when it clashes with a sibling.');
    }

    console.log('\n(--all shows every occurrence; --json for machine output)');
    console.log('');
  }
}

if (STRICT && findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high')) {
  process.exit(1);
}
