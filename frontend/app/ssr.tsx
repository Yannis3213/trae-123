/// <reference types="vinxi/types/server" />
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/start/server";
import { getRouterManifest } from "@tanstack/start/router-manifest";

import { createAppRouter } from "./router";

export default createStartHandler({
  createRouter: createAppRouter,
  getRouterManifest,
})(defaultStreamHandler);
