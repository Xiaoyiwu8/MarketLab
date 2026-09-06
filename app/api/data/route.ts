import { fetchProvider } from '@/lib/providers';
export async function POST(req: Request) {
  try {
    const body: any = await req.json();
    if (
      !Array.isArray(body.symbols) ||
      !body.symbols.length ||
      body.symbols.length > 12
    )
      throw Error('请输入1–12只股票');
    const results = [];
    for (const symbol of body.symbols) {
      try {
        results.push({ symbol, ...(await fetchProvider({ ...body, symbol })) });
      } catch (e) {
        results.push({ symbol, error: (e as Error).message });
      }
    }
    return Response.json(
      { results, receivedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
