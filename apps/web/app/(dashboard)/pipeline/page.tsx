import { getPipelineBoard } from "../../../lib/data/pipeline";
import { PipelineBoard } from "../../../components/pipeline-board";

export default async function PipelinePage() {
  const { columns, hidden } = await getPipelineBoard();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Active leads across the working pipeline — drag a card to another column, or use its status dropdown.
        </p>
      </div>

      <PipelineBoard columns={columns} hidden={hidden} />
    </div>
  );
}
