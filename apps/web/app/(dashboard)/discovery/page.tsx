import { listSearchConfigs } from "../../../lib/data/discovery";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { SavedSearchForm } from "../../../components/saved-search-form";

export default async function DiscoveryPage() {
  const configs = await listSearchConfigs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Lead Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Describe what you want in plain English; it gets interpreted into structured filters you can review and
          save. Actual discovery runs outside the browser — see the note below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New search</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SavedSearchForm />
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
          A saved search becomes a config the pipeline reads once you press <span className="text-foreground">To
          discovery</span> on it in{" "}
          <span className="text-foreground">Saved Searches</span>. Running discovery itself executes{" "}
          <code className="text-foreground">npm run run:vertical1</code>,{" "}
          <code className="text-foreground">npm run run:vertical2</code>, or{" "}
          <code className="text-foreground">npm run run:vertical3</code> from the repo root — or the scheduled
          GitHub Action — which write directly into this same database. Results simply appear in All Leads /
          Pipeline once a run completes. There is no in-browser "run now" button; this page does not perform live
          searches.
        </CardContent>
      </Card>
    </div>
  );
}
