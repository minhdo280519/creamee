import { redirect } from 'next/navigation';

/** /portal → chuyển thẳng tới đăng nhập. */
export default function PortalIndexPage() {
  redirect('/portal/login');
}
