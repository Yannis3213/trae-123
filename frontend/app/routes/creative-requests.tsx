import { Outlet, useOutletContext } from "@remix-run/react";

interface OutletContext {
  userId: string;
  role: string;
}

export default function CreativeRequestsLayout() {
  const context = useOutletContext<OutletContext>();
  return <Outlet context={context} />;
}
