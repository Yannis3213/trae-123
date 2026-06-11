import { Head } from "$fresh/runtime.ts";
import { ComponentChildren } from "preact";

interface LayoutProps {
  children: ComponentChildren;
  title?: string;
}

export default function Layout({ children, title = "直播选品单管理系统" }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </Head>
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </>
  );
}
