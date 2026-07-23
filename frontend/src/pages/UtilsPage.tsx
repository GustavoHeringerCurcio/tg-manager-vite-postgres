import * as React from "react";
import { useSearchParams } from "react-router-dom";
import UtilsGetFileId from "@/pages/UtilsGetFileId";
import RemarketingSimulator from "@/pages/utils/RemarketingSimulator";

type ToolKey = "file-id" | "remarketing";

const TOOLS: { key: ToolKey; label: string; description: string }[] = [
  {
    key: "file-id",
    label: "Get File ID",
    description: "Envie um arquivo e obtenha o Telegram File ID.",
  },
  {
    key: "remarketing",
    label: "Simulador de Pagamento & Remarketing",
    description: "Simule um pagamento e verifique o cancelamento de remarketing.",
  },
];

export default function UtilsPage() {
  const [params, setParams] = useSearchParams();
  const selected = (params.get("tool") as ToolKey) ?? "file-id";

  const setSelected = (key: ToolKey) => {
    const next = new URLSearchParams(params);
    next.set("tool", key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Utilitários</h1>
        <p className="text-sm text-muted-foreground">
          Ferramentas auxiliares para depuração e operações rápidas.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <nav className="md:col-span-2 lg:col-span-1">
          <div className="rounded-lg border bg-card p-2">
            <ul className="flex md:flex-col gap-2">
              {TOOLS.map((tool) => {
                const active = selected === tool.key;
                return (
                  <li key={tool.key} className="w-full">
                    <button
                      type="button"
                      onClick={() => setSelected(tool.key)}
                      className={[
                        "w-full text-left rounded-md px-3 py-2 transition",
                        active
                          ? "bg-primary text-primary-foreground shadow"
                          : "hover:bg-accent hover:text-accent-foreground",
                      ].join(" ")}
                    >
                      <div className="text-sm font-medium">{tool.label}</div>
                      <div className="text-xs opacity-80">{tool.description}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="md:col-span-3 lg:col-span-4">
          <div className="rounded-lg border bg-card p-4">
            {selected === "file-id" && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Get File ID</h2>
                <p className="text-sm text-muted-foreground">
                  Faça upload de um arquivo local para obter o File ID do Telegram.
                </p>
                <div className="border-t my-2" />
                {/* The existing tool is mounted here to keep its own state isolated */}
                <UtilsGetFileId />
              </div>
            )}

            {selected === "remarketing" && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Simulador de Pagamento & Remarketing</h2>
                <p className="text-sm text-muted-foreground">
                  Insira os IDs e execute o teste para validar o cancelamento de remarketing.
                </p>
                <div className="border-t my-2" />
                <RemarketingSimulator />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
