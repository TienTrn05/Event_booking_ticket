import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CreditCard, QrCode, Ticket } from 'lucide-react';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { PageHeader } from '../../../shared/ui/Page';
export function InfoPage({ kind }: { kind: 'guide' | 'not-found' }) {
  const { t } = useLocale();
  const guide = kind === 'guide';
  const steps = [
    {
      icon: CalendarDays,
      title: t('Chọn sự kiện và suất diễn', 'Find an event and session'),
      body: t(
        'Xem thời gian, địa điểm, giới hạn tuổi và thông tin nhà tổ chức trước khi chọn vé.',
        'Check the schedule, venue, age restrictions, and organizer details before selecting tickets.',
      ),
    },
    {
      icon: Ticket,
      title: t('Chọn ghế hoặc khu', 'Choose seats or zones'),
      body: t(
        'Đăng nhập bằng Google hoặc OTP email. Chọn tối đa 6 vé; hệ thống xác nhận giữ chỗ trong 5 phút.',
        'Sign in with Google or email OTP. Choose up to 6 tickets; the system confirms your five-minute hold.',
      ),
    },
    {
      icon: CreditCard,
      title: t('Điền thông tin và thanh toán', 'Add attendees and pay'),
      body: t(
        'Mỗi vé cần thông tin người tham dự. Kiểm tra tổng tiền rồi thanh toán qua liên kết payOS của đơn.',
        'Each ticket needs attendee details. Review the total and use the order’s payOS checkout link.',
      ),
    },
    {
      icon: QrCode,
      title: t('Nhận vé và có mặt', 'Get your tickets and show up'),
      body: t(
        'Vé được phát sau khi hệ thống xác nhận thanh toán. Mở Vé của tôi để lấy QR và mang giấy tờ theo yêu cầu sự kiện.',
        'Tickets are issued after payment is confirmed. Open My tickets for your QR and bring the identification required by the event.',
      ),
    },
  ];
  return (
    <main id="main" className="mx-auto min-h-[55vh] max-w-[1000px] px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Eventix"
        title={
          guide
            ? t('Mọi cuộc hẹn bắt đầu từ một tấm vé', 'Every experience starts with a ticket')
            : t('Không tìm thấy trang', 'Page not found')
        }
        description={
          guide
            ? t(
                'Một vài bước chuẩn bị để bạn yên tâm tận hưởng sự kiện.',
                'A few simple steps so you can enjoy the event with confidence.',
              )
            : t(
                'Đường dẫn không tồn tại hoặc đã thay đổi.',
                'This address does not exist or has changed.',
              )
        }
      />
      {guide && (
        <div className="grid gap-5 sm:grid-cols-2">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <section key={index} className="rounded-2xl border border-line bg-surface p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={23} />
                </span>
                <span className="text-sm font-bold tabular-nums text-muted">0{index + 1}</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">{body}</p>
            </section>
          ))}
        </div>
      )}
      <Link
        to="/events"
        className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-on-accent hover:bg-accent-hover"
      >
        {t('Khám phá sự kiện', 'Explore events')}
        <ArrowRight size={18} />
      </Link>
    </main>
  );
}
