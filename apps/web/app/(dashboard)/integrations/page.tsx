import { listProviderConnections, getEnvConfiguredProviders } from "../../../lib/data/integrations";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { ProviderToggle } from "../../../components/provider-toggle";
import type { ProviderConnection } from "@leads/db/types.js";

const LEAD_DATA_PROVIDERS = [
  { key: "web3_career", name: "Web3.Career" },
  { key: "twitterapi_io", name: "TwitterAPI.io" },
  { key: "hunter", name: "Hunter" },
  { key: "apollo", name: "Apollo" },
  { key: "prospeo", name: "Prospeo" },
] as const;

const AI_PROVIDERS = [
  { key: "openai", name: "OpenAI" },
  { key: "anthropic", name: "Anthropic" },
  { key: "google", name: "Google AI" },
  { key: "openrouter", name: "OpenRouter" },
] as const;

function ProviderRow({
  name,
  providerKey,
  category,
  configured,
  connection,
}: {
  name: string;
  providerKey: string;
  category: "lead_data" | "ai";
  configured: boolean;
  connection: ProviderConnection | undefined;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{providerKey}</p>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant={configured ? "success" : "outline"}>
          {configured ? "Configured in environment" : "Not configured"}
        </Badge>
        <ProviderToggle
          providerName={providerKey}
          category={category}
          enabled={connection?.enabled ?? false}
          priority={connection?.priority ?? 0}
          disabled={!configured}
        />
      </div>
    </div>
  );
}

export default async function IntegrationsPage() {
  const [connections, envConfigured] = await Promise.all([
    listProviderConnections(),
    Promise.resolve(getEnvConfiguredProviders()),
  ]);

  const byName = new Map(connections.map((c) => [c.provider_name, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          API keys are set via environment variables (Vercel project settings or{" "}
          <code className="text-xs">.env.local</code>), never through this UI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead / Data Providers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {LEAD_DATA_PROVIDERS.map((p) => (
            <ProviderRow
              key={p.key}
              name={p.name}
              providerKey={p.key}
              category="lead_data"
              configured={envConfigured[p.key]}
              connection={byName.get(p.key)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {AI_PROVIDERS.map((p) => (
            <ProviderRow
              key={p.key}
              name={p.name}
              providerKey={p.key}
              category="ai"
              configured={envConfigured[p.key]}
              connection={byName.get(p.key)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
