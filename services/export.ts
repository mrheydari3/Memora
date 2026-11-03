/**
 * Cross-platform JSON export.
 *
 * `Share.share` is available on native but is a no-op on browsers without the
 * Web Share API (desktop Chrome, most desktop Firefox), so web downloads a file
 * instead of silently doing nothing.
 */

import { Platform, Share } from 'react-native';

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'memora-export';
}

export async function exportJson(fileName: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(fileName)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking synchronously can cancel the download before the browser has
    // read the blob (Safari/Firefox). Give it a tick, then release the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  await Share.share({ message: json, title: `${safeFileName(fileName)}.json` });
}
