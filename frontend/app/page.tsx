export const dynamic = "force-dynamic";

const backendUrl = process.env.BACKEND_URL ?? "http://platform-backend:3000";

async function callBackend(path: string): Promise<string> {
  try {
    const res = await fetch(`${backendUrl}${path}`, { cache: "no-store" });
    return JSON.stringify(await res.json());
  } catch {
    return "backend unreachable";
  }
}

export default async function Home() {
  const [health, ping] = await Promise.all([
    callBackend("/api/health"),
    callBackend("/api/ping"),
  ]);
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Hackathon backbone</h1>
      <p>frontend -&gt; platform-backend /api/health:</p>
      <pre data-testid="health">{health}</pre>
      <p>frontend -&gt; platform-backend /api/ping:</p>
      <pre data-testid="ping">{ping}</pre>
    </main>
  );
}
