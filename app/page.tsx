import { redirect } from 'next/navigation';

/** Trang gốc — luôn chuyển hướng. Middleware quyết định /login hay /dashboard. */
export default function RootPage() {
  redirect('/dashboard');
}
