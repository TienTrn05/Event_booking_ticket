/** Email-client compatible layout: inline styles, presentation tables, no external assets. */
export function otpEmailContent(code: string) {
  const escapedCode = code.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });

  return {
    text: `Mã xác minh Eventix của bạn là ${code}. Mã có hiệu lực 5 phút. Nhập mã này tại màn hình xác minh Eventix để tiếp tục. Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu mã, hãy bỏ qua email này.`,
    html: `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mã xác minh Eventix</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f9fc;color:#102b40;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Xác minh tài khoản Eventix. Mã có hiệu lực trong 5 phút.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f9fc;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #cbdfe9;border-top:4px solid #006a91;border-radius:16px;">
          <tr>
            <td align="center" style="padding:32px 24px 28px;border-bottom:1px solid #e7f3f9;">
              <span style="font-size:30px;font-weight:700;letter-spacing:-1px;color:#006a91;">Eventix</span>
              <p style="margin:8px 0 0;font-size:13px;line-height:20px;color:#4d6577;">Kết nối những trải nghiệm đáng nhớ</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 24px;">
              <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:700;color:#102b40;">Xác minh tài khoản của bạn</h1>
              <p style="margin:0;font-size:16px;line-height:26px;color:#4d6577;">Nhập mã bên dưới tại màn hình xác minh Eventix để tiếp tục.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:320px;margin:28px auto;">
                <tr>
                  <td align="center" style="padding:22px 12px;background-color:#e7f3f9;border:1px solid #cbdfe9;border-radius:12px;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;color:#4d6577;">MÃ XÁC MINH</p>
                    <p dir="ltr" style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:36px;line-height:44px;font-weight:700;letter-spacing:6px;color:#102b40;">${escapedCode}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:22px;color:#4d6577;">Mã có hiệu lực trong <strong style="color:#102b40;">5 phút</strong> và chỉ sử dụng một lần.</p>
              <p style="margin:20px 0 0;font-size:14px;line-height:22px;color:#4d6577;">Không chia sẻ mã này với bất kỳ ai.<br>Nếu bạn không yêu cầu mã, hãy bỏ qua email này.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px;background-color:#f3f9fc;border-top:1px solid #cbdfe9;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 8px;font-size:16px;line-height:24px;font-weight:700;color:#006a91;">Eventix</p>
              <p style="margin:0;font-size:12px;line-height:20px;color:#4d6577;">Email tự động từ Eventix. Vui lòng không trả lời email này.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
