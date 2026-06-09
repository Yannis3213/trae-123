import { AppProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";

export default function App({ Component }: AppProps) {
  return (
    <>
      <Head>
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      <Component />
    </>
  );
}
