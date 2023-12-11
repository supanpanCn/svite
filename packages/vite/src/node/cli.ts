import { cac } from "cac";
import { UserConfig } from "./index";

const cli = cac("mini-vite");

cli
  .command("[root]", "start dev server")
  .alias("server")
  .option("--port <port>", "[number] specify port")
  .action(loadAndCreateHttp);

function normalizeConfig(option: any, root: string) {
  const config = {
    server: {},
    root,
  };
  return config satisfies UserConfig;
}

async function loadAndCreateHttp(root: string, option: any) {
  const nomalizedOption = normalizeConfig(option, root);
  const { createServer } = await import("./server");
  try {
    const server = await createServer(nomalizedOption);
    await server.listen()
  } catch (_) {
    process.exit(1);
  }
}
