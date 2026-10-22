import { ToolExecutor } from './ToolExecutor';
import { globFilesTool } from './implementations/globFiles';
import { readFileTool } from './implementations/readFile';
import { searchCodeTool } from './implementations/searchCode';
import { writeFileTool } from './implementations/writeFile';

// The set of tools the agent can use.
export function createToolExecutor(): ToolExecutor {
  const executor = new ToolExecutor();
  executor.register(readFileTool);
  executor.register(writeFileTool);
  executor.register(globFilesTool);
  executor.register(searchCodeTool);
  return executor;
}
