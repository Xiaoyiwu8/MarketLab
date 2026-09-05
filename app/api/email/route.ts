export async function POST(req: Request) {
  try {
    if (Number(req.headers.get('content-length') ?? 0) > 20000)
      throw Error('邮件内容过长');
    const { apiKey, from, to, body } = (await req.json()) as any;
    if (
      typeof apiKey !== 'string' ||
      !apiKey.startsWith('re_') ||
      typeof from !== 'string' ||
      typeof to !== 'string' ||
      typeof body !== 'string' ||
      body.length > 10000 ||
      !/^\S+@\S+\.\S+$/.test(to) ||
      /[\r\n]/.test(from + to)
    )
      throw Error('请填写 Resend API Key、已验证的发件地址和有效收件邮箱。');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Market Lab 策略信号提醒',
        text: body,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw Error(`邮件服务返回 ${r.status}，请检查发件域名、密钥及收件权限。`);
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      { error: (e as Error).message },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
