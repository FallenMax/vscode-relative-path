import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

type PathType = 'relative' | 'workspaceRelative' | 'absolute';

//-------------- ripgrep discovery --------------

/** Find the ripgrep binary bundled with the host VSCode / Cursor app. */
function findRgPath(): string {
  const bin = process.platform === 'win32' ? 'rg.exe' : 'rg';
  const candidates = [
    path.join(vscode.env.appRoot, 'node_modules', '@vscode', 'ripgrep', 'bin', bin),
    path.join(vscode.env.appRoot, 'node_modules.asar.unpacked', '@vscode', 'ripgrep', 'bin', bin),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return 'rg'; // fall back to system rg
}

//-------------- file listing --------------

/** List all files in a workspace folder using ripgrep, respecting ignore files and exclude settings. */
function listFiles(workspaceRoot: string): Promise<string[]> {
  const searchConfig = vscode.workspace.getConfiguration('search');
  const filesConfig = vscode.workspace.getConfiguration('files');

  const useIgnoreFiles = searchConfig.get<boolean>('useIgnoreFiles', true);
  const filesExclude = filesConfig.get<Record<string, boolean>>('exclude', {});
  const searchExclude = searchConfig.get<Record<string, boolean>>('exclude', {});

  const args: string[] = ['--files'];

  if (!useIgnoreFiles) {
    args.push('--no-ignore');
  }

  // Translate files.exclude + search.exclude into rg --glob '!pattern'
  const allExcludes = { ...filesExclude, ...searchExclude };
  for (const [pattern, enabled] of Object.entries(allExcludes)) {
    if (enabled) {
      args.push('--glob', `!${pattern}`);
    }
  }

  return new Promise((resolve) => {
    execFile(findRgPath(), args, { cwd: workspaceRoot, maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) {
        resolve([]);
        return;
      }
      const lines = stdout.split('\n').filter(Boolean);
      resolve(lines);
    });
  });
}

//-------------- path insertion --------------

const titleLabel: Record<PathType, string> = {
  relative: 'Insert Path: Relative to Current File',
  workspaceRelative: 'Insert Path: Relative to Workspace Root',
  absolute: 'Insert Path: Absolute',
};

/** Show a file picker and insert the chosen path at all cursors. */
async function pickAndInsertPath(pathType: PathType): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Insert File Path: no active editor.');
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath ?? '';
  const currentDir = path.dirname(editor.document.uri.fsPath);

  const qp = vscode.window.createQuickPick();
  qp.title = titleLabel[pathType];
  qp.placeholder = 'Type to filter files…';
  qp.matchOnDescription = false;
  qp.busy = true;
  qp.show();

  const relPaths = await listFiles(workspaceRoot);

  qp.items = relPaths.map((relPath) => {
    const abs = path.join(workspaceRoot, relPath);
    const wsRelative = workspaceRoot ? path.relative(workspaceRoot, abs) : abs;

    let insertValue: string;
    if (pathType === 'relative') {
      let rel = path.relative(currentDir, abs);
      if (!rel.startsWith('.')) {
        rel = './' + rel;
      }
      insertValue = rel;
    } else if (pathType === 'workspaceRelative') {
      insertValue = wsRelative;
    } else {
      insertValue = abs;
    }

    return {
      label: wsRelative,
      description: insertValue !== wsRelative ? insertValue : '',
      ...(({ _insertValue: insertValue } as unknown) as object),
    } as vscode.QuickPickItem & { _insertValue: string };
  });

  qp.busy = false;

  await new Promise<void>((resolve) => {
    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0] as (vscode.QuickPickItem & { _insertValue: string }) | undefined;
      qp.hide();

      if (!selected) {
        resolve();
        return;
      }

      editor.edit((editBuilder) => {
        for (const selection of editor.selections) {
          editBuilder.replace(selection, selected._insertValue);
        }
      });

      resolve();
    });

    qp.onDidHide(() => resolve());
  });

  qp.dispose();
}

//-------------- activation --------------

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('insert-path.relative', () => pickAndInsertPath('relative')),
    vscode.commands.registerCommand('insert-path.workspaceRelative', () => pickAndInsertPath('workspaceRelative')),
    vscode.commands.registerCommand('insert-path.absolute', () => pickAndInsertPath('absolute')),
  );
}

export function deactivate(): void {}
