'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, UserCheck, Pencil, Trash2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import {
  createLead, updateLead, updateLeadStatus, convertLeadToCustomer, deleteLead,
  LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT, LEAD_SOURCES,
  type Lead, type LeadStatus,
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const STATUS_TABS: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all',        label: 'Tất cả' },
  { value: 'new',        label: 'Mới tiếp nhận' },
  { value: 'consulting', label: 'Đang tư vấn' },
  { value: 'quoted',     label: 'Đã báo giá' },
  { value: 'won',        label: 'Đã chốt' },
  { value: 'lost',       label: 'Đã mất' },
];

interface Props {
  leads: Lead[];
  canEdit: boolean;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  city: string;
  source: string;
  need: string;
  status: LeadStatus;
  assigned_to_email: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '', phone: '', email: '', city: '',
  source: 'Facebook Ads', need: '', status: 'new',
  assigned_to_email: '', notes: '',
};

export function LeadsClient({ leads, canEdit }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<LeadStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lead | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [converting, setConverting] = React.useState<string | null>(null);

  // Pipeline counts
  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (activeTab !== 'all' && l.status !== activeTab) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.phone ?? '').includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.need ?? '').toLowerCase().includes(q)
      );
    });
  }, [leads, query, activeTab]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(lead: Lead) {
    if (!canEdit) return;
    setEditing(lead);
    setForm({
      name: lead.name,
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      city: lead.city ?? '',
      source: lead.source ?? 'Facebook Ads',
      need: lead.need ?? '',
      status: lead.status,
      assigned_to_email: lead.assigned_to_email ?? '',
      notes: lead.notes ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = editing
      ? await updateLead(editing.id, form)
      : await createLead(form);
    setSaving(false);
    if (!result.ok) { toast.error(result.error ?? 'Lưu thất bại'); return; }
    toast.success(editing ? 'Đã cập nhật lead' : 'Đã tạo lead mới');
    setDialogOpen(false);
    router.refresh();
  }

  async function handleStatusChange(id: string, status: LeadStatus) {
    const result = await updateLeadStatus(id, status);
    if (!result.ok) { toast.error('Cập nhật thất bại'); return; }
    toast.success(`Đã chuyển → ${LEAD_STATUS_LABEL[status]}`);
    router.refresh();
  }

  async function handleConvert(id: string) {
    setConverting(id);
    const result = await convertLeadToCustomer(id);
    setConverting(null);
    if (!result.ok) { toast.error(result.error ?? 'Chuyển đổi thất bại'); return; }
    toast.success('Đã tạo khách hàng mới từ lead này');
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Xoá lead này?')) return;
    await deleteLead(id);
    toast.success('Đã xoá');
    router.refresh();
  }

  function field(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      {/* Pipeline summary */}
      <div className="grid grid-cols-5 gap-2">
        {(['new','consulting','quoted','won','lost'] as LeadStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setActiveTab(activeTab === s ? 'all' : s)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              activeTab === s ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
          >
            <div className="text-2xl font-bold">{counts[s] ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{LEAD_STATUS_LABEL[s]}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm tên, SĐT, tỉnh, nhu cầu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 border rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === t.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.value !== 'all' && counts[t.value]
                ? ` (${counts[t.value]})`
                : ''}
            </button>
          ))}
        </div>
        {canEdit && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            Tạo Lead
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Tên KH tiềm năng</TableHead>
              <TableHead>SĐT</TableHead>
              <TableHead>Tỉnh</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead className="max-w-[200px]">Nhu cầu</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  {query ? 'Không tìm thấy lead nào.' : 'Chưa có lead nào.'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((lead) => (
              <TableRow
                key={lead.id}
                className={canEdit ? 'cursor-pointer hover:bg-muted/30' : ''}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">{lead.code}</TableCell>
                <TableCell
                  className="font-medium"
                  onClick={() => openEdit(lead)}
                >
                  {lead.name}
                </TableCell>
                <TableCell>
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3 w-3" />{lead.phone}
                    </a>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm">{lead.city ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{lead.source ?? '—'}</TableCell>
                <TableCell className="max-w-[200px]">
                  <p className="text-xs text-muted-foreground truncate" title={lead.need ?? ''}>
                    {lead.need ?? '—'}
                  </p>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {canEdit ? (
                    <Select
                      value={lead.status}
                      onValueChange={(v) => handleStatusChange(lead.id, v as LeadStatus)}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {LEAD_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
                      {LEAD_STATUS_LABEL[lead.status]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(lead.created_at)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && lead.status === 'won' && !lead.customer_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => handleConvert(lead.id)}
                        disabled={converting === lead.id}
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        {converting === lead.id ? '...' : 'Tạo KH'}
                      </Button>
                    )}
                    {lead.customer_id && (
                      <Badge variant="success" className="text-xs">KH</Badge>
                    )}
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => openEdit(lead)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(lead.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa Lead' : 'Tạo Lead Mới'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Tên KH tiềm năng <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => field('name', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>SĐT</Label>
                <Input value={form.phone} onChange={(e) => field('phone', e.target.value)} placeholder="0900000000" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => field('email', e.target.value)} type="email" />
              </div>
              <div className="space-y-1">
                <Label>Tỉnh/Thành phố</Label>
                <Input value={form.city} onChange={(e) => field('city', e.target.value)} placeholder="HCM, Hà Nội..." />
              </div>
              <div className="space-y-1">
                <Label>Nguồn</Label>
                <Select value={form.source} onValueChange={(v) => field('source', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Trạng thái</Label>
                <Select value={form.status} onValueChange={(v) => field('status', v as LeadStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(LEAD_STATUS_LABEL) as [LeadStatus, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Người phụ trách (email)</Label>
                <Input value={form.assigned_to_email} onChange={(e) => field('assigned_to_email', e.target.value)} type="email" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Nhu cầu</Label>
                <Textarea value={form.need} onChange={(e) => field('need', e.target.value)} rows={2} placeholder="Khách cần gì..." />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Ghi chú thêm</Label>
                <Textarea value={form.notes} onChange={(e) => field('notes', e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Huỷ</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Tạo Lead')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
