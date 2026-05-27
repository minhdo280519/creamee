'use client';

import * as React from 'react';
import { vnd, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ARRow {
  order_id: string;
  order_code: string;
  customer_name: string;
  total: number;
  paid: number;
  outstanding: number;
  days_outstanding: number;
}
interface APRow {
  po_id: string;
  po_code: string;
  supplier_name: string;
  total_cny: number;
  paid_cny: number;
  outstanding_cny: number;
}

interface Props {
  receivables: ARRow[];
  payables: APRow[];
}

/** Phân loại tuổi nợ → màu badge. */
function agingBadge(days: number): { label: string; variant: 'success' | 'warning' | 'destructive' } {
  if (days <= 15) return { label: `${days} ngày`, variant: 'success' };
  if (days <= 30) return { label: `${days} ngày`, variant: 'warning' };
  return { label: `${days} ngày — quá hạn`, variant: 'destructive' };
}

export function ArApClient({ receivables, payables }: Props) {
  const [tab, setTab] = React.useState<'ar' | 'ap'>('ar');

  const totalAR = receivables.reduce((s, r) => s + r.outstanding, 0);
  const overdueAR = receivables
    .filter((r) => r.days_outstanding > 30)
    .reduce((s, r) => s + r.outstanding, 0);
  const totalAP = payables.reduce((s, p) => s + p.outstanding_cny, 0);

  return (
    <div>
      {/* Tổng quan */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tổng phải thu</p>
            <p className="text-lg font-semibold">{vnd(totalAR)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Phải thu quá hạn</p>
            <p className="text-lg font-semibold text-red-700">{vnd(overdueAR)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tổng phải trả NCC</p>
            <p className="text-lg font-semibold">{totalAP.toLocaleString('vi')} ¥</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b">
        <button
          onClick={() => setTab('ar')}
          className={`border-b-2 px-3 py-2 text-sm ${
            tab === 'ar'
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground'
          }`}
        >
          Phải thu khách hàng ({receivables.length})
        </button>
        <button
          onClick={() => setTab('ap')}
          className={`border-b-2 px-3 py-2 text-sm ${
            tab === 'ap'
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground'
          }`}
        >
          Phải trả nhà cung cấp ({payables.length})
        </button>
      </div>

      {tab === 'ar' ? (
        receivables.length === 0 ? (
          <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
            Không có công nợ phải thu.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="text-right">Tổng đơn</TableHead>
                  <TableHead className="text-right">Đã thu</TableHead>
                  <TableHead className="text-right">Còn nợ</TableHead>
                  <TableHead>Tuổi nợ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.map((r) => {
                  const aging = agingBadge(r.days_outstanding);
                  return (
                    <TableRow key={r.order_id}>
                      <TableCell className="font-medium">{r.order_code}</TableCell>
                      <TableCell>{r.customer_name}</TableCell>
                      <TableCell className="text-right">{vnd(r.total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {vnd(r.paid)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-700">
                        {vnd(r.outstanding)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={aging.variant}>{aging.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      ) : payables.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          Không có công nợ phải trả.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã PO</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead className="text-right">Tổng (¥)</TableHead>
                <TableHead className="text-right">Đã trả (¥)</TableHead>
                <TableHead className="text-right">Còn nợ (¥)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payables.map((p) => (
                <TableRow key={p.po_id}>
                  <TableCell className="font-medium">{p.po_code}</TableCell>
                  <TableCell>{p.supplier_name}</TableCell>
                  <TableCell className="text-right">
                    {p.total_cny.toLocaleString('vi')} ¥
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.paid_cny.toLocaleString('vi')} ¥
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-700">
                    {p.outstanding_cny.toLocaleString('vi')} ¥
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
