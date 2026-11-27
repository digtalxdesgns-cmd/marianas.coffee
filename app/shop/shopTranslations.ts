import type { StoreLocale } from "@/lib/woo/config";

export type ShopCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  openCartLabel: string;
  catalogRegionLabel: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  backHome: string;
  errorTitle: string;
  errorBody: string;
  retry: string;
  inStock: string;
  outOfStock: string;
  unavailable: string;
  priceUnavailable: string;
  addToCart: string;
  addedToCart: string;
  inCart: string;
  maxReached: string;
  viewCart: string;
  productImageFallback: string;
  cart: {
    eyebrow: string;
    title: string;
    close: string;
    emptyTitle: string;
    emptyBody: string;
    continueShopping: string;
    subtotal: string;
    subtotalNote: string;
    decreaseQty: string;
    increaseQty: string;
    removeLabel: string;
    removeItem: string;
    maxLimitNote: string;
    checkout: string;
    validating: string;
    reconciledRemoved: string;
    reconciledAdjusted: string;
    checkoutErrors: {
      items_unavailable: string;
      store_unavailable: string;
      rate_limited: string;
      invalid: string;
      network: string;
    };
  };
};

const en: ShopCopy = {
  metaTitle: "Shop Coffee | Marianas Coffee",
  metaDescription:
    "Explore island-roasted Marianas Coffee selections from Saipan. Live product availability, multilingual cart, and secure WooCommerce checkout.",
  eyebrow: "ROASTED IN SAIPAN · LIVE CATALOG",
  title: "The Island Coffee Shop.",
  subtitle:
    "Small-batch coffee roasted on Saipan since 2004. Select your roasts below to build your cart and continue to secure WooCommerce checkout.",
  openCartLabel: "Open shopping cart",
  catalogRegionLabel: "Coffee catalog",
  loading: "Loading island roasts…",
  emptyTitle: "No coffee selections are available right now.",
  emptyBody: "Please check back soon as new small batches are roasted on Saipan, or reach out for wholesale inquiries.",
  backHome: "Return home",
  errorTitle: "We couldn’t load the coffee catalog.",
  errorBody: "The store is temporarily unreachable. Please try again in a moment.",
  retry: "Try again",
  inStock: "In stock",
  outOfStock: "Out of stock",
  unavailable: "Unavailable",
  priceUnavailable: "Price unavailable",
  addToCart: "Add to cart",
  addedToCart: "Added to cart",
  inCart: "{count} in cart",
  maxReached: "Maximum quantity in cart",
  viewCart: "View cart",
  productImageFallback: "Marianas Coffee",
  cart: {
    eyebrow: "Your selection",
    title: "Shopping Cart",
    close: "Close cart",
    emptyTitle: "Your cart is empty.",
    emptyBody: "Choose an island roast from the catalog to get started.",
    continueShopping: "Browse coffee",
    subtotal: "Estimated subtotal",
    subtotalNote: "Prices are verified directly from our store. Shipping and taxes are finalized at WooCommerce checkout.",
    decreaseQty: "Decrease quantity of {product}",
    increaseQty: "Increase quantity of {product}",
    removeLabel: "Remove",
    removeItem: "Remove {product} from cart",
    maxLimitNote: "Max {max} per order",
    checkout: "Proceed to checkout",
    validating: "Verifying cart…",
    reconciledRemoved: "One or more previously saved items are no longer available and were removed from your cart.",
    reconciledAdjusted: "Item quantities were adjusted to match current store availability.",
    checkoutErrors: {
      items_unavailable: "Some items are now out of stock or exceed available quantity. Your cart has been refreshed—please review and try again.",
      store_unavailable: "The store could not be reached to verify your cart. Please try again shortly.",
      rate_limited: "Too many checkout attempts. Please wait a moment and try again.",
      invalid: "We couldn’t validate your cart selection. Please review your items and try again.",
      network: "Network error. Please check your connection and try again.",
    },
  },
};

const zh: ShopCopy = {
  metaTitle: "选购咖啡 | Marianas Coffee",
  metaDescription: "浏览在塞班岛小批量烘焙的 Marianas Coffee 系列，查看实时库存并前往安全结账。",
  eyebrow: "塞班岛烘焙 · 实时商品目录",
  title: "岛屿咖啡商店。",
  subtitle: "自 2004 年起在塞班岛小批量烘焙。在下方挑选心仪烘焙加入购物车，随后前往安全的 WooCommerce 结账页面。",
  openCartLabel: "打开购物车",
  catalogRegionLabel: "咖啡商品列表",
  loading: "正在加载岛屿咖啡…",
  emptyTitle: "目前暂无可购买的咖啡商品。",
  emptyBody: "我们正在塞班岛准备新一轮新鲜烘焙，请稍后再来查看，或提交批发合作咨询。",
  backHome: "返回首页",
  errorTitle: "暂时无法加载商品目录。",
  errorBody: "在线商店暂时无法连接，请稍后重试。",
  retry: "重新加载",
  inStock: "现货",
  outOfStock: "暂时缺货",
  unavailable: "暂不可售",
  priceUnavailable: "暂无价格",
  addToCart: "加入购物车",
  addedToCart: "已加入购物车",
  inCart: "购物车已有 {count} 件",
  maxReached: "已达单次购买上限",
  viewCart: "查看购物车",
  productImageFallback: "马里亚纳咖啡",
  cart: {
    eyebrow: "你的选择",
    title: "购物车",
    close: "关闭购物车",
    emptyTitle: "购物车还是空的。",
    emptyBody: "从商品目录挑选一款岛屿烘焙开始选购吧。",
    continueShopping: "继续浏览",
    subtotal: "预估小计",
    subtotalNote: "价格以在线商店实时核验为准，运费与税费将在 WooCommerce 结账页面最终确认。",
    decreaseQty: "减少 {product} 数量",
    increaseQty: "增加 {product} 数量",
    removeLabel: "移除",
    removeItem: "从购物车移除 {product}",
    maxLimitNote: "单笔限购 {max} 件",
    checkout: "前往结账",
    validating: "正在核验购物车…",
    reconciledRemoved: "购物车中部分先前保存的商品已下架或无货，已自动移除。",
    reconciledAdjusted: "部分商品数量已根据当前库存上限进行调整。",
    checkoutErrors: {
      items_unavailable: "部分商品已缺货或超出可购数量，购物车已刷新，请确认后再试。",
      store_unavailable: "暂时无法连接商店核验购物车，请稍后重试。",
      rate_limited: "请求过于频繁，请稍等片刻后再试。",
      invalid: "无法验证购物车内容，请检查商品后重试。",
      network: "网络错误，请检查网络连接后重试。",
    },
  },
};

const ko: ShopCopy = {
  metaTitle: "커피 쇼핑 | Marianas Coffee",
  metaDescription: "사이판에서 소량 로스팅한 Marianas Coffee 상품을 확인하고 안전하게 WooCommerce 결제로 이어가세요.",
  eyebrow: "사이판 로스팅 · 실시간 카탈로그",
  title: "아일랜드 커피 숍.",
  subtitle: "2004년부터 사이판에서 소량 로스팅한 커피입니다. 아래에서 원두를 장바구니에 담고 안전한 WooCommerce 결제로 진행하세요.",
  openCartLabel: "장바구니 열기",
  catalogRegionLabel: "커피 상품 목록",
  loading: "아일랜드 로스트를 불러오는 중…",
  emptyTitle: "현재 구매 가능한 커피 상품이 없습니다.",
  emptyBody: "사이판에서 새로운 배치를 준비 중입니다. 잠시 후 다시 확인하시거나 도매 문의를 이용해 주세요.",
  backHome: "홈으로 돌아가기",
  errorTitle: "상품 목록을 불러오지 못했습니다.",
  errorBody: "스토어에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  retry: "다시 시도",
  inStock: "재고 있음",
  outOfStock: "품절",
  unavailable: "구매 불가",
  priceUnavailable: "가격 미정",
  addToCart: "장바구니에 담기",
  addedToCart: "장바구니에 담김",
  inCart: "장바구니 {count}개",
  maxReached: "최대 수량에 도달했습니다",
  viewCart: "장바구니 보기",
  productImageFallback: "마리아나스 커피",
  cart: {
    eyebrow: "선택한 상품",
    title: "장바구니",
    close: "장바구니 닫기",
    emptyTitle: "장바구니가 비어 있습니다.",
    emptyBody: "카탈로그에서 원하는 아일랜드 로스트를 선택해 보세요.",
    continueShopping: "커피 둘러보기",
    subtotal: "예상 소계",
    subtotalNote: "가격은 스토어에서 실시간으로 검증되며, 배송비와 세금은 WooCommerce 결제 화면에서 최종 확정됩니다.",
    decreaseQty: "{product} 수량 줄이기",
    increaseQty: "{product} 수량 늘리기",
    removeLabel: "삭제",
    removeItem: "장바구니에서 {product} 삭제",
    maxLimitNote: "주문당 최대 {max}개",
    checkout: "결제하기",
    validating: "장바구니 확인 중…",
    reconciledRemoved: "이전에 저장된 일부 상품이 현재 구매 불가하여 장바구니에서 제외되었습니다.",
    reconciledAdjusted: "현재 스토어 재고 기준에 맞게 상품 수량이 조정되었습니다.",
    checkoutErrors: {
      items_unavailable: "일부 상품이 품절되었거나 구매 가능 수량을 초과했습니다. 장바구니가 새로고침되었으니 확인 후 다시 시도해 주세요.",
      store_unavailable: "장바구니를 확인하기 위해 스토어에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      rate_limited: "결제 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      invalid: "장바구니 항목을 확인할 수 없습니다. 상품을 확인한 후 다시 시도해 주세요.",
      network: "네트워크 오류입니다. 연결을 확인한 후 다시 시도해 주세요.",
    },
  },
};

const ja: ShopCopy = {
  metaTitle: "コーヒーを選ぶ | Marianas Coffee",
  metaDescription: "サイパンで少量焙煎された Marianas Coffee のラインアップ。最新在庫の確認と安全な WooCommerce 決済に対応しています。",
  eyebrow: "サイパン焙煎 · ライブカタログ",
  title: "アイランド・コーヒーショップ。",
  subtitle: "2004年からサイパンで少量ずつ焙煎しています。お好みのローストをカートに追加し、安全な WooCommerce の購入手続きへお進みください。",
  openCartLabel: "カートを開く",
  catalogRegionLabel: "コーヒー商品一覧",
  loading: "アイランドローストを読み込み中…",
  emptyTitle: "現在ご購入いただけるコーヒーがありません。",
  emptyBody: "サイパンで新しい焙煎を準備中です。しばらくしてから再度ご確認いただくか、卸売のお問い合わせをご利用ください。",
  backHome: "ホームへ戻る",
  errorTitle: "商品一覧を読み込めませんでした。",
  errorBody: "ストアに一時的に接続できません。しばらくしてからもう一度お試しください。",
  retry: "再読み込み",
  inStock: "在庫あり",
  outOfStock: "在庫切れ",
  unavailable: "取扱休止中",
  priceUnavailable: "価格未設定",
  addToCart: "カートに追加",
  addedToCart: "カートに追加しました",
  inCart: "カートに {count} 点",
  maxReached: "購入上限に達しています",
  viewCart: "カートを見る",
  productImageFallback: "マリアナスコーヒー",
  cart: {
    eyebrow: "選んだ商品",
    title: "ショッピングカート",
    close: "カートを閉じる",
    emptyTitle: "カートは空です。",
    emptyBody: "カタログからお好みのアイランドローストをお選びください。",
    continueShopping: "コーヒーを見る",
    subtotal: "小計（目安）",
    subtotalNote: "価格はストアから直接確認されます。送料および税金は WooCommerce の決済画面で確定します。",
    decreaseQty: "{product} の数量を減らす",
    increaseQty: "{product} の数量を増やす",
    removeLabel: "削除",
    removeItem: "{product} をカートから削除",
    maxLimitNote: "1回の上限 {max} 点",
    checkout: "購入手続きへ",
    validating: "カートを確認中…",
    reconciledRemoved: "保存されていた一部の商品が現在お取り扱いできないため、カートから削除しました。",
    reconciledAdjusted: "現在の在庫上限に合わせて数量を調整しました。",
    checkoutErrors: {
      items_unavailable: "一部の商品が在庫切れ、または購入上限を超えています。カートを更新しましたのでご確認のうえ再度お試しください。",
      store_unavailable: "ストアへ接続してカートを確認できませんでした。しばらくしてからもう一度お試しください。",
      rate_limited: "リクエストが多すぎます。少し時間をおいて再度お試しください。",
      invalid: "カートの内容を確認できませんでした。商品をご確認のうえ再度お試しください。",
      network: "ネットワークエラーが発生しました。接続をご確認のうえ再度お試しください。",
    },
  },
};

export const shopTranslations: Record<StoreLocale, ShopCopy> = { en, zh, ko, ja };
