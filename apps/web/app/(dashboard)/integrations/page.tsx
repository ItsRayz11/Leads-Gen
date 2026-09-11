import { listProviderConnections, getProviderKeyStatus, type ProviderKeySource } from "../../../lib/data/integrations";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { ProviderToggle } from "../../../components/provider-toggle";
import { ProviderSecretForm } from "../../../components/provider-secret-form";
import type { ProviderConnection } from "@leads/db/types.js";

const LEAD_DATA_PROVIDERS = [
  { key: "web3_career", name: "Web3.Career" },
  { key: "twitterapi_io", name: "TwitterAPI.io" },
  { key: "hunter", name: "Hunter" },
  { key: "apollo", name: "Apollo" },
  { key: "prospeo", name: "Prospeo" },
  { key: "pdl", name: "People Data Labs" },
] as const;

const AI_PROVIDERS = [
  { key: "openai", name: "OpenAI" },
  { key: "anthropic", name: "Anthropic" },
  { key: "google", name: "Google AI" },
  { key: "openrouter", name: "OpenRouter" },
  { key: "agentrouter", name: "AgentRouter" },
] as const;

function SourceBadge({ source }: { source: ProviderKeySource }) {
  if (source === "none") return <Badge variant="outline">No key configured</Badge>;
  if (source === "env") return <Badge variant="success">Key from environment</Badge>;
  return <Badge variant="success">Key saved (database)</Badge>;
}

/**
 * A lead/data provider only runs when its key is configured (env or
 * database) AND its toggle is on, so the badge reports that combination
 * rather than either half on its own. A missing row counts as enabled,
 * matching the worker-side default in workers/provider-gate.ts.
 */
function LeadDataProviderRow({
  name,
  providerKey,
  source,
  connection,
}: {
  name: string;
  providerKey: string;
  source: ProviderKeySource;
  connection: ProviderConnection | undefined;
}) {
  const enabled = connection?.enabled ?? true;
  const configured = source !== "none";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{providerKey}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SourceBadge source={source} />
        {configured &&
          (enabled ? (
            <Badge variant="success">Active — connectors will use it</Badge>
          ) : (
            <Badge variant="warning">Switched off — connectors skip it</Badge>
          ))}
        <ProviderSecretForm providerKey={providerKey} category="lead_data" source={source} />
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
 * Which AI provider handles which task is chosen per use case in Settings
 * (ai_provider_settings) — this row is just where the key itself lives.
 */
function AiProviderRow({
  name,
  providerKey,
  source,
}: {
  name: string;
  providerKey: string;
  source: ProviderKeySource;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{providerKey}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SourceBadge source={source} />
        <ProviderSecretForm providerKey={providerKey} category="ai" source={source} />
      </div>
    </div>
  );
}

export default async function IntegrationsPage() {
  const [connections, keyStatus] = await Promise.all([listProviderConnections(), getProviderKeyStatus()]);

  const byName = new Map(connections.map((c) => [c.provider_name, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Add or update a key below to store it (encrypted) in the database, or set the matching env var (Vercel
          project settings or <code className="text-xs">.env.local</code>) — an env var always takes priority over a
          saved key.
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
              source={keyStatus[p.key]}
              connection={byName.get(p.key)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Key status only. Pick which provider and model handles each task — search interpretation,
            lead qualification, outreach drafting — in Settings.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {AI_PROVIDERS.map((p) => (
            <AiProviderRow key={p.key} name={p.name} providerKey={p.key} source={keyStatus[p.key]} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
