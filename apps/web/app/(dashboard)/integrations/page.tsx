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

/**
 * A lead/data provider only runs when its key is in the environment AND its
 * toggle is on, so the badge reports that combination rather than either half
 * on its own. A missing row counts as enabled, matching the worker-side
 * default in workers/provider-gate.ts.
 */
function LeadDataProviderRow({
  name,
  providerKey,
  configured,
  connection,
}: {
  name: string;
  providerKey: string;
  configured: boolean;
  connection: ProviderConnection | undefined;
}) {
  const enabled = connection?.enabled ?? true;

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{providerKey}</p>
      </div>
      <div className="flex items-center gap-4">
        {!configured ? (
          <Badge variant="outline">No API key in environment</Badge>
        ) : enabled ? (
          <Badge variant="success">Active — connectors will use it</Badge>
        ) : (
          <Badge variant="warning">Switched off — connectors skip it</Badge>
        )}
        <ProviderToggle
          providerName={providerKey}
          category="lead_data"
          enabled={enabled}
          priority={connection?.priority ?? 0}
          disabled={!configured}
        />
      </div>
    </div>
  );
}

/**
 * Read-only on purpose. Which AI provider handles which task is chosen per
 * use case in Settings (ai_provider_settings); a switch here would be a
 * second place to disable the same thing.
 */
function AiProviderRow({
  name,
  providerKey,
  configured,
}: {
  name: string;
  providerKey: string;
  configured: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{providerKey}</p>
      </div>
      <Badge variant={configured ? "success" : "outline"}>
        {configured ? "Key present in environment" : "No API key in environment"}
      </Badge>
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
          <p className="text-sm text-muted-foreground">
            Switching one off stops the connectors and enrichment steps from calling it on the next
            worker run, which is how you cap spend on the paid ones without pulling the key.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {LEAD_DATA_PROVIDERS.map((p) => (
            <LeadDataProviderRow
              key={p.key}
              name={p.name}
              providerKey={p.key}
              configured={envConfigured[p.key]}
              connection={byName.get(p.key)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Key status only. Pick which provider and model handles each task — lead research,
            scoring, outreach drafting — in Settings.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {AI_PROVIDERS.map((p) => (
            <AiProviderRow
              key={p.key}
              name={p.name}
              providerKey={p.key}
              configured={envConfigured[p.key]}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
