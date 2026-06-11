// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server';

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          <title>农业合作社-种植任务管理系统</title>
          {assets}
        </head>
        <body class="bg-gray-50">
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
