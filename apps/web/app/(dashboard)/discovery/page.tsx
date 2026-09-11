import { discoveryWriteBlocker, listSearchConfigs } from "../../../lib/data/discovery";
import { getUseCaseStatus } from "../../../lib/data/ai-settings";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { SavedSearchForm } from "../../../components/saved-search-form";
import { DiscoveryRunPanel } from "../../../components/discovery-run-panel";

export default async function DiscoveryPage() {
  const [configs, aiStatus] = await Promise.all([
    listSearchConfigs(),
    getUseCaseStatus("search_interpretation"),
  ]);
  const writeBlocker = discoveryWriteBlocker();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Lead Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Describe what you want in plain English; it gets interpreted into structured filters you can review, then
          run immediately or save for later. See what each source can actually act on in{" "}
          <a href="/integrations" className="text-primary hover:underline">
            Integrations
          </a>
          .
        </p>
      </div>

      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium marker:content-none">
          <span className="text-muted-foreground transition-transform group-open:rotate-90">▶</span>
          Advanced: run a vertical directly
        </summary>
        <div className="space-y-3 border-t border-border p-4 pt-3">
          <p className="text-xs text-muted-foreground">
            Re-runs every enabled connector for a whole vertical against its existing configs — the same thing
            clicking <span className="text-foreground">Run</span> on a new search below does, minus adding a new
            one. Same as <code className="text-foreground">npm run run:vertical1</code> or the scheduled GitHub
            Action.
          </p>
          {writeBlocker && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive">Runs started here can&apos;t save results</p>
              <p className="mt-1 text-muted-foreground">{writeBlocker}</p>
            </div>
          )}
          <DiscoveryRunPanel />
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>New search</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SavedSearchForm aiStatus={aiStatus} />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground">
          Active discovery configs (run via the workers pipeline)
        </h2>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Vertical</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Keywords</th>
              <th className="px-3 py-2">Industries</th>
              <th className="px-3 py-2">Geography</th>
              <th className="px-3 py-2">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No discovery configs found. Not configured.
                </td>
              </tr>
            ) : (
              configs.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Badge variant="outline">{c.vertical.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">
                    {c.keywords && c.keywords.length > 0 ? c.keywords.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.industries && c.industries.length > 0 ? c.industries.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.geography && c.geography.length > 0 ? c.geography.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={c.enabled ? "success" : "outline"}>{c.enabled ? "Enabled" : "Disabled"}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground">
          Clicking <span className="text-foreground">Run</span> on a new search above saves it, turns it into a
          config here, and runs its vertical immediately. A search you only <span className="text-foreground">Save
          for later</span> instead becomes a config once you press <span className="text-foreground">To
          discovery</span> on it in <span className="text-foreground">Saved Searches</span>. Either way, running a
          vertical (from here or above) triggers the same code as{" "}
          <code className="text-foreground">npm run run:vertical1</code>,{" "}
          <code className="text-foreground">npm run run:vertical2</code>,{" "}
          <code className="text-foreground">npm run run:vertical3</code>, or{" "}
          <code className="text-foreground">npm run run:vertical4</code> — or the scheduled GitHub Action —
          writing directly into this same database. Results appear in All Leads / Pipeline once a run completes.
          <br />
          <span className="text-foreground">Live web search</span> is different from the other three: instead of
          reading a fixed set of sites, it asks Gemini to run a real, live Google search for whatever your query
          says and only keeps results it found an actual source page for. It needs a Google AI API key configured
          on the Integrations page.
        </CardContent>
      </Card>
    </div>
  );
}
