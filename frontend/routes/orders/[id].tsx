import { PageProps } from "$fresh/server.ts";
import OrderDetailIsland from "../../islands/OrderDetailIsland.tsx";

export default function OrderDetailPage(props: PageProps) {
  const orderId = parseInt(props.params.id);
  if (isNaN(orderId)) {
    return <div class="page-container"><div class="alert alert-error">无效的单据ID</div></div>;
  }
  return <OrderDetailIsland orderId={orderId} />;
}
