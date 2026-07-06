/**
 * RunningFit V3 - AI Representative Shoe Image Generator
 * SVG-based generated illustration. It does not use official brand photos or logos.
 */
function getAIRepresentativeShoeImage(shoe) {
  const brandRaw = shoe && shoe.brand ? shoe.brand : "RunningFit";
  const modelRaw = shoe && shoe.model ? shoe.model : "Running Shoe";
  const brand = brandRaw.toLowerCase();

  const brandColors = {
    nike: ["#111827", "#f8fafc", "#f97316"],
    asics: ["#1d4ed8", "#eff6ff", "#38bdf8"],
    hoka: ["#0369a1", "#ecfeff", "#22d3ee"],
    "new balance": ["#dc2626", "#fff1f2", "#fb7185"],
    brooks: ["#2563eb", "#eff6ff", "#60a5fa"],
    saucony: ["#16a34a", "#f0fdf4", "#86efac"],
    adidas: ["#111827", "#f9fafb", "#94a3b8"],
    mizuno: ["#0f766e", "#ecfdf5", "#2dd4bf"],
    puma: ["#7c2d12", "#fff7ed", "#fdba74"],
    on: ["#334155", "#f8fafc", "#cbd5e1"]
  };

  const [main, bg, accent] = brandColors[brand] || ["#111827", "#f8fafc", "#94a3b8"];
  const safeBrand = String(brandRaw).replace(/[<>&]/g, "");
  const safeModel = String(modelRaw).replace(/[<>&]/g, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#0f172a" flood-opacity="0.18"/></filter>
    </defs>
    <rect width="1200" height="900" rx="54" fill="url(#bg)"/>
    <circle cx="1010" cy="130" r="190" fill="${accent}" opacity="0.14"/>
    <circle cx="170" cy="760" r="220" fill="${main}" opacity="0.08"/>
    <text x="72" y="96" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="${main}">AI 생성 대표 이미지</text>
    <text x="72" y="142" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="${main}" opacity="0.62">${safeBrand}</text>
    <g filter="url(#shadow)" transform="translate(68 90)">
      <path d="M135 510 C255 362 421 313 612 362 C738 394 835 421 983 374 C1019 444 984 526 874 563 C690 624 416 620 210 570 C130 551 91 534 135 510 Z" fill="${main}"/>
      <path d="M212 546 C422 601 715 598 926 521" stroke="#fff" stroke-width="44" stroke-linecap="round" opacity="0.92" fill="none"/>
      <path d="M265 460 C392 394 555 391 718 443" stroke="#fff" stroke-width="28" stroke-linecap="round" opacity="0.78" fill="none"/>
      <path d="M393 435 L500 520 M485 420 L604 522 M581 423 L706 520" stroke="${accent}" stroke-width="17" stroke-linecap="round" opacity="0.88"/>
      <circle cx="350" cy="493" r="20" fill="#fff"/><circle cx="430" cy="481" r="20" fill="#fff"/><circle cx="512" cy="480" r="20" fill="#fff"/>
      <path d="M154 513 C109 525 98 572 172 592 C259 615 385 631 575 629" stroke="${accent}" stroke-width="22" stroke-linecap="round" fill="none" opacity="0.88"/>
    </g>
    <text x="72" y="800" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="${main}">${safeModel}</text>
    <text x="72" y="845" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${main}" opacity="0.55">RunningFit generated visual · not an official product photo</text>
  </svg>`;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}
