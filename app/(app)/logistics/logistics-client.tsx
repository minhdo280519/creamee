'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Truck, Route, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { vnd, cny, formatDate } from '@/lib/utils';
import { LEG_LABEL, type ShipmentLeg } from '@/lib/landed-cost';
import { createCarrier } from './actions';
import { LegForm, type POItemOption } from './leg-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Carrier {
  id: string;
  name: string;
  contact: string | null;
  rate_cny_per_kg: number;
  min_charge_cny: number;
  is_active: boolean;
}
interface LegRow {
  id: string;
  code: string;
  leg: ShipmentLeg;
  total_weight_kg: number;
  total_cost_vnd: number;
  charge_mode: string;
  delay_status: string | null;
  created_at: string;
  carrier?: { name: string } | null;
}
interface POShipRow {
  po_id: string;
  po_code: string;
  supplier_name: string;
  goods_total_vnd: number | null;
  total_ship_cost_vnd: number | null;
  landed_total_vnd: number | null;
  leg_count: number;
}

const LEG_BADGE: Record<ShipmentLeg, 'secondary' | 'warning' | 'default'> = {
  cn_domestic: 'secondary',
  cn_to_vn: 'warning',
  vn_domestic: 'default',
};

interface Props {
  carriers: Carrier[];
  legs: LegRow[];
  poShipRows: POShipRow[];
  poItems: POItemOption[];
  defaultFxRate: number;
}

export function LogisticsClient({
  carriers, legs, poShipRows, poItems, defaultFxRate,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = React.useState<'legs' | 'carriers' | 'cost'>('legs');
  const [legFormOpen, setLegFormOpen] = React.useState(false);
  const [carrierDialogOpen, setCarrierDialogOpen] = React.useState(false);

  const [cName, setCName] = React.useState('');
  const [cContact, setCContact] = React.useState('');
  const [cRate, setCRate] = React.useState(0);
  const [cMin, setCMin] = React.useState(0);

  async function handleCreateCarrier() {
    if (!cName.trim()) {
      toast.error('Vui lòng nhập tên đơn vị vận chuyển');
      return;
    }
    const r = await createCarrier({
      name: cName,
      contact: cContact,
      rate_cny_per_kg: cRate,
      min_charge_cny: cMin,
    });
    if (!r.ok) {
      toast.error(r.error ?? 'Tạo thất bại');
      return;
    }
    toast.success('Đã thêm đơn vị vận chuyển');
    setCarrierDialogOpen(false);
    setCName(''); setCContact(''); setCRate(0); setCMin(0);
    router.refresh();
  }

  const tabs: { key: typeof tab; label: string; icon: typeof Route }[] = [
    { key: 'legs', label: 'Chặng vận chuyển', icon: Route },
    { key: 'carriers', label: 'Đơn vị vận chuyển', icon: Truck },
    { key: 'cost', label: 'Chi phí theo đơn mua', icon: Receipt },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
                tab === t.key
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: chặng vận chuyển ── */}
      {tab === 'legs' && (
        <div>
          <div className="mb-4 flex justify-end">
            <Button
              onClick={() => setLegFormOpen(true)}
              disabled={poItems.length === 0}
            >
              <Plus className="h-4 w-4" />
              Tạo chặng vận chuyển
            </Button>
          </div>
          {poItems.length === 0 ? (
            <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
              Chưa có dòng đơn mua nào để ghép vào chặng. Hãy tạo đơn nhập trước.
            </div>
          ) : legs.length === 0 ? (
            <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
              Chưa có chặng vận chuyển nào.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã chặng</TableHead>
                    <TableHead>Loại chặng</TableHead>
                    <TableHead>Đơn vị VC</TableHead>
                    <TableHead className="text-right">Trọng lượng</TableHead>
                    <TableHead className="text-right">Tổng chi phí</TableHead>
                    <TableHead>Cách tính</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.code}</TableCell>
                      <TableCell>
                        <Badge variant={LEG_BADGE[l.leg]}>
                          {LEG_LABEL[l.leg]}
                        </Badge>
                      </TableCell>
                      <TableCell>{l.carrier?.name ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {Number(l.total_weight_kg || 0).toFixed(2)} kg
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {vnd(l.total_cost_vnd)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.charge_mode === 'per_kg' ? 'Theo kg' : 'Trọn gói'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(l.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: đơn vị vận chuyển ── */}
      {tab === 'carriers' && (
        <div>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setCarrierDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Thêm đơn vị VC
            </Button>
          </div>
          {carriers.length === 0 ? (
            <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
              Chưa có đơn vị vận chuyển nào.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên đơn vị</TableHead>
                    <TableHead>Liên hệ</TableHead>
                    <TableHead className="text-right">Đơn giá (¥/kg)</TableHead>
                    <TableHead className="text-right">Phí tối thiểu</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carriers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.contact ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.rate_cny_per_kg} ¥
                      </TableCell>
                      <TableCell className="text-right">
                        {cny(c.min_charge_cny)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? 'success' : 'secondary'}>
                          {c.is_active ? 'Hoạt động' : 'Ngừng'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: chi phí ship phân theo PO ── */}
      {tab === 'cost' && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Chi phí vận chuyển của mọi chặng được phân bổ theo trọng lượng và
            cộng dồn về từng đơn mua. Giá vốn cuối (landed) = tiền hàng + ship.
          </p>
          {poShipRows.length === 0 ? (
            <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu chi phí.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã PO</TableHead>
                    <TableHead>Nhà cung cấp</TableHead>
                    <TableHead className="text-right">Tiền hàng</TableHead>
                    <TableHead className="text-right">Chi phí ship</TableHead>
                    <TableHead className="text-right">Tổng landed</TableHead>
                    <TableHead className="text-right">Số chặng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poShipRows.map((p) => (
                    <TableRow key={p.po_id}>
                      <TableCell className="font-medium">{p.po_code}</TableCell>
                      <TableCell>{p.supplier_name}</TableCell>
                      <TableCell className="text-right">
                        {p.goods_total_vnd != null
                          ? vnd(p.goods_total_vnd)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {p.total_ship_cost_vnd != null
                          ? '+ ' + vnd(p.total_ship_cost_vnd)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {p.landed_total_vnd != null
                          ? vnd(p.landed_total_vnd)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.leg_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Dialog tạo chặng */}
      <Dialog open={legFormOpen} onOpenChange={setLegFormOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Tạo chặng vận chuyển</DialogTitle>
          </DialogHeader>
          <LegForm
            carriers={carriers}
            poItems={poItems}
            defaultFxRate={defaultFxRate}
            onClose={() => setLegFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog thêm carrier */}
      <Dialog open={carrierDialogOpen} onOpenChange={setCarrierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm đơn vị vận chuyển</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c_name">Tên đơn vị *</Label>
              <Input
                id="c_name"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="VD: Vận chuyển Đông Hưng"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c_contact">Thông tin liên hệ</Label>
              <Input
                id="c_contact"
                value={cContact}
                onChange={(e) => setCContact(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c_rate">Đơn giá (¥/kg)</Label>
                <Input
                  id="c_rate"
                  type="number"
                  step={0.5}
                  value={cRate}
                  onChange={(e) => setCRate(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c_min">Phí tối thiểu (¥)</Label>
                <Input
                  id="c_min"
                  type="number"
                  value={cMin}
                  onChange={(e) => setCMin(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCarrierDialogOpen(false)}
              >
                Huỷ
              </Button>
              <Button onClick={handleCreateCarrier}>Thêm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
