/** 自然风光背景层：浅色=湿地湖泊 / 深色=夜晚森林，纯 SVG 无图片资源 */

/** 飞鸟剪影（雁形曲线） */
function FlyingBird({ className }: { className: string }) {
  return (
    <svg className={`bird ${className}`} viewBox="0 0 48 20">
      <path
        d="M2 14 Q12 4 24 14 Q36 4 46 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 站立的鹭鸟剪影（湿地水边常见） */
function Heron({ className }: { className: string }) {
  return (
    <svg className={`heron ${className}`} viewBox="0 0 60 90">
      <g fill="currentColor">
        <ellipse cx="26" cy="42" rx="17" ry="10" />
        <path d="M38 38 Q50 26 44 12 Q42 6 38 6 Q44 10 42 18 Q40 28 30 36 Z" />
        <path d="M38 6 L58 11 L38 15 Q34 10 38 6 Z" />
        <rect x="20" y="50" width="2.6" height="34" />
        <rect x="30" y="50" width="2.6" height="30" />
      </g>
    </svg>
  );
}

export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      {/* ===== 浅色主题：湿地湖泊 ===== */}
      <div className="scene scene-wetland">
        <FlyingBird className="b1" />
        <FlyingBird className="b2" />
        <FlyingBird className="b3" />
        <FlyingBird className="b4" />
        <FlyingBird className="b5" />
        <svg className="landscape" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">
          {/* 远处浅浅的堤岸 */}
          <path
            className="sil-far"
            d="M0 150 Q240 130 480 142 Q760 156 1040 138 Q1260 126 1440 140 L1440 170 L0 170 Z"
          />
          {/* 水面 */}
          <path className="sil-water" d="M0 165 L1440 165 L1440 320 L0 320 Z" />
          {/* 水波纹 */}
          <g className="water-lines" strokeLinecap="round" fill="none">
            <path d="M160 210 Q220 206 280 210" />
            <path d="M420 245 Q500 241 580 245" />
            <path d="M760 200 Q840 196 920 200" />
            <path d="M1060 250 Q1130 246 1200 250" />
            <path d="M300 285 Q380 281 460 285" />
            <path d="M880 285 Q960 281 1040 285" />
          </g>
          {/* 荷叶 */}
          <g className="sil-mid">
            <ellipse cx="350" cy="270" rx="34" ry="8" />
            <ellipse cx="395" cy="282" rx="24" ry="6" />
            <ellipse cx="1120" cy="275" rx="30" ry="7" />
          </g>
          {/* 芦苇丛（左、中、右三簇） */}
          <g className="reeds" strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor">
            <path d="M120 320 Q118 260 110 232" />
            <path d="M140 320 Q142 250 152 226" />
            <path d="M160 320 Q158 268 166 240" />
            <ellipse cx="109" cy="226" rx="6" ry="13" fill="currentColor" stroke="none" />
            <ellipse cx="153" cy="220" rx="6" ry="13" fill="currentColor" stroke="none" />
            <path d="M700 320 Q698 264 690 238" />
            <path d="M722 320 Q724 254 734 230" />
            <path d="M742 320 Q740 272 748 244" />
            <ellipse cx="689" cy="232" rx="6" ry="13" fill="currentColor" stroke="none" />
            <ellipse cx="735" cy="224" rx="6" ry="13" fill="currentColor" stroke="none" />
            <path d="M1300 320 Q1298 258 1290 230" />
            <path d="M1322 320 Q1324 252 1334 226" />
            <ellipse cx="1289" cy="224" rx="6" ry="13" fill="currentColor" stroke="none" />
            <ellipse cx="1335" cy="220" rx="6" ry="13" fill="currentColor" stroke="none" />
          </g>
          {/* 岸边地面 */}
          <path className="sil-near" d="M0 302 Q360 288 720 298 Q1080 308 1440 294 L1440 320 L0 320 Z" />
        </svg>
        {/* 站在浅水里的两只鹭 */}
        <Heron className="h1" />
        <Heron className="h2" />
      </div>

      {/* ===== 深色主题：夜晚森林 ===== */}
      <div className="scene scene-forest">
        <FlyingBird className="b1" />
        <FlyingBird className="b2" />
        <FlyingBird className="b3" />
        <FlyingBird className="b4" />
        <FlyingBird className="b5" />
        <FlyingBird className="b6" />
        <svg className="landscape" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">
          {/* 月亮与星星 */}
          <circle className="moon" cx="1180" cy="56" r="30" />
          <g className="stars">
            <circle cx="180" cy="40" r="2.2" />
            <circle cx="360" cy="80" r="1.6" />
            <circle cx="560" cy="30" r="2" />
            <circle cx="760" cy="66" r="1.6" />
            <circle cx="940" cy="36" r="2.2" />
            <circle cx="1040" cy="96" r="1.6" />
            <circle cx="1320" cy="90" r="2" />
            <circle cx="80" cy="110" r="1.6" />
          </g>
          {/* 远山 */}
          <path
            className="sil-far"
            d="M0 220 L180 130 L340 210 L520 100 L700 200 L880 120 L1060 210 L1240 140 L1440 220 L1440 320 L0 320 Z"
          />
          {/* 近山 */}
          <path
            className="sil-mid"
            d="M0 270 L160 200 L360 260 L560 180 L760 255 L980 190 L1180 260 L1360 205 L1440 250 L1440 320 L0 320 Z"
          />
          {/* 松林 */}
          <g className="sil-near">
            <path d="M120 320 L120 250 L96 250 L120 210 L108 210 L132 170 L156 210 L144 210 L168 250 L144 250 L144 320 Z" />
            <path d="M215 320 L215 262 L196 262 L215 228 L206 228 L226 196 L246 228 L236 228 L256 262 L236 262 L236 320 Z" />
            <path d="M330 320 L330 268 L313 268 L330 238 L322 238 L339 210 L356 238 L348 238 L365 268 L348 268 L348 320 Z" />
            <path d="M1090 320 L1090 262 L1071 262 L1090 228 L1081 228 L1101 196 L1121 228 L1111 228 L1131 262 L1111 262 L1111 320 Z" />
            <path d="M1180 320 L1180 255 L1158 255 L1180 218 L1169 218 L1191 182 L1213 218 L1202 218 L1224 255 L1202 255 L1202 320 Z" />
            <path d="M1290 320 L1290 268 L1273 268 L1290 238 L1282 238 L1299 210 L1316 238 L1308 238 L1325 268 L1308 268 L1308 320 Z" />
          </g>
          {/* 地面 */}
          <path className="sil-near" d="M0 300 Q360 285 720 296 Q1080 307 1440 292 L1440 320 L0 320 Z" />
        </svg>
      </div>
    </div>
  );
}
