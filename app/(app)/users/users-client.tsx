'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ROLES, ROLE_LABELS, ROLE_BADGE, type Role } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { createUser, updateUser } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  users: UserRow[];
  /** Vai trò người đang xem — quyết định được gán role nào. */
  myRole: Role;
}

export function UsersClient({ users, myRole }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);

  // Form state.
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [role, setRole] = React.useState<Role>('sales');
  const [isActive, setIsActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Nhân sự không được gán/tạo vai trò Chủ.
  const assignableRoles = React.useMemo(
    () => (myRole === 'hr' ? ROLES.filter((r) => r !== 'owner') : ROLES),
    [myRole],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  function openCreate() {
    setEditing(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setRole('sales');
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setFullName(u.full_name);
    setPhone(u.phone ?? '');
    setRole(u.role);
    setIsActive(u.is_active);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error('Vui lòng nhập họ tên');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const r = await updateUser(editing.id, {
          full_name: fullName,
          role,
          phone,
          is_active: isActive,
        });
        if (!r.ok) {
          toast.error(r.error ?? 'Lưu thất bại');
          return;
        }
        toast.success('Đã cập nhật người dùng');
      } else {
        if (!email.trim() || password.length < 6) {
          toast.error('Email và mật khẩu (≥6 ký tự) bắt buộc');
          return;
        }
        const r = await createUser({
          email,
          password,
          full_name: fullName,
          role,
          phone,
        });
        if (!r.ok) {
          toast.error(r.error ?? 'Tạo thất bại');
          return;
        }
        toast.success('Đã tạo người dùng');
      }
      setDialogOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Thêm người dùng
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow
                key={u.id}
                onClick={() => openEdit(u)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}
                  >
                    {ROLE_LABELS[u.role]}
                  </span>
                </TableCell>
                <TableCell>{u.phone ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? 'success' : 'secondary'}>
                    {u.is_active ? 'Hoạt động' : 'Đã khoá'}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(u.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Sửa người dùng' : 'Thêm người dùng mới'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Mật khẩu *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Họ tên *</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Điện thoại</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vai trò *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Tài khoản hoạt động</Label>
                <Switch
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {editing ? 'Cập nhật' : 'Tạo người dùng'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
