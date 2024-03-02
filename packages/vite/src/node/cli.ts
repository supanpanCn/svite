import { cac } from "cac";
import { UserConfig } from "./index";
import { AnyObj } from "./types";

const cli = cac("svite");
cli
  .command("[root]", "start dev server")
  .alias("serve")
  .action(loadAndCreateHttp);

function normalizeConfig(option: AnyObj, root: string = process.cwd()) {
  const config = {
    server: {},
    root,
    mode:'development',
    ...(option || {}),
  };
  return config satisfies UserConfig;
}

async function loadAndCreateHttp(root: string, option: any) {
  const nomalizedOption = normalizeConfig(option, root);
  const { createServer } = await import("./server");
  try {
    const server = await createServer(nomalizedOption);
    await server.listen()
  } catch (err) {
    console.error(err)
    process.exit(1);
  }
}

cli.parse();