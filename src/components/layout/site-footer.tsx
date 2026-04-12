import { Container } from "@/components/shared/container";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 py-10">
      <Container className="flex flex-col gap-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <p>ORKPOD Archive · каталог записей стримов и выпусков.</p>
        <p>Локальный seed-контент · фаза 1</p>
      </Container>
    </footer>
  );
}
