"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Detalhe intermediário removido: Indicar vai direto ao formulário. */
export default function IndicarDetalheRedirectPage() {
  const { requestId } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (!requestId) return;
    router.replace(`/indicar/${requestId}/nova`);
  }, [requestId, router]);

  return (
    <main className="page page-fazer-pedido">
      <p className="page-fazer-pedido-loading">Abrindo formulário…</p>
    </main>
  );
}
