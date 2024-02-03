type LoadResult = string | NullValue;
type TransformResult = null | string;

type PluginContext = any;

type TransformPluginContext = any;

type NullValue = null | undefined | void;
type ResolveIdResult = string | NullValue | false;

export interface Plugin {
  // 插件名称
  name:string;
  // 指定在所有插件中的运行阶段
  enforce?: "pre" | "post";
  // 是否等待前一个plugin hook执行完毕
  sequential?: boolean;
  // 服务器启动时
  buildStart?: (this: PluginContext) => void;
  // 路径解析
  resolveId?: (
    this: PluginContext,
    id:string,
    importer: string | undefined,
    options?:{
      scan?:boolean;
    }
  ) => Promise<ResolveIdResult> | ResolveIdResult;
  // 模块加载
  load?: (this: PluginContext, id: string) => Promise<LoadResult> | LoadResult;
  // 模块转换
  transform?: (
    this: TransformPluginContext,
    code: string,
    id: string
  ) => Promise<TransformResult> | TransformResult;
}

export type PluginHooks = Omit<Required<Plugin>, "enforce" | "sequential">;
