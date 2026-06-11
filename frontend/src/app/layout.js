import Providers from './providers';
import './globals.css';

export const metadata = {
  title: 'B2B批发平台-商家入驻单系统',
  description: 'B2B批发平台月底集中处理商家入驻单系统',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
