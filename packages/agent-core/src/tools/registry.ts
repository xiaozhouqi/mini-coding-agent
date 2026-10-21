import { ToolExecutor } from './ToolExecutor';
import { readFileTool } from './implementations/readFile';

// The set of tools the agent can use. More tools (write_file, glob_files,
// search_code) are added in later slices.
export function createToolExecutor(): ToolExecutor {
  const executor = new ToolExecutor();
  executor.register(readFileTool);
  return executor;
}
