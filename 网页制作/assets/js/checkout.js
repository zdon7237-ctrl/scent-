import { currentSession } from "./auth-client.js";
import { createOrder, startPayment } from "./checkout-client.js";

export const checkoutAdapter = {
  async startCheckout(cartItems) {
    if (!cartItems.length) {
      return {
        status: "empty",
        message: "购物车是空的，请先选择商品。"
      };
    }

    const session = await currentSession();
    if (!session.user) {
      return {
        status: "login_required",
        message: "请先登录会员账号，再提交订单获得积分和会员折扣。",
        redirect: "login.html"
      };
    }

    const { order } = await createOrder(cartItems);
    const payment = await startPayment(order.id);
    return {
      status: payment.status,
      order: payment.order,
      message: payment.message
    };
  }
};

export function startCheckout(cartItems) {
  return checkoutAdapter.startCheckout(cartItems);
}
