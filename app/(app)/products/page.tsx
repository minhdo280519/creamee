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
    query<Product & { variants_count: number; first_variant_image: string | null }>(
      `SELECT p.*,
              COUNT(pv.id)          AS variants_count,
              MIN(JSON_UNQUOTE(JSON_EXTRACT(pv.image_urls, '$[0]'))) AS first_variant_image
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
       WHERE p.is_active = 1
       GROUP BY p.id
       ORDER BY p.name
       LIMIT 500`,
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
        products={products as unknown as (Product & { variants_count: number; first_variant_image: string | null })[]}
        suppliers={suppliers}
        canEdit={canEdit}
        canViewCost={canViewCost(role)}
      />
    </div>
  );
}
