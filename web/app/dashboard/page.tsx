import dynamic from "next/dynamic";

const DashboardClient = dynamic(() => import("@/components/DashboardClient").then((mod) => mod.DashboardClient), {
  ssr: false,
  loading: () => <div className="rounded-xl border border-stone-300 bg-white/80 p-4 text-sm text-stone-600">Carregando dashboard...</div>
});

export default function DashboardPage() {
  return <DashboardClient />;
}
