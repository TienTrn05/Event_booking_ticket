import { useLocale } from './LocaleContext';

// Existing auth messages remain stable keys; credentials and user content are never translated.
const english: Readonly<Record<string, string>> = {
  Đóng: 'Close',
  'Tài khoản': 'Account',
  'Đăng nhập': 'Sign in',
  'Đăng ký': 'Register',
  'Đăng xuất': 'Sign out',
  'Thử lại': 'Try again',
  hoặc: 'or',
  'Liên kết tài khoản': 'Link sign-in methods',
  'Kiểm tra email của bạn': 'Check your email',
  'Dành cho nhà tổ chức': 'For organizers',
  'Chào mừng trở lại': 'Welcome back',
  'Bắt đầu cùng Eventix': 'Get started with Eventix',
  'Đăng nhập để tiếp tục trải nghiệm cùng Eventix.': 'Sign in to continue with Eventix.',
  'Tạo tài khoản để lưu vé và theo dõi những sự kiện bạn yêu thích.':
    'Create an account to manage tickets and follow your favorite events.',
  'Đăng nhập để xem vé và đơn hàng của bạn.': 'Sign in to see your tickets and orders.',
  'Đăng nhập Google hoặc email cá nhân, rồi chọn vai trò Nhà tổ chức. Admin duyệt trước khi mở bán.':
    'Sign in with Google or email, then choose Organizer. Approval is required before ticket sales.',
  'Đăng nhập trước khi giữ chỗ hoặc mua vé.': 'Sign in before holding or buying tickets.',
  'Quản lý phương thức đăng nhập của tài khoản.': 'Manage your sign-in methods.',
  'Bật đăng nhập email/SĐT hoặc liên kết Google trên cùng tài khoản. Dùng đúng email của tài khoản bạn vừa đăng nhập.':
    'Enable email/phone sign-in or link Google to this account. Use the same email as your current account.',
  'Đã liên kết:': 'Linked:',
  'Sửa hồ sơ, sở thích và vai trò': 'Edit profile, preferences and roles',
  'Mã xác minh gồm 6 số': '6-digit verification code',
  'Đang xác minh…': 'Verifying…',
  'Xác minh và liên kết': 'Verify and link',
  'Xác minh và tiếp tục': 'Verify and continue',
  'Gửi lại mã': 'Resend code',
  'Đổi thông tin': 'Change details',
  'Email nhận mã xác minh': 'Email for verification',
  'Email hoặc số điện thoại': 'Email or phone number',
  'Nhập email hoặc SĐT đã đăng ký': 'Enter your registered email or phone',
  'Số điện thoại (không bắt buộc)': 'Phone number (optional)',
  'Mã xác minh được gửi qua email. SĐT đã đăng ký dùng để tìm tài khoản.':
    'Verification codes are sent by email. A registered phone number is an account alias.',
  'Đang gửi mã…': 'Sending code…',
  'Gửi mã xác minh qua email': 'Send email verification code',
  'Đang xử lý…': 'Processing…',
  'Liên kết Google': 'Link Google',
  'Tiếp tục với Google': 'Continue with Google',
  'Hồ sơ và sở thích': 'Profile & preferences',
  'Bắt đầu trải nghiệm của bạn': 'Set up your experience',
  'Đang tải hồ sơ…': 'Loading profile…',
  'Chưa tải được hồ sơ. Hãy thử lại.': 'Unable to load your profile. Please try again.',
  'Tên hiển thị': 'Display name',
  'Giới tính': 'Gender',
  'Chọn giới tính': 'Choose gender',
  Nam: 'Male',
  Nữ: 'Female',
  Khác: 'Other',
  'Không muốn tiết lộ': 'Prefer not to say',
  'Ngày sinh': 'Date of birth',
  'Bạn muốn tham gia với vai trò nào?': 'How would you like to join?',
  'Khách tham dự — khám phá và mua vé': 'Customer — discover events and buy tickets',
  'Nhà tổ chức — tạo tổ chức và sự kiện nháp':
    'Organizer — create an organization and event drafts',
  'Nhà tổ chức có thể bật quyền mua vé sau. Admin duyệt tổ chức và sự kiện trước mở bán.':
    'Organizers can enable ticket purchases later. Organizations and events require approval before sales.',
  'Câu hỏi có dấu * cần trả lời. Bạn có thể sửa câu trả lời trong tài khoản.':
    'Fields marked * are required. You can edit your answers in your account.',
  'Đang lưu…': 'Saving…',
  'Tiếp tục': 'Continue',
  'Lưu hồ sơ': 'Save profile',
  'Bỏ qua sở thích và hoàn tất': 'Skip preferences and finish',
  'Quay lại': 'Back',
  'Bật quyền mua vé Customer': 'Enable Customer ticket purchases',
  'Quản trị phân quyền': 'Manage permissions',
  'Quản lý câu hỏi đăng ký': 'Manage onboarding questions',
  'Chưa chọn': 'Not selected',
  'Hãy trả lời các câu hỏi có dấu *.': 'Please answer all required questions.',
  'Bộ câu hỏi vừa được cập nhật. Hãy kiểm tra các câu hỏi mới rồi lưu lại.':
    'The questionnaire changed. Review the updated questions and save again.',
  'Chưa xác nhận được kết quả. Bấm lưu lại để kiểm tra cùng yêu cầu.':
    'The outcome is not confirmed. Save again to check the same request.',
  'Chưa bật được quyền mua vé. Hãy thử lại.':
    'Unable to enable ticket purchases. Please try again.',
  'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.':
    'Unable to complete the request. Please try again.',
  'Bạn đã hủy đăng nhập Google. Có thể thử lại hoặc dùng email.':
    'Google sign-in was cancelled. Try again or use email.',
  'Chưa thể đăng nhập Google. Vui lòng thử lại.':
    'Google sign-in is unavailable. Please try again.',
  'Phiên đăng nhập Google đã hết hạn. Vui lòng bắt đầu lại.':
    'Your Google sign-in attempt expired. Please start again.',
  'Phiên thao tác đã thay đổi. Vui lòng thử lại.': 'Your session changed. Please try again.',
  'Mã không đúng, đã dùng hoặc hết hạn. Hãy kiểm tra email hoặc yêu cầu mã mới.':
    'The code is invalid, used or expired. Check your email or request a new code.',
  'Bạn đã yêu cầu hoặc nhập mã quá nhiều lần. Vui lòng thử lại sau.':
    'Too many code requests or attempts. Please try again later.',
  'Đăng nhập bằng phương thức đã có, rồi mở Tài khoản để liên kết email/SĐT.':
    'Sign in using an existing method, then open Account to link email/phone.',
  'Email hoặc Google đã thuộc tài khoản khác. Không thể tự gộp hai tài khoản.':
    'This email or Google identity belongs to another account. Accounts cannot be merged automatically.',
  'SĐT này đã được dùng làm tên đăng nhập của tài khoản khác.':
    'This phone alias belongs to another account.',
  'Hãy đăng xuất và đăng nhập lại trước khi liên kết phương thức.':
    'Sign out and sign in again before linking another method.',
  'Nhập đúng email của tài khoản bạn vừa đăng nhập.': 'Enter the email for your current account.',
  'Chưa thể gửi email xác minh. Vui lòng thử lại sau.':
    'Verification email is unavailable. Please try again later.',
  'Đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.':
    'Sign-in is temporarily unavailable. Please try again later.',
  'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.':
    'Too many requests. Please wait and try again.',
  'Hãy mở website tại địa chỉ được cấu hình cho đăng nhập.':
    'Please open the website at its configured sign-in address.',
  'Tài khoản không khả dụng.': 'This account is unavailable.',
  'Kiểm tra lại email hoặc SĐT. SĐT Việt Nam gồm 10 số; số quốc tế cần mã nước.':
    'Check your email or phone number. Vietnamese numbers use 10 digits; international numbers need a country code.',
};
export function useAuthMessages() {
  const { locale } = useLocale();
  return (value: string): string => (locale === 'en' ? (english[value] ?? value) : value);
}
