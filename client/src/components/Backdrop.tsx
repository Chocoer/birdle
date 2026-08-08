/** 自然风光背景层：山川树林剪影 + 缓慢飞过的鸟剪影，纯 SVG 无图片资源 */
export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      {/* 飞鸟剪影（雁形曲线），从屏幕左侧缓缓飞向右侧 */}
      <svg className="bird b1" viewBox="0 0 48 20">
        <path d="M2 14 Q12 4 24 14 Q36 4 46 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <svg className="bird b2" viewBox="0 0 48 20">
        <path d="M2 14 Q12 4 24 14 Q36 4 46 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <svg className="bird b3" viewBox="0 0 48 20">
        <path d="M2 14 Q12 4 24 14 Q36 4 46 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>

      {/* 底部自然风光：远山 → 近山 → 树林与芦苇 */}
      <svg className="landscape" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">
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
        {/* 松树剪影 */}
        <g className="sil-near">
          <path d="M120 320 L120 250 L96 250 L120 210 L108 210 L132 170 L156 210 L144 210 L168 250 L144 250 L144 320 Z" />
          <path d="M215 320 L215 262 L196 262 L215 228 L206 228 L226 196 L246 228 L236 228 L256 262 L236 262 L236 320 Z" />
          <path d="M1180 320 L1180 255 L1158 255 L1180 218 L1169 218 L1191 182 L1213 218 L1202 218 L1224 255 L1202 255 L1202 320 Z" />
          <path d="M1290 320 L1290 268 L1273 268 L1290 238 L1282 238 L1299 210 L1316 238 L1308 238 L1325 268 L1308 268 L1308 320 Z" />
          {/* 芦苇丛 */}
          <g strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor" className="reeds">
            <path d="M560 320 Q558 280 552 258" />
            <path d="M576 320 Q578 274 586 252" />
            <path d="M592 320 Q590 286 596 264" />
            <ellipse cx="551" cy="252" rx="5" ry="10" fill="currentColor" stroke="none" />
            <ellipse cx="587" cy="246" rx="5" ry="10" fill="currentColor" stroke="none" />
            <path d="M1010 320 Q1008 282 1002 262" />
            <path d="M1026 320 Q1028 276 1036 256" />
            <ellipse cx="1001" cy="256" rx="5" ry="10" fill="currentColor" stroke="none" />
            <ellipse cx="1037" cy="250" rx="5" ry="10" fill="currentColor" stroke="none" />
          </g>
        </g>
        {/* 地面 */}
        <path className="sil-near" d="M0 300 Q360 285 720 296 Q1080 307 1440 292 L1440 320 L0 320 Z" />
      </svg>
    </div>
  );
}
