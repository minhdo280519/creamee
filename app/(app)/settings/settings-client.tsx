'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Key, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveLLMKey, removeLLMKey, updateAppSetting } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Provider = 'claude' | 'openai' | 'gemini';

const PROVIDERS: { key: Provider; name: string; hint: string }[] = [
  { key: 'claude', name: 'Anthropic Claude', hint: 'sk-ant-...' },
  { key: 'openai', name: 'OpenAI', hint: 'sk-...' },
  { key: 'gemini', name: 'Google Gemini', hint: 'AIza...' },
];

interface Props {
  /** Trạng thái key đã cấu hình: provider → preview (đã che) hoặc null. */
  keyPreviews: Record<Provider, string | null>;
  settings: { order_approval_threshold: number; fx_cny_vnd: number };
}

export function SettingsClient({ keyPreviews, settings }: Props) {
  const router = useRouter();
  const [keyInputs, setKeyInputs] = React.useState<Record<Provider, string>>({
    claude: '',
    openai: '',
    gemini: '',
  });
  const [threshold, setThreshold] = React.useState(
    settings.order_approval_threshold,
  );
  const [fxRate, setFxRate] = React.useState(settings.fx_cny_vnd);

  async function handleSaveKey(provider: Provider) {
    const key = keyInputs[provider];
    if (!key.trim()) {
      toast.error('Vui lòng nhập API key');
      return;
    }
    const r = await saveLLMKey(provider, key);
    if (!r.ok) {
      toast.error(r.error ?? 'Lưu thất bại');
      return;
    }
    toast.success('Đã lưu API key (đã mã hoá)');
    setKeyInputs((prev) => ({ ...prev, [provider]: '' }));
    router.refresh();
  }

  async function handleRemoveKey(provider: Provider) {
    if (!window.confirm('Xoá API key này?')) return;
    const r = await removeLLMKey(provider);
    if (!r.ok) {
      toast.error(r.error ?? 'Xoá thất bại');
      return;
    }
    toast.success('Đã xoá API key');
    router.refresh();
  }

  async function handleSaveSettings() {
    const r1 = await updateAppSetting('order_approval_threshold', threshold);
    const r2 = await updateAppSetting('fx_cny_vnd', fxRate);
    if (!r1.ok || !r2.ok) {
      toast.error('Lưu cài đặt thất bại');
      return;
    }
    toast.success('Đã lưu cài đặt');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* LLM API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            API Key cho trợ lý AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            API key được mã hoá AES-256 trước khi lưu. Hệ thống không bao giờ
            hiển thị lại key đầy đủ.
          </p>
          {PROVIDERS.map((p) => {
            const preview = keyPreviews[p.key];
            return (
              <div key={p.key} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{p.name}</span>
                  {preview ? (
                    <Badge variant="success">Đã cấu hình</Badge>
                  ) : (
                    <Badge variant="secondary">Chưa cấu hình</Badge>
                  )}
                </div>
                {preview && (
                  <p className="mb-2 font-mono text-xs text-muted-foreground">
                    {preview}
                  </p>
                )}
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={p.hint}
                    value={keyInputs[p.key]}
                    onChange={(e) =>
                      setKeyInputs((prev) => ({
                        ...prev,
                        [p.key]: e.target.value,
                      }))
                    }
                  />
                  <Button size="sm" onClick={() => handleSaveKey(p.key)}>
                    <Save className="h-3.5 w-3.5" />
                    Lưu
                  </Button>
                  {preview && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveKey(p.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cài đặt nghiệp vụ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cài đặt nghiệp vụ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="threshold">
              Ngưỡng duyệt đơn bán (VND)
            </Label>
            <Input
              id="threshold"
              type="number"
              step={1000000}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Đơn vượt mức này sẽ cần quản lý duyệt.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fx">Tỷ giá CNY → VND mặc định</Label>
            <Input
              id="fx"
              type="number"
              value={fxRate}
              onChange={(e) => setFxRate(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Tự cập nhật mỗi ngày qua cron, có thể chỉnh tay.
            </p>
          </div>
          <Button onClick={handleSaveSettings}>
            <Save className="h-4 w-4" />
            Lưu cài đặt
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
