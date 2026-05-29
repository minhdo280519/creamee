'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, formatDate } from '@/lib/utils';
import { createDeal, moveDealStage, type DealStage } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox';

interface Deal {
  id: string;
  code: string;
  title: string;
  customer_id: string | null;
  customer_name_snapshot: string | null;
  stage: DealStage;
  estimated_value: number | null;
  probability_pct: number;
  expected_close_date: string | null;
  next_action: string | null;
  customer?: { name: string } | null;
}

/** 6 cột pipeline. */
const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'new', label: 'Mới', color: 'border-t-slate-400' },
  { key: 'qualified', label: 'Đã xác định', color: 'border-t-sky-400' },
  { key: 'proposal', label: 'Báo giá', color: 'border-t-blue-400' },
  { key: 'negotiation', label: 'Đàm phán', color: 'border-t-amber-400' },
  { key: 'won', label: 'Thắng', color: 'border-t-emerald-400' },
  { key: 'lost', label: 'Thua', color: 'border-t-red-400' },
];

interface Props {
  deals: Deal[];
  customers: EntityOption[];
  onQuickCreateCustomer: (name: string) => Promise<EntityOption>;
}

export function DealsBoard({ deals, customers, onQuickCreateCustomer }: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState(deals);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Form tạo deal.
  const [title, setTitle] = React.useState('');
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [estValue, setEstValue] = React.useState(0);
  const [closeDate, setCloseDate] = React.useState('');
  const [nextAction, setNextAction] = React.useState('');

  React.useEffect(() => {
    setItems(deals);
  }, [deals]);

  function dealsByStage(stage: DealStage) {
    return items.filter((d) => d.stage === stage);
  }

  function stageTotal(stage: DealStage) {
    return dealsByStage(stage).reduce((s, d) => s + (d.estimated_value ?? 0), 0);
  }

  async function handleDrop(stage: DealStage) {
    if (!dragId) return;
    const deal = items.find((d) => d.id === dragId);
    if (!deal || deal.stage === stage) {
      setDragId(null);
      return;
    }

    // Optimistic: chuyển ngay trên UI.
    setItems((prev) =>
      prev.map((d) => (d.id === dragId ? { ...d, stage } : d)),
    );
    setDragId(null);

    const r = await moveDealStage(deal.id, stage);
    if (!r.ok) {
      toast.error(r.error ?? 'Chuyển cột thất bại');
      setItems(deals); // rollback
      return;
    }
    router.refresh();
  }

  async function handleCreate() {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên cơ hội');
      return;
    }
    const r = await createDeal({
      title,
      customer_id: customerId || undefined,
      estimated_value: estValue,
      expected_close_date: closeDate || undefined,
      next_action: nextAction || undefined,
    });
    if (!r.ok) {
      toast.error(r.error ?? 'Tạo thất bại');
      return;
    }
    toast.success('Đã tạo cơ hội bán hàng');
    setDialogOpen(false);
    setTitle('');
    setCustomerId(null);
    setEstValue(0);
    setCloseDate('');
    setNextAction('');
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Thêm cơ hội
        </Button>
      </div>

      {/* Board ngang, cuộn được */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageDeals = dealsByStage(stage.key);
          return (
            <div
              key={stage.key}
              className="flex w-72 flex-shrink-0 flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
            >
              <div
                className={`rounded-t-lg border-t-4 bg-muted/50 px-3 py-2 ${stage.color}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {stageDeals.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {vnd(stageTotal(stage.key))}
                </p>
              </div>

              <div className="flex min-h-[200px] flex-col gap-2 rounded-b-lg bg-muted/20 p-2">
                {stageDeals.map((deal) => (
                  <Card
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragId(deal.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab active:cursor-grabbing ${
                      dragId === deal.id ? 'opacity-50' : ''
                    }`}
                  >
                    <CardContent className="space-y-1.5 p-3">
                      <p className="text-sm font-medium leading-tight">
                        {deal.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deal.customer?.name ??
                          deal.customer_name_snapshot ??
                          'Khách tiềm năng'}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-semibold text-foreground">
                          {vnd(deal.estimated_value)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {deal.probability_pct}%
                        </span>
                      </div>
                      {deal.expected_close_date && (
                        <p className="text-xs text-muted-foreground">
                          Dự kiến: {formatDate(deal.expected_close_date)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {stageDeals.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Kéo thẻ vào đây
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm cơ hội bán hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Tên cơ hội *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Đơn sỉ mùa đông shop ABC"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Khách hàng</Label>
              <EntityCombobox
                options={customers}
                value={customerId}
                onChange={setCustomerId}
                entityLabel="khách hàng"
                placeholder="Chọn hoặc tạo khách hàng"
                onCreate={onQuickCreateCustomer}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="value">Giá trị dự kiến</Label>
                <Input
                  id="value"
                  type="number"
                  step={1000}
                  value={estValue}
                  onChange={(e) => setEstValue(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="close">Ngày chốt dự kiến</Label>
                <Input
                  id="close"
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="action">Bước tiếp theo</Label>
              <Input
                id="action"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="VD: Gọi lại tư vấn bảng size"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={handleCreate}>Tạo cơ hội</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
