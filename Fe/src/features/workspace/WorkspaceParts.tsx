import type { ReactNode } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { EmptyState, ErrorState, PageHeader } from '../../shared/ui/Page';
import Button from '../../shared/ui/Button';
import { useAuthDialog } from '../auth/context/AuthDialogContext';
import { useLocale } from '../../shared/i18n/LocaleContext';
import type { useWorkspaceMutation } from './useWorkspaceMutation';
import './workspace.css';

export function WorkspaceHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      {...(action ? { actions: action } : {})}
    />
  );
}
export function WorkspaceLogin() {
  const { openAuth } = useAuthDialog();
  const { t } = useLocale();
  return (
    <EmptyState
      title={t('Đăng nhập để tiếp tục', 'Sign in to continue')}
      description={t(
        'Dùng tài khoản có quyền truy cập khu vực này.',
        'Use an account with access to this workspace.',
      )}
      action={<Button onClick={() => openAuth('login')}>{t('Đăng nhập', 'Sign in')}</Button>}
    />
  );
}
export function WorkspaceLoading() {
  const { t } = useLocale();
  return (
    <div className="workspace-empty" role="status">
      <LoaderCircle className="workspace-spin" aria-hidden="true" />
      <p>{t('Đang tải dữ liệu…', 'Loading data…')}</p>
    </div>
  );
}
export function WorkspaceEmpty({ title, children }: { title: string; children?: string }) {
  return <EmptyState title={title} {...(children ? { description: children } : {})} />;
}
export function WorkspaceError({ message, retry }: { message: string; retry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="my-4">
      <ErrorState
        title={t('Chưa thể hoàn tất', 'Unable to complete')}
        description={message}
        {...(retry ? { onRetry: retry } : {})}
      />
    </div>
  );
}
export function MutationNotice({
  mutation,
}: {
  mutation: ReturnType<typeof useWorkspaceMutation>;
}) {
  const { t } = useLocale();
  return (
    <>
      {mutation.error && <WorkspaceError message={mutation.error} />}
      {mutation.notice && (
        <p className="workspace-success" role="status">
          {mutation.notice}
        </p>
      )}
      {mutation.uncertain && (
        <button type="button" disabled={mutation.busy} onClick={mutation.retry}>
          <RefreshCw size={16} aria-hidden="true" />
          {t('Thử lại cùng yêu cầu', 'Retry same request')}
        </button>
      )}
    </>
  );
}
export function WorkspaceStatus({ value }: { value: string }) {
  const { t } = useLocale();
  const labels: Record<string, [string, string]> = {
    DRAFT: ['Bản nháp', 'Draft'],
    PENDING_REVIEW: ['Chờ duyệt', 'Pending review'],
    PENDING: ['Chờ duyệt', 'Pending'],
    APPROVED: ['Đã duyệt', 'Approved'],
    PUBLISHED: ['Đang công khai', 'Published'],
    REJECTED: ['Bị từ chối', 'Rejected'],
    CANCELLED: ['Đã hủy', 'Cancelled'],
    ARCHIVED: ['Đã lưu trữ', 'Archived'],
    SUSPENDED: ['Tạm ngưng', 'Suspended'],
    EXPIRED: ['Hết hạn', 'Expired'],
    WITHDRAWN: ['Đã rút', 'Withdrawn'],
  };
  const label = labels[value];
  return (
    <span className="workspace-status" data-status={value}>
      {label ? t(...label) : value}
    </span>
  );
}
