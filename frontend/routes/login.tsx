import { Head } from "$fresh/runtime.ts";
import LoginForm from "../islands/LoginForm.tsx";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>登录 - 直播选品单管理系统</title>
      </Head>
      <LoginForm />
    </>
  );
}
