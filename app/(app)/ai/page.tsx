import { requireAccess } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { AiChat } from './ai-chat';

export const metadata = { title: 'Trợ lý AI — CREAMEE ERP' };

export default async function AiPage() {
  await requireAccess('/ai');

  return (
    <div>
      <PageHeader
        title="Trợ lý AI"
        description="Hỏi đáp về nghiệp vụ và cách dùng hệ thống"
      />
      <AiChat />
    </div>
  );
}
