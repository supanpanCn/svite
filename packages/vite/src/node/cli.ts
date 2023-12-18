import { cac } from "cac";
import { UserConfig } from "./index";

const cli = cac("svite");
cli
  .command("[root]", "start dev server")
  .alias("serve")
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
    debugger;
    await server.listen()
  } catch (err) {
    console.error(err)
    process.exit(1);
  }
}

cli.parse();