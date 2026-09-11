import { listProviderConnections, getProviderKeyReport, type ProviderKeySource } from "../../../lib/data/integrations";
import { listTargetCompanies } from "@leads/db/target-companies.js";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { ProviderToggle } from "../../../components/provider-toggle";
import { ProviderSecretForm } from "../../../components/provider-secret-form";
import { TargetCompanyList } from "../../../components/target-company-list";
import type { ProviderConnection } from "@leads/db/types.js";

const LEAD_DATA_PROVIDERS = [
  { key: "web3_career", name: "Web3.Career", docsUrl: "https://web3.career/api" },
  { key: "twitterapi_io", name: "TwitterAPI.io", docsUrl: "https://twitterapi.io" },
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

const TARGET_COMPANY_SECTIONS = [
  {
    source: "greenhouse" as const,
    name: "Greenhouse",
    docsUrl: "https://developers.greenhouse.io/job-board.html",
    identifierLabel: "Board token",
    identifierPlaceholder: "board token (e.g. acme)",
    hint: "The {token} in job-boards.greenhouse.io/{token} — no API key needed, these boards are public.",
  },
  {
    source: "lever" as const,
    name: "Lever",
    docsUrl: "https://github.com/lever/postings-api",
    identifierLabel: "Company slug",
    identifierPlaceholder: "company slug (e.g. acme)",
    hint: "The {slug} in jobs.lever.co/{slug} — no API key needed, these boards are public.",
  },
  {
    source: "ashby" as const,
    name: "Ashby",
    docsUrl: "https://developers.ashbyhq.com",
    identifierLabel: "Board name",
    identifierPlaceholder: "board name (e.g. acme)",
    hint: "The {board} in jobs.ashbyhq.com/{board} — no API key needed, these boards are public.",
  },
  {
    source: "agency" as const,
    name: "Agency websites (card affiliate)",
    docsUrl: null,
    identifierLabel: "Website",
    identifierPlaceholder: "https://agency.com",
    hint: "Seed agencies you find yourself (referrals, roundups, research) — the pipeline enriches each from its own public site.",
    showTwitterField: true,
  },
];

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
  docsUrl,
}: {
  name: string;
  providerKey: string;
  source: ProviderKeySource;
  connection: ProviderConnection | undefined;
  docsUrl?: string;
}) {
  const enabled = connection?.enabled ?? true;
  const configured = source !== "none";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{providerKey}</p>
        {docsUrl && (
          <a href={docsUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            Get an API key →
          </a>
        )}
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
  const [connections, { status: keyStatus, storeUnavailable }, targetCompanyRows] = await Promise.all([
    listProviderConnections(),
    getProviderKeyReport(),
    Promise.all(TARGET_COMPANY_SECTIONS.map((s) => listTargetCompanies(s.source))),
  ]);

  const byName = new Map(connections.map((c) => [c.provider_name, c]));
  const targetCompaniesBySource = Object.fromEntries(
    TARGET_COMPANY_SECTIONS.map((s, i) => [s.source, targetCompanyRows[i]])
  );

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

      {storeUnavailable && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium text-warning">Saved keys can&apos;t be read on this deployment</p>
          <p className="mt-1 text-muted-foreground">{storeUnavailable}</p>
          <p className="mt-1 text-muted-foreground">
            Until then, every provider below reads as &ldquo;Not configured&rdquo; even if you already saved a key
            here, and AI features will report that no provider is configured. Env-var keys are unaffected.
          </p>
        </div>
      )}

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
              docsUrl={"docsUrl" in p ? p.docsUrl : undefined}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Target company lists</CardTitle>
          <p className="text-sm text-muted-foreground">
            Which companies the job-board connectors check, and which agency websites the card-affiliate connector
            enriches. These are public boards/pages — no API key required — so adding one here takes effect on the
            next run with no redeploy.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {TARGET_COMPANY_SECTIONS.map((s) => (
            <div key={s.source} className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{s.name}</p>
                {s.docsUrl && (
                  <a href={s.docsUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    Official docs →
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
              <TargetCompanyList
                source={s.source}
                identifierLabel={s.identifierLabel}
                identifierPlaceholder={s.identifierPlaceholder}
                showTwitterField={"showTwitterField" in s ? s.showTwitterField : undefined}
                rows={targetCompaniesBySource[s.source] ?? []}
              />
            </div>
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
