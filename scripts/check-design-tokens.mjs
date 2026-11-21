/**
 * Design-token guard.
 *
 * Fails when the code drifts from the shared design language. The colour rule
 * is unchanged: no raw colour literal may appear outside `theme/`.
 *
 * The v3 structure rules cover the drift that used to be fixed by hand:
 *
 *   1. Icon sizes — `<MaterialIcons …>` (and any `*Icons` glyph) must take
 *      `size` from `iconSize`, never a numeric literal.
 *   2. Top-level insets — in `app/`, a `Surface tone="inset"` must sit inside a
 *      pane, menu or sheet. `inset` is nested content, not a page card.
 *   3. Redundant Surface defaults — `radius="pane"` and `padding="md"` restate
 *      the component's defaults. `tone` stays explicit because it names the
 *      surface's role.
 *   4. One scene per screen — a component may not render more than one
 *      unconditional `Surface tone="scene"`. Scenes in alternate branches
 *      (ternary, `&&`, `if`/`switch`) are allowed because only one paints.
 *
 * Every violation is reported as `file:line` with its rule. Escape hatch: a
 * trailing `// design-ignore` comment on the reported line, used sparingly for
 * cases the static rule cannot see (for example an inset owned by a component
 * that renders its own pane).
 *
 * Run: npm run check:design
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const ROOTS = ['app', 'components'];
const EXTENSIONS = /\.(tsx?|jsx?)$/;
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/;
const SKIP_DIRECTORIES = new Set(['node_modules', '.expo', 'dist', '.git']);
/** A panel component is a valid parent for nested content. */
const PANEL_TAGS = new Set([
  'BottomSheetModal',
  'Menu',
  'SheetPanel',
  'SheetScrollView',
  'Surface',
]);
const IGNORE = 'design-ignore';

/**
 * Border exceptions from design-language §10. These files own a documented
 * semantic edge: the scene rim, an input's focus ring, a selected radio, an
 * empty-state frame or the sheet surface. Everything else separates with fill.
 * Review's selection chrome is marked line-by-line with `design-ignore` because
 * the route also owns ordinary panes that must not gain a border.
 */
const BORDER_ALLOWLIST = new Set([
  'components/BottomSheetModal.tsx',
  'components/EmptyState.tsx',
  'components/Field.tsx',
  'components/LiquidTabBar.tsx',
  'components/QuizAnswer.tsx',
  'components/RadioOptionCard.tsx',
  'components/SegmentedControl.tsx',
  'components/ToggleSwitch.tsx',
  'components/v3/FloatingHeader.tsx',
  'components/v3/Surface.tsx',
]);

const BORDER_PROPERTY =
  /^border(?:Top|Bottom|Left|Right|Start|End)?(?:Width|Color|Style)$/;
const GUTTER_PROPERTY = /^(?:padding|margin)Horizontal$/;
const HIT_BOX_CLASS = /(?:^|\s)(?:min-)?h-(?:11|12|13|14|15|16|\[44px\])(?:\s|$)/;

function isZeroish(expression) {
  if (ts.isNumericLiteral(expression)) return Number(expression.text) === 0;
  if (ts.isStringLiteral(expression)) {
    return expression.text === '0' || expression.text === 'transparent';
  }
  return false;
}

function propertyName(node, sourceFile) {
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) {
    return node.name.text;
  }
  return node.name.getText(sourceFile);
}

function numericProperty(node, sourceFile, names) {
  if (!ts.isPropertyAssignment(node)) return null;
  if (!names.includes(propertyName(node, sourceFile))) return null;
  if (ts.isNumericLiteral(node.initializer)) return Number(node.initializer.text);
  return null;
}

/** Sized tokens are already guaranteed to clear the 44px target. */
function isHitToken(expression) {
  if (!ts.isPropertyAccessExpression(expression)) return false;
  const text = expression.getText();
  return (
    text === 'heights.hit' ||
    text === 'heights.tileLg' ||
    text === 'heights.iconLg' ||
    text === 'heights.button' ||
    text === 'heights.buttonSm' ||
    text === 'v3.heights.answer' ||
    text === 'v3.heights.quizAnswer'
  );
}

/** A raw Pressable needs a role and a declared 44px target. */
function hasPressableHitBox(node, sourceFile) {
  const style = attribute(node, 'style', sourceFile);
  if (style) {
    let enough = false;
    const visitStyle = (child) => {
      const value = numericProperty(child, sourceFile, ['minHeight', 'height']);
      if (value !== null && value >= 44) enough = true;
      if (
        ts.isPropertyAssignment(child) &&
        ['minHeight', 'height'].includes(propertyName(child, sourceFile)) &&
        isHitToken(child.initializer)
      ) {
        enough = true;
      }
      ts.forEachChild(child, visitStyle);
    };
    if (style.initializer) visitStyle(style.initializer);
    if (enough) return true;
  }

  const hitSlop = attribute(node, 'hitSlop', sourceFile);
  if (hitSlop?.initializer) {
    const expression = ts.isJsxExpression(hitSlop.initializer)
      ? hitSlop.initializer.expression
      : hitSlop.initializer;
    if (expression && ts.isNumericLiteral(expression) && Number(expression.text) >= 44) return true;
  }

  const className = stringValue(node, 'className', sourceFile) ?? '';
  return HIT_BOX_CLASS.test(className);
}

const files = [];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRECTORIES.has(name)) walk(path);
    } else if (EXTENSIONS.test(name)) {
      files.push(path);
    }
  }
}

for (const root of ROOTS) walk(root);

const violations = [];

function report(file, sourceFile, node, rule, message) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const text = sourceFile.text.split('\n')[line - 1] ?? '';
  if (text.includes(IGNORE)) return;
  violations.push({ file, line, rule, message });
}

const relativePath = (file) => relative(process.cwd(), file).split(sep).join('/');
const isJsx = (node) => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
const opening = (node) => (ts.isJsxElement(node) ? node.openingElement : node);
const tagName = (node, sourceFile) => opening(node).tagName.getText(sourceFile);

function attribute(node, name, sourceFile) {
  for (const property of opening(node).attributes.properties) {
    if (ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name) {
      return property;
    }
  }
  return null;
}

function stringValue(node, name, sourceFile) {
  const attr = attribute(node, name, sourceFile);
  if (!attr || !attr.initializer || !ts.isStringLiteral(attr.initializer)) return null;
  return attr.initializer.text;
}

function numericSize(node, sourceFile) {
  const attr = attribute(node, 'size', sourceFile);
  if (!attr || !attr.initializer) return null;
  const expression = ts.isJsxExpression(attr.initializer)
    ? attr.initializer.expression
    : attr.initializer;
  if (!expression) return null;
  if (ts.isNumericLiteral(expression)) return expression.text;
  if (ts.isStringLiteral(expression) && /^\d+$/.test(expression.text)) return expression.text;
  return null;
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function functionName(node, sourceFile) {
  if (node.name) return node.name.getText(sourceFile);
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent)) return parent.name.getText(sourceFile);
  return 'component';
}

/** A scene inside a branch cannot paint alongside the other branch. */
function isConditional(node, boundary) {
  let parent = node.parent;
  while (parent && parent !== boundary) {
    if (
      ts.isConditionalExpression(parent) ||
      ts.isIfStatement(parent) ||
      ts.isCaseClause(parent) ||
      ts.isDefaultClause(parent)
    ) {
      return true;
    }
    if (ts.isBinaryExpression(parent)) {
      const operator = parent.operatorToken.kind;
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        return true;
      }
    }
    parent = parent.parent;
  }
  return false;
}

/** Scenes in one component, excluding scenes owned by nested components. */
function scenesIn(node, sourceFile) {
  const scenes = [];
  const walk = (child) => {
    if (child !== node.body && isFunctionLike(child)) return;
    if (isJsx(child) && tagName(child, sourceFile) === 'Surface') {
      if (stringValue(child, 'tone', sourceFile) === 'scene') scenes.push(child);
    }
    ts.forEachChild(child, walk);
  };
  if (node.body) walk(node.body);
  return scenes;
}

function checkSourceFile(rel, sourceFile) {
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node, sourceFile);
      if (BORDER_PROPERTY.test(name) && !isZeroish(node.initializer)) {
        if (!BORDER_ALLOWLIST.has(rel)) {
          report(
            rel,
            sourceFile,
            node,
            'border',
            `${name} outside a §10 border exception; separate with fill`
          );
        }
      }
      if (rel.startsWith('app/') && GUTTER_PROPERTY.test(name) && ts.isNumericLiteral(node.initializer)) {
        if (Number(node.initializer.text) === 20) {
          report(
            rel,
            sourceFile,
            node,
            'gutter-literal',
            `${name}: 20 duplicates spacing.screen; use the token`
          );
        }
      }
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (BORDER_PROPERTY.test(name)) {
        const initializer = node.initializer;
        const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
        if (expression && !isZeroish(expression) && !BORDER_ALLOWLIST.has(rel)) {
          report(rel, sourceFile, node, 'border', `${name} outside a §10 border exception`);
        }
      }
      if (rel.startsWith('app/') && GUTTER_PROPERTY.test(name)) {
        const initializer = node.initializer;
        const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
        if (expression && ts.isNumericLiteral(expression) && Number(expression.text) === 20) {
          report(rel, sourceFile, node, 'gutter-literal', `${name}={20} duplicates spacing.screen`);
        }
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const target = node.expression.getText(sourceFile);
      const name = node.name.text;
      if (target === 'rims' && !BORDER_ALLOWLIST.has(rel)) {
        report(rel, sourceFile, node, 'border', `rims.${name} outside a §10 rim exception`);
      }
      if (target === 'Animated' && (name === 'timing' || name === 'spring')) {
        report(
          rel,
          sourceFile,
          node,
          'raw-animation',
          `Animated.${name} outside motion/; use timingTo/springTo`
        );
      }
    }

    if (ts.isIdentifier(node) && node.text === 'rimColor') {
      const parent = node.parent;
      const imported = ts.isImportSpecifier(parent) || ts.isImportClause(parent);
      if (!imported && !BORDER_ALLOWLIST.has(rel)) {
        report(rel, sourceFile, node, 'border', 'rimColor outside a §10 rim exception');
      }
    }

    if (isJsx(node)) {
      const tag = tagName(node, sourceFile);

      if (tag === 'Pressable' && rel.startsWith('app/')) {
        const role = attribute(node, 'accessibilityRole', sourceFile);
        if (!role) {
          report(
            rel,
            sourceFile,
            node,
            'raw-pressable',
            '<Pressable> in app/ needs accessibilityRole'
          );
        } else if (!hasPressableHitBox(node, sourceFile)) {
          report(
            rel,
            sourceFile,
            node,
            'raw-pressable',
            '<Pressable> in app/ needs a 44px hit box (minHeight/height/hitSlop)'
          );
        }
      }

      if (/Icons$/.test(tag)) {
        const size = numericSize(node, sourceFile);
        if (size !== null) {
          const attr = attribute(node, 'size', sourceFile) ?? node;
          report(
            rel,
            sourceFile,
            attr,
            'icon-size',
            `size={${size}} on <${tag}>; use iconSize.*`
          );
        }
      }

      if (tag === 'Surface') {
        const tone = stringValue(node, 'tone', sourceFile);
        if (tone === 'inset' && rel.startsWith('app/')) {
          let parent = node.parent;
          let nested = false;
          while (parent && !ts.isSourceFile(parent)) {
            if (isJsx(parent) && PANEL_TAGS.has(tagName(parent, sourceFile))) {
              nested = true;
              break;
            }
            parent = parent.parent;
          }
          if (!nested) {
            report(
              rel,
              sourceFile,
              node,
              'top-level-inset',
              '<Surface tone="inset"> must sit inside a pane, menu or sheet'
            );
          }
        }

        if (stringValue(node, 'radius', sourceFile) === 'pane') {
          report(
            rel,
            sourceFile,
            attribute(node, 'radius', sourceFile),
            'surface-default',
            'radius="pane" is Surface\'s default'
          );
        }
        if (stringValue(node, 'padding', sourceFile) === 'md') {
          report(
            rel,
            sourceFile,
            attribute(node, 'padding', sourceFile),
            'surface-default',
            'padding="md" is Surface\'s default'
          );
        }
      }
    }

    if (isFunctionLike(node)) {
      const unconditional = scenesIn(node, sourceFile).filter(
        (scene) => !isConditional(scene, node)
      );
      if (unconditional.length > 1) {
        const name = functionName(node, sourceFile);
        unconditional.slice(1).forEach((scene) => {
          report(
            rel,
            sourceFile,
            scene,
            'scene',
            `more than one unconditional <Surface tone="scene"> in ${name}()`
          );
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relativePath(file);

  text.split('\n').forEach((line, index) => {
    if (RAW_COLOUR.test(line) && !line.includes(IGNORE)) {
      violations.push({
        file: rel,
        line: index + 1,
        rule: 'colour',
        message: 'raw colour literal outside theme/',
      });
    }
  });

  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  checkSourceFile(rel, sourceFile);
}

violations.sort(
  (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule)
);

if (violations.length > 0) {
  console.error(`Design tokens: ${violations.length} violation(s)\n`);
  console.error(
    violations
      .map(({ file, line, rule, message }) => `${file}:${line}  [${rule}] ${message}`)
      .join('\n')
  );
  process.exit(1);
}

console.log(`Design tokens: clean (${files.length} files checked)`);
