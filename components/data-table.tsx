'use client';

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { FieldSchema } from '@/lib/schema-form';
import { vnd, num, formatDate, cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface DataTableProps<T extends Record<string, unknown>> {
  fields: FieldSchema[];
  rows: T[];
  /** Cột thêm ngoài schema (VD: trạng thái có badge). */
  extraColumns?: {
    key: string;
    label: string;
    render: (row: T) => React.ReactNode;
  }[];
  /** Click 1 dòng. */
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

/** Format giá trị cell theo field type. */
function renderCell(field: FieldSchema, value: unknown): React.ReactNode {
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
  switch (field.type) {
    case 'currency':
      return vnd(Number(value));
    case 'number':
      return num(Number(value));
    case 'date':
      return formatDate(String(value));
    case 'switch':
      return value ? 'Có' : 'Không';
    case 'select': {
      const opt = field.options?.find((o) => o.value === String(value));
      return opt?.label ?? String(value);
    }
    default:
      return String(value);
  }
}

/**
 * DataTable — bảng list ĐỘNG từ FieldSchema[].
 * Tự render cột (chỉ field inTable !== false), sort client-side.
 */
export function DataTable<T extends Record<string, unknown>>({
  fields,
  rows,
  extraColumns = [],
  onRowClick,
  emptyMessage = 'Chưa có dữ liệu.',
}: DataTableProps<T>) {
  const columns = fields.filter((f) => f.inTable !== false);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), 'vi');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.name}>
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.name)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    {sortKey === col.name ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.label
                )}
              </TableHead>
            ))}
            {extraColumns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, idx) => (
            <TableRow
              key={String(row.id ?? idx)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'cursor-pointer')}
            >
              {columns.map((col) => (
                <TableCell key={col.name}>
                  {renderCell(col, row[col.name])}
                </TableCell>
              ))}
              {extraColumns.map((col) => (
                <TableCell key={col.key}>{col.render(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
