import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { SettingsClient } from './settings-client';

export const metadata = { title: 'Cài đặt — CREAMEE ERP' };

type Provider = 'claude' | 'openai' | 'gemini';

export default async function SettingsPage() {
  await requireAccess('/settings');

  const [{ rows: integrations }, { rows: settingsRows }] = await Promise.all([
    query<{ name: string; config: string; is_active: number }>(
      "SELECT name, config, is_active FROM integrations WHERE type = 'llm'",
    ),
    query<{ key: string; value: number }>(
      "SELECT `key`, value FROM app_settings WHERE `key` IN ('order_approval_threshold','fx_cny_vnd')",
    ),
  ]);

  const keyPreviews: Record<Provider, string | null> = {
    claude: null, openai: null, gemini: null,
  };
  for (const row of integrations) {
    if (!row.is_active) continue;
    const provider = row.name.replace('llm_', '') as Provider;
    if (provider in keyPreviews) {
      try {
        const cfg = JSON.parse(row.config) as { key_preview?: string };
        keyPreviews[provider] = cfg.key_preview ?? null;
      } catch { /* ignore */ }
    }
  }

  const settingsMap = new Map(settingsRows.map((r) => [r.key, Number(r.value)]));

  return (
    <div>
      <PageHeader
        title="Cài đặt hệ thống"
        description="Cấu hình API trợ lý AI và tham số nghiệp vụ"
      />
      <SettingsClient
        keyPreviews={keyPreviews}
        settings={{
          order_approval_threshold: settingsMap.get('order_approval_threshold') ?? 50_000_000,
          fx_cny_vnd: settingsMap.get('fx_cny_vnd') ?? 4060,
        }}
      />
    </div>
  );
}
