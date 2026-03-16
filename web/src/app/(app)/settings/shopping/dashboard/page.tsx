export default function DeprecatedShoppingLegacyPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Rule-only SOT 전환 완료</h1>
      <p className="text-sm text-zinc-600">
        이 화면은 legacy shopping runtime surface라서 더 이상 사용하지 않습니다.
      </p>
      <p className="text-sm text-zinc-600">
        새 SOT 기준 작업은 <code>/settings/shopping/mappings</code>와 publish/recompute 흐름에서 진행하세요.
      </p>
    </main>
  );
}
