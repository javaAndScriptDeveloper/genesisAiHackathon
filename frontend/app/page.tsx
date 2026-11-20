export const dynamic = "force-dynamic";

const backendUrl = process.env.BACKEND_URL ?? "http://platform-backend:3000";

async function getHealth(): Promise<string> {
  try {
    const res = await fetch(`${backendUrl}/api/health`, { cache: "no-store" });
    const body = await res.json();
    return `backend: ${body.status} / db: ${body.db}`;
  } catch {
    return "backend unreachable";
  }
}

export default async function Home() {
  const health = await getHealth();
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Hackathon backbone (redeploy check)</h1>
      <p data-testid="health">{health}</p>
    </main>
  );
}
