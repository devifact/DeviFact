export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <span className="rounded-full bg-amber-100 px-4 py-1 text-sm font-semibold text-amber-700">
          Maintenance
        </span>
        <h1 className="mt-6 text-3xl font-bold">Site en maintenance</h1>
        <p className="mt-4 text-base text-slate-600">
          Nous effectuons actuellement une mise a jour. Le service sera de
          nouveau disponible prochainement.
        </p>
      </div>
    </main>
  );
}
