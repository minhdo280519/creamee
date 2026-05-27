import { requireAccess } from '@/lib/auth';
import { query } from '@/lib/db';
import { PageHeader } from '@/components/page-header';
import { ProductsClient } from './products-client';
import type { Product, Supplier } from '@/lib/types';
import { canViewCost, type Role } from '@/lib/roles';

export const metadata = { title: 'Sản phẩm — CREAMEE ERP' };

export default async function ProductsPage() {
  const profile = await requireAccess('/products');

  const [{ rows: products }, { rows: supplierRows }] = await Promise.all([
    query<Product>(
      'SELECT * FROM products WHERE is_active = 1 ORDER BY name LIMIT 500',
    ),
    query<Pick<Supplier, 'id' | 'name'>>(
      'SELECT id, name FROM suppliers WHERE is_active = 1 ORDER BY name',
    ),
  ]);

  const suppliers = supplierRows.map((s) => ({ id: s.id, label: s.name }));
  const role = profile.role as Role;
  const canEdit = ['owner', 'manager', 'warehouse'].includes(role);

  return (
    <div>
      <PageHeader
        title="Sản phẩm"
        description={`${products.length} sản phẩm đang kinh doanh`}
      />
      <ProductsClient
        products={products}
        suppliers={suppliers}
        canEdit={canEdit}
        canViewCost={canViewCost(role)}
      />
    </div>
  );
}
