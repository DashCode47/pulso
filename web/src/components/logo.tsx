// Logo de Pulso: mismos vectores y misma animación que mobile/components/Logo.tsx
// ("PULSO" en contornos de Montserrat ExtraBold Italic + el pulso calcado del
// arte original). Mantener ambos archivos sincronizados.
const VIEW_W = 941;
const VIEW_H = 312;
const TEXT =
  'M2 175.6 42.8 5.4H114.8Q147.9 5.4 165.3 19.7Q182.7 34.1 181.7 60.1Q180.8 81.5 170 97.6Q159.1 113.6 139.8 122.4Q120.5 131.1 94.7 131.1H39.5L65.9 109.7L50.1 175.6ZM64.5 115.3 48.6 93.2H98.4Q114.2 93.2 123.3 85.6Q132.3 78.1 132.9 64.2Q133.3 53.5 126.5 48.4Q119.6 43.3 107 43.3H60.8L87.2 20.5ZM262.3 179Q236.7 179 220 169.2Q203.2 159.3 196.9 141.4Q190.6 123.6 196.1 99.7L218.9 5.4H267L244.5 99Q239.6 119.4 246.5 129.3Q253.4 139.1 269.7 139.1Q284.8 139.1 294.1 129.9Q303.5 120.6 308.7 99L331.2 5.4H378.6L355.5 101.9Q346.5 139.9 323.1 159.4Q299.7 179 262.3 179ZM368.9 175.6 409.7 5.4H457.9L426.3 137.4H507.5L498.2 175.6ZM580.5 179Q565.9 179 552.6 176.7Q539.4 174.4 528.6 170.1Q517.8 165.9 510.3 160.8L530.7 124.8Q539.2 130.1 548.4 133.9Q557.6 137.7 567.3 139.6Q576.9 141.6 586.6 141.6Q595.9 141.6 602.5 139.7Q609.1 137.9 612.7 134.5Q616.2 131.1 616.4 126.5Q616.6 121.4 612.2 118.3Q607.9 115.3 600.7 113.1Q593.5 110.9 584.7 108.6Q575.9 106.3 567.1 103Q558.4 99.7 551.3 94.8Q544.2 89.8 540 82Q535.8 74.2 536.3 62.8Q537 44.3 547.5 30.7Q558.1 17.1 576.7 9.5Q595.4 2 620.4 2Q638.7 2 654.3 5.8Q670 9.5 681.1 16.6L662.2 52.3Q652.5 46 640.6 42.7Q628.6 39.4 616 39.4Q606.3 39.4 599.3 41.6Q592.2 43.8 588.6 47.6Q584.9 51.4 584.7 56Q584.5 60.8 588.8 64Q593 67.2 600.3 69.3Q607.7 71.5 616.5 73.8Q625.2 76.2 633.9 79.2Q642.5 82.2 649.8 87.2Q657.2 92.2 661.2 99.7Q665.3 107.3 664.9 118.5Q664.1 136.7 653.6 150.3Q643.1 163.9 624.3 171.5Q605.6 179 580.5 179ZM766.3 179Q740 179 721.4 169.4Q702.9 159.8 693.3 143Q683.8 126.2 684.7 104.1Q685.6 81.7 694.1 63.1Q702.6 44.5 717.3 30.8Q731.9 17.1 751.8 9.5Q771.6 2 795 2Q821.2 2 839.8 11.6Q858.4 21.2 867.9 38Q877.5 54.8 876.6 76.9Q875.7 99.3 867.2 117.9Q858.7 136.5 844 150.2Q829.4 163.9 809.5 171.5Q789.6 179 766.3 179ZM772 139.1Q784.6 139.1 794.7 134.5Q804.7 129.9 812 121.5Q819.2 113.1 823.3 102.4Q827.4 91.7 827.9 79.8Q828.3 68.4 823.9 59.9Q819.5 51.4 810.8 46.6Q802.1 41.9 789.3 41.9Q776.9 41.9 766.7 46.5Q756.6 51.1 749.3 59.5Q742 67.9 738 78.6Q733.9 89.3 733.4 101.2Q733 112.4 737.3 121Q741.7 129.6 750.4 134.4Q759.1 139.1 772 139.1Z';
const LINE = [
  [762, 190], [830, 190], [840, 167], [851, 212], [863, 136], [878, 308],
  [886, 64], [905, 208], [911, 174], [916, 190], [939, 190],
];
const LINE_D = `M${LINE.map(([x, y]) => `${x} ${y}`).join(' L')}`;
const LINE_LEN = Math.ceil(LINE.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - LINE[i][0], y - LINE[i][1]), 0));

// El pulso se dibuja una vez al montar (1.2 s, ease-out cúbico, como en la app).
// CSS puro: sin JS por frame, y se omite con "reducir movimiento".
export function Logo({ width = 120, animate = true, className = '' }: { width?: number; animate?: boolean; className?: string }) {
  return (
    <svg
      width={width}
      height={(width * VIEW_H) / VIEW_W}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="Pulso"
      className={className}
    >
      <path d={TEXT} fill="var(--color-ink)" />
      <path
        d={LINE_D}
        fill="none"
        stroke="var(--color-gold)"
        // En el arte el trazo mide ~4.5 de 941; mínimo 1.5px en tamaños chicos.
        strokeWidth={Math.max(4.5, (1.5 * VIEW_W) / width)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={LINE_LEN}
        className={animate ? 'pulse-draw' : undefined}
        style={{ '--pulse-len': LINE_LEN } as React.CSSProperties}
      />
    </svg>
  );
}
